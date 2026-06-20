"""Post-reply trigger evaluation for scheduled tasks (משימות).

After Ghost finishes answering an automated task message, the chat service
schedules :func:`evaluate_task_triggers` as a fire-and-forget background
task. It semantically matches the reply against the task's trigger phrases
and, per trigger kind:

* ``critical`` — fires a task alert through the EXISTING alert pipeline
  (``alert_events`` row + ``AlertBroker`` SSE push → full-screen overlay),
  tagged ``source='task'`` so the UI labels it as a task alert.
* ``report``   — stores a downloadable ``task_reports`` row, appends a
  report card message to the chat, and pushes a ``task_report`` SSE event.

Safety properties (see the plan's risk register):

* Fully isolated — own SQLite connection, every step wrapped, never raises
  into the SSE stream that already finished.
* The model call goes through the shared :class:`AlertQueue` token bucket,
  so trigger scans can never bypass the OpenAI rate budget. A distinct
  dedup key (``task-scan:<task_id>``) keeps it from colliding with camera
  alert scans for the same conversation.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.alert_broker import get_alert_broker
from app.services.alert_queue import get_alert_queue
from app.services.openai_client import task_trigger_scan
from app.storage.alert_store import create_event
from app.storage.conversation_store import increment_message_count
from app.storage.database import get_db
from app.storage.message_store import create_message
from app.storage.task_store import (
    create_report,
    ensure_shadow_rule,
    get_task,
    list_active_triggers,
)

logger = logging.getLogger("ghost.task_service")

_ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")

# Chat-card markers (parsed by the frontend MessageBubble).
TASK_REPORT_MARKER = "[[GHOST_TASK_REPORT:{report_id}]]"
TASK_ALERT_LINE = "\U0001f4cc \u05de\u05e9\u05d9\u05de\u05d4: {task_name}"


async def evaluate_task_triggers(
    *,
    task_id: str,
    conversation_id: str,
    user_id: str,
    assistant_text: str,
    frame_url: str | None,
    camera_label: str | None,
    api_key: str,
    locale: str = "he",
) -> None:
    """Run the semantic trigger scan for one completed task reply. Never
    raises — every failure is logged and swallowed."""
    try:
        await _evaluate(
            task_id=task_id,
            conversation_id=conversation_id,
            user_id=user_id,
            assistant_text=assistant_text,
            frame_url=frame_url,
            camera_label=camera_label,
            api_key=api_key,
            locale=locale,
        )
    except Exception:
        logger.exception(
            "Task trigger evaluation failed (task=%s conversation=%s)",
            task_id,
            conversation_id,
        )


async def _evaluate(
    *,
    task_id: str,
    conversation_id: str,
    user_id: str,
    assistant_text: str,
    frame_url: str | None,
    camera_label: str | None,
    api_key: str,
    locale: str,
) -> None:
    if not (assistant_text or "").strip():
        return

    db = get_db()
    try:
        task = get_task(db, task_id)
        if not task or task["conversation_id"] != conversation_id:
            return
        triggers = list_active_triggers(db, task_id)
        if not triggers:
            return

        async def _runner() -> dict:
            return await task_trigger_scan(
                assistant_text, triggers, api_key=api_key, locale=locale
            )

        # Shared token bucket with camera alert scans (rate-limit safety).
        # The "task-scan:" dedup key never collides with camera scans, which
        # enqueue under the bare conversation id.
        result = await get_alert_queue().enqueue(
            f"task-scan:{task_id}", _runner
        )
        if not result:
            return

        matches = result.get("matches") or []
        seen_indexes: set[int] = set()
        for match in matches:
            if not isinstance(match, dict):
                continue
            if (match.get("confidence") or "").lower() != "high":
                continue
            idx = match.get("trigger_index")
            if (
                not isinstance(idx, int)
                or not (1 <= idx <= len(triggers))
                or idx in seen_indexes
            ):
                continue
            seen_indexes.add(idx)
            trigger = triggers[idx - 1]
            summary = (match.get("event_summary") or "").strip()
            if not summary:
                summary = trigger["phrase"]

            if trigger["alert_kind"] == "critical":
                _fire_critical_alert(
                    db,
                    task=task,
                    trigger=trigger,
                    summary=summary,
                    frame_url=frame_url,
                    user_id=user_id,
                )
            else:
                _store_report(
                    db,
                    task=task,
                    trigger=trigger,
                    summary=summary,
                    reply_text=assistant_text,
                    frame_url=frame_url,
                    camera_label=camera_label,
                    user_id=user_id,
                )
    finally:
        try:
            db.close()
        except Exception:
            pass


def _fire_critical_alert(
    db,
    *,
    task: dict,
    trigger: dict,
    summary: str,
    frame_url: str | None,
    user_id: str,
) -> None:
    """Create a task alert event and push it through the existing alert SSE
    channel — the frontend renders the same full-screen overlay, tagged as a
    task alert via ``source='task'``."""
    conversation_id = task["conversation_id"]
    try:
        shadow_rule_id = ensure_shadow_rule(db, trigger, conversation_id)
        event = create_event(
            db=db,
            conversation_id=conversation_id,
            rule_id=shadow_rule_id,
            matched_description=trigger["phrase"],
            ai_description=summary,
            frame_path=frame_url,
            confidence="high",
            source="task",
            task_id=task["id"],
            trigger_id=trigger["id"],
        )
    except Exception:
        logger.exception(
            "Failed to create task alert event (task=%s trigger=%s)",
            task["id"],
            trigger["id"],
        )
        return

    try:
        get_alert_broker().publish(
            user_id,
            {
                "type": "alert_event",
                "event": event,
                "conversation_id": conversation_id,
                "conversation_title_hint": task.get("name"),
            },
        )
    except Exception:
        logger.exception(
            "Failed to publish task alert event %s", event.get("id")
        )

    asyncio.create_task(
        asyncio.to_thread(
            _save_task_alert_message_sync,
            conversation_id,
            task.get("name") or "",
            trigger["phrase"],
            summary,
        )
    )


def _store_report(
    db,
    *,
    task: dict,
    trigger: dict,
    summary: str,
    reply_text: str,
    frame_url: str | None,
    camera_label: str | None,
    user_id: str,
) -> None:
    """Persist a report record + chat report card, then notify via SSE."""
    conversation_id = task["conversation_id"]
    try:
        report = create_report(
            db,
            task_id=task["id"],
            trigger_id=trigger["id"],
            conversation_id=conversation_id,
            message_id=None,
            task_name=task.get("name") or "",
            prompt_text=task.get("prompt_text") or "",
            matched_phrase=trigger["phrase"],
            summary=summary,
            reply_text=reply_text,
            frame_path=frame_url,
            camera_label=camera_label,
        )
    except Exception:
        logger.exception(
            "Failed to create task report (task=%s trigger=%s)",
            task["id"],
            trigger["id"],
        )
        return

    now_israel = datetime.now(_ISRAEL_TZ).strftime("%d/%m/%Y %H:%M:%S")
    marker = TASK_REPORT_MARKER.format(report_id=report["id"])
    content = (
        f"{marker}\n"
        "\U0001f4cb \u05d4\u05ea\u05e8\u05d0\u05ea \u05d3\u05d9\u05d5\u05d5\u05d7\n\n"
        f"\U0001f4cc \u05de\u05e9\u05d9\u05de\u05d4: {report['task_name']}\n"
        f"\U0001f514 \u05d8\u05e8\u05d9\u05d2\u05e8: {report['matched_phrase']}\n"
        f"\U0001f4dd \u05e1\u05d9\u05db\u05d5\u05dd: {report['summary']}\n"
        f"\U0001f550 \u05d6\u05de\u05df: {now_israel}"
    )

    try:
        msg = create_message(db, conversation_id, "assistant", content)
        increment_message_count(db, conversation_id)
        db.execute(
            "UPDATE task_reports SET message_id = ? WHERE id = ?",
            (msg["id"], report["id"]),
        )
        db.commit()
        report["message_id"] = msg["id"]
    except Exception:
        logger.exception(
            "Failed to persist task report chat card (report=%s)",
            report["id"],
        )

    try:
        get_alert_broker().publish(
            user_id,
            {
                "type": "task_report",
                "report": report,
                "conversation_id": conversation_id,
            },
        )
    except Exception:
        logger.exception(
            "Failed to publish task report %s", report.get("id")
        )


def _save_task_alert_message_sync(
    conversation_id: str,
    task_name: str,
    matched_phrase: str,
    summary: str,
) -> None:
    """Append the task alert as an assistant chat message. Same shape as the
    camera alert message (so the existing SOC card renders) plus the task
    line so the operator sees where it came from. Own connection — runs off
    the request thread."""
    now_israel = datetime.now(_ISRAEL_TZ).strftime("%d/%m/%Y %H:%M:%S")
    content = (
        "\u26a0\ufe0f \u05d4\u05ea\u05e8\u05d0\u05d4 \u05d6\u05d5\u05d4\u05ea\u05d4!\n\n"
        f"{TASK_ALERT_LINE.format(task_name=task_name)}\n"
        f"\U0001f50d \u05e9\u05d5\u05e8\u05ea \u05d4\u05ea\u05e8\u05d0\u05d4: {matched_phrase}\n"
        f"\U0001f4dd \u05ea\u05d9\u05d0\u05d5\u05e8: {summary}\n"
        f"\U0001f550 \u05d6\u05de\u05df: {now_israel}"
    )
    db = get_db()
    try:
        create_message(db, conversation_id, "assistant", content)
        increment_message_count(db, conversation_id)
    except Exception:
        logger.exception(
            "Failed to save task alert message for conversation %s",
            conversation_id,
        )
    finally:
        db.close()
