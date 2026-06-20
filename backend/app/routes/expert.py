"""API routes for Ghost Expert mode.

Expert mode is an intelligence-advisor interrogation (handled inline in the
chat stream with ``mode="expert"``) that culminates in a structured
recommendation set — 8 tasks + 8 alerts tailored to the conversation's
environment. These endpoints:

* ``POST /conversations/{id}/expert/generate`` — read the interrogation
  history (+ an optional live frame), call the flagship model for the
  structured plan, persist it, and post the in-chat report card message.
* ``GET  /conversations/{id}/expert/reports/{report_id}`` — fetch a stored
  report (so the card survives a refresh).
* ``POST /conversations/{id}/expert/apply`` — materialise the recommendations
  as INACTIVE draft tasks + alert rules the operator can edit/delete/activate.
"""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter

from app.config import settings
from app.schemas.requests import ExpertApplyRequest, ExpertGenerateRequest
from app.schemas.responses import error_response, ok_response
from app.services.chat_service import _save_frame_to_disk
from app.services.openai_client import generate_expert_recommendations
from app.services.prompt_builder import build_expert_generate_messages
from app.storage.alert_store import create_rule, update_rule
from app.storage.conversation_store import get_conversation, increment_message_count
from app.storage.database import get_db
from app.storage.expert_store import (
    create_report,
    get_report,
    mark_applied,
    set_report_message,
)
from app.storage.message_store import create_message, get_messages_since, update_message_image_path
from app.storage.task_store import create_task, update_task
from app.storage.user_store import get_user_api_key

logger = logging.getLogger("ghost.routes.expert")
router = APIRouter(tags=["expert"])

EXPERT_REPORT_MARKER = "[[GHOST_EXPERT_REPORT:{report_id}]]"

_HHMM_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")
_EVERY_MIN_RE = re.compile(r"(\d{1,3})\s*(?:דק|min)")


def _require_conversation(db, conversation_id: str, user_id: str) -> dict:
    conv = get_conversation(db, conversation_id, user_id=user_id)
    if not conv:
        error_response("CONVERSATION_NOT_FOUND", "Conversation not found or access denied", 404)
    return conv  # type: ignore[return-value]


