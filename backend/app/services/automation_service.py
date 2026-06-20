"""Conversational automation builder service.

Turns an operator's free-language request (typed from the composer in
"automation" mode) into a reviewable draft, then — on confirm — materialises
that draft into the EXISTING alert / task pipelines:

* ``alert`` -> ``alert_rules`` row (+ optional arm of alert mode).
* ``task``  -> ``scheduled_tasks`` row (+ optional ``report`` trigger).

The parse step persists the operator's request as a user message and an
assistant message carrying the ``[[GHOST_AUTOMATION_DRAFT:<id>]]`` marker so
the in-thread editable widget can render. Confirmation flips the draft status
to ``created`` so reloads stay correct without mutating the chat message.
"""

from __future__ import annotations

import logging
import re

from app.schemas.responses import error_response
from app.services.openai_client import parse_automation_intent
from app.storage.alert_store import create_rule, set_alert_mode, update_rule
from app.storage.automation_store import (
    create_draft,
    set_draft_message,
    set_draft_status,
    update_draft_payload,
)
from app.storage.conversation_store import increment_message_count
from app.storage.message_store import create_message
from app.storage.task_store import (
    create_task,
    create_trigger,
    delete_task,
    get_task,
    list_triggers,
    update_task,
)

logger = logging.getLogger("ghost.automation_service")

AUTOMATION_DRAFT_MARKER = "[[GHOST_AUTOMATION_DRAFT:{draft_id}]]"

_DAILY_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_INTERVAL_MIN_SECONDS = 45
_INTERVAL_MAX_SECONDS = 86400


# ---------------------------------------------------------------------------
# Payload normalisation
# ---------------------------------------------------------------------------


def _clean_str(value: object, fallback: str = "") -> str:
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            return stripped
    return fallback


def normalize_payload(kind: str, parsed: dict, *, source_text: str) -> dict:
    """Coerce the model output into the canonical per-kind draft payload."""
    if kind == "alert":
        return {
            "kind": "alert",
            "description": _clean_str(
                parsed.get("description"), fallback=source_text.strip()
            ),
        }

    schedule_type = parsed.get("schedule_type")
    if schedule_type not in ("once", "interval", "daily"):
        schedule_type = "once"

    interval_seconds = parsed.get("interval_seconds")
    if isinstance(interval_seconds, int):
        interval_seconds = max(
            _INTERVAL_MIN_SECONDS, min(interval_seconds, _INTERVAL_MAX_SECONDS)
        )
    else:
        interval_seconds = None

    daily_time = parsed.get("daily_time")
    if not (isinstance(daily_time, str) and _DAILY_TIME_RE.match(daily_time)):
        daily_time = None

    run_at = parsed.get("run_at")
    run_at = run_at.strip() if isinstance(run_at, str) and run_at.strip() else None

    is_check = bool(parsed.get("is_check"))
    report_phrase = _clean_str(parsed.get("report_phrase"))

    return {
        "kind": "task",
        "name": _clean_str(parsed.get("name"), fallback="משימה")[:120],
        "prompt_text": _clean_str(
            parsed.get("prompt_text"), fallback=source_text.strip()
        )[:2000],
        "schedule_type": schedule_type,
        "run_at": run_at,
        "interval_seconds": interval_seconds,
        "daily_time": daily_time,
        "include_camera": bool(parsed.get("include_camera", True)),
        "is_check": is_check,
        "report_phrase": report_phrase if is_check else "",
    }


def _summary_text(kind: str, payload: dict, locale: str) -> str:
    """A short human-readable block under the marker — fallback only, since
    the widget fully replaces rendering when the marker is recognised."""
    he = locale != "en"
    if kind == "alert":
        head = "טיוטת התראה" if he else "Alert draft"
        return f"{head}: {payload.get('description', '')}"
    head = "טיוטת משימה" if he else "Task draft"
    return f"{head}: {payload.get('name', '')}"


# ---------------------------------------------------------------------------
# Parse + draft
# ---------------------------------------------------------------------------


async def parse_and_draft(
    db,
    *,
    conversation_id: str,
    user_id: str,
    kind: str,
    text: str,
    client_now: str | None,
    locale: str,
    api_key: str,
) -> dict:
    """Persist the request, parse it with the model, and store a draft +
    in-thread widget marker. Returns the draft dict (with ``message_id``)."""
    source_text = (text or "").strip()

    # Persist the operator's free-language request as a normal user message so
    # it appears in the thread above the draft widget.
    create_message(db, conversation_id, "user", source_text)
    increment_message_count(db, conversation_id)

    parsed = await parse_automation_intent(
        kind=kind,
        text=source_text,
        client_now=client_now,
        locale=locale,
        api_key=api_key,
    )
    payload = normalize_payload(kind, parsed, source_text=source_text)

    draft = create_draft(
        db,
        conversation_id=conversation_id,
        kind=kind,
        payload=payload,
        source_text=source_text,
    )

    marker = AUTOMATION_DRAFT_MARKER.format(draft_id=draft["id"])
    content = f"{marker}\n{_summary_text(kind, payload, locale)}"
    msg = create_message(db, conversation_id, "assistant", content)
    increment_message_count(db, conversation_id)
    set_draft_message(db, draft["id"], msg["id"])

    draft["message_id"] = msg["id"]
    logger.info(
        "Automation draft %s ready (kind=%s conversation=%s)",
        draft["id"],
        kind,
        conversation_id,
    )
    return draft