def _history_text(db, conversation_id: str) -> str:
    """Concatenate the recent interrogation turns into a compact transcript."""
    msgs = get_messages_since(db, conversation_id, since_hours=72, hard_limit=40)
    lines: list[str] = []
    for m in msgs:
        role = "מפעיל" if m["role"] == "user" else "Ghost"
        text = (m.get("content") or "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


def _coerce_list(value: object) -> list[dict]:
    return [x for x in value if isinstance(x, dict)] if isinstance(value, list) else []


def _schedule_from_hint(hint: str) -> dict:
    """Map a free-language schedule hint to scheduled-task fields.

    Conservative defaults: a daily time when one is named or 'daily/יומי' is
    mentioned, an interval when minutes are named or it reads as continuous,
    otherwise a 30-minute interval."""
    low = (hint or "").lower()
    hhmm = _HHMM_RE.search(hint or "")
    if "יומי" in low or "daily" in low or hhmm:
        daily_time = f"{hhmm.group(1).zfill(2)}:{hhmm.group(2)}" if hhmm else "09:00"
        return {"schedule_type": "daily", "daily_time": daily_time}
    minutes = _EVERY_MIN_RE.search(hint or "")
    if minutes:
        secs = max(45, min(86400, int(minutes.group(1)) * 60))
        return {"schedule_type": "interval", "interval_seconds": secs}
    if "רציף" in low or "continuous" in low or "שעה" in low or "hour" in low:
        return {"schedule_type": "interval", "interval_seconds": 1800}
    return {"schedule_type": "interval", "interval_seconds": 1800}


@router.post("/conversations/{conversation_id}/expert/generate")
async def expert_generate(conversation_id: str, req: ExpertGenerateRequest):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        api_key = get_user_api_key(db, req.user_id)
        if not api_key:
            error_response("API_KEY_MISSING", "No API key configured for this user", 400)

        locale = req.locale or "he"
        history = _history_text(db, conversation_id)
        messages = build_expert_generate_messages(history, req.image_base64, locale)

        try:
            parsed = await generate_expert_recommendations(
                messages, api_key, model=settings.effective_expert_model()
            )
        except Exception as exc:
            logger.exception("Expert generation failed for %s", conversation_id)
            error_response("EXPERT_GENERATE_FAILED", "Could not generate recommendations", 502)
            raise AssertionError from exc  # pragma: no cover

        summary = (parsed.get("summary") or "").strip()
        tasks = _coerce_list(parsed.get("tasks"))[:8]
        alerts = _coerce_list(parsed.get("alerts"))[:8]
        if not tasks and not alerts:
            error_response("EXPERT_GENERATE_EMPTY", "No recommendations were produced", 502)

        payload = {"tasks": tasks, "alerts": alerts}
        report = create_report(db, conversation_id, summary, payload)

        # Post the in-chat thread: a user "frame" turn + the assistant report
        # card. The frame (if any) is saved to disk so the card can show it.
        user_msg = create_message(db, conversation_id, "user", "Ghost Expert — סריקת סביבה")
        increment_message_count(db, conversation_id)
        if req.image_base64:
            saved = _save_frame_to_disk(conversation_id, user_msg["id"], req.image_base64)
            if saved:
                update_message_image_path(db, user_msg["id"], saved)
                user_msg["image_path"] = saved

        marker = EXPERT_REPORT_MARKER.format(report_id=report["id"])
        assistant_msg = create_message(db, conversation_id, "assistant", marker)
        increment_message_count(db, conversation_id)
        set_report_message(db, report["id"], assistant_msg["id"])

        return ok_response(
            {
                "report_id": report["id"],
                "summary": summary,
                "tasks": tasks,
                "alerts": alerts,
                "user_message_id": user_msg["id"],
                "assistant_message_id": assistant_msg["id"],
                "user_image_path": user_msg.get("image_path"),
            }
        )
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/expert/reports/{report_id}")
async def expert_get_report(conversation_id: str, report_id: str, user_id: str):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        report = get_report(db, report_id)
        if not report or report["conversation_id"] != conversation_id:
            error_response("EXPERT_REPORT_NOT_FOUND", "Report not found", 404)
        return ok_response(
            {
                "report_id": report["id"],
                "summary": report["summary"],
                "tasks": _coerce_list(report["payload"].get("tasks")),
                "alerts": _coerce_list(report["payload"].get("alerts")),
                "applied": report["applied"],
            }
        )
    finally:
        db.close()


@router.post("/conversations/{conversation_id}/expert/apply")
async def expert_apply(conversation_id: str, req: ExpertApplyRequest):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        report = get_report(db, req.report_id)
        if not report or report["conversation_id"] != conversation_id:
            error_response("EXPERT_REPORT_NOT_FOUND", "Report not found", 404)

        tasks = _coerce_list(report["payload"].get("tasks"))
        alerts = _coerce_list(report["payload"].get("alerts"))

        created_tasks = 0
        for t in tasks:
            name = (t.get("name") or "").strip()[:120]
            prompt_text = (t.get("prompt") or t.get("description") or "").strip()[:2000]
            if not name or not prompt_text:
                continue
            sched = _schedule_from_hint(t.get("schedule_hint") or "")
            task = create_task(
                db,
                conversation_id=conversation_id,
                name=name,
                prompt_text=prompt_text,
                schedule_type=sched["schedule_type"],
                interval_seconds=sched.get("interval_seconds"),
                daily_time=sched.get("daily_time"),
                include_camera=True,
            )
            # Drafts land INACTIVE — the operator reviews, then activates.
            update_task(db, task["id"], is_active=False)
            created_tasks += 1

        created_alerts = 0
        for a in alerts:
            description = (a.get("description") or a.get("name") or "").strip()
            if not description:
                continue
            rule = create_rule(db, conversation_id, description)
            update_rule(db, rule["id"], is_active=False)
            created_alerts += 1

        mark_applied(db, req.report_id)
        logger.info(
            "Expert apply: %d inactive tasks + %d inactive alert rules for %s",
            created_tasks,
            created_alerts,
            conversation_id,
        )
        return ok_response({"created_tasks": created_tasks, "created_alerts": created_alerts})
    finally:
        db.close()