# ---------------------------------------------------------------------------
# Edit / confirm / dismiss
# ---------------------------------------------------------------------------


def update_draft(db, *, draft: dict, payload_patch: dict) -> dict:
    """Merge operator edits into the draft payload (drafts only)."""
    if draft["status"] != "draft":
        error_response(
            "AUTOMATION_DRAFT_NOT_OPEN",
            "Draft is no longer editable",
            409,
        )
    merged = {**draft["payload"], **(payload_patch or {})}
    # The kind is immutable — it is fixed by the composer menu choice.
    merged["kind"] = draft["kind"]
    if draft["kind"] == "task":
        merged = normalize_payload("task", merged, source_text=draft.get("source_text", ""))
    else:
        merged = normalize_payload("alert", merged, source_text=draft.get("source_text", ""))
    updated = update_draft_payload(db, draft["id"], merged)
    return updated  # type: ignore[return-value]


def _validate_task_schedule(payload: dict) -> None:
    st = payload.get("schedule_type")
    if st == "once" and not payload.get("run_at"):
        error_response(
            "AUTOMATION_SCHEDULE_INVALID",
            "A one-time task needs a date and time",
            400,
        )
    if st == "interval" and not payload.get("interval_seconds"):
        error_response(
            "AUTOMATION_SCHEDULE_INVALID",
            "An interval task needs an interval",
            400,
        )
    if st == "daily" and not payload.get("daily_time"):
        error_response(
            "AUTOMATION_SCHEDULE_INVALID",
            "A daily task needs a time of day",
            400,
        )


def confirm_draft(db, *, draft: dict, activate: bool) -> dict:
    """Materialise a draft into a real alert rule or scheduled task."""
    if draft["status"] != "draft":
        error_response(
            "AUTOMATION_DRAFT_NOT_OPEN",
            "Draft has already been confirmed or dismissed",
            409,
        )

    payload = draft["payload"]
    conversation_id = draft["conversation_id"]

    if draft["kind"] == "alert":
        description = _clean_str(payload.get("description"))
        if not description:
            error_response(
                "AUTOMATION_FIELDS_INVALID",
                "Alert description is empty",
                400,
            )
        rule = create_rule(db, conversation_id, description)
        if activate:
            set_alert_mode(db, conversation_id, True)
        else:
            rule = update_rule(db, rule["id"], is_active=False) or rule
        updated = set_draft_status(
            db,
            draft["id"],
            "created",
            created_rule_id=rule["id"],
            activated=activate,
        )
        return {"draft": updated, "rule": rule}

    # kind == "task"
    _validate_task_schedule(payload)
    task = create_task(
        db,
        conversation_id=conversation_id,
        name=_clean_str(payload.get("name"), fallback="משימה"),
        prompt_text=_clean_str(payload.get("prompt_text")),
        schedule_type=payload.get("schedule_type") or "once",
        run_at=payload.get("run_at"),
        interval_seconds=payload.get("interval_seconds"),
        daily_time=payload.get("daily_time"),
        include_camera=bool(payload.get("include_camera", True)),
    )
    if payload.get("schedule_type") == "once" and not task.get("next_run_at"):
        delete_task(db, task["id"])
        error_response(
            "AUTOMATION_SCHEDULE_INVALID",
            "The one-time run time is invalid",
            400,
        )

    if payload.get("is_check"):
        phrase = _clean_str(
            payload.get("report_phrase"),
            fallback=_clean_str(payload.get("prompt_text")),
        )
        if phrase:
            create_trigger(db, task["id"], phrase[:300], alert_kind="report")

    if not activate:
        update_task(db, task["id"], is_active=False)

    updated = set_draft_status(
        db,
        draft["id"],
        "created",
        created_task_id=task["id"],
        activated=activate,
    )
    fresh = get_task(db, task["id"]) or task
    task_full = {**fresh, "triggers": list_triggers(db, task["id"])}
    return {"draft": updated, "task": task_full}


def dismiss_draft(db, *, draft: dict) -> dict:
    if draft["status"] == "created":
        error_response(
            "AUTOMATION_DRAFT_NOT_OPEN",
            "A confirmed draft cannot be dismissed",
            409,
        )
    updated = set_draft_status(db, draft["id"], "dismissed")
    return {"draft": updated}
