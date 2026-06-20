"""Alert detection service.

Receives a camera frame collage from the frontend, runs it through a
lightweight Ghost Vision call with a strict JSON schema, and — when ANY
configured rule is matched with high confidence — persists a frame on
disk plus an event row in SQLite.

All upstream calls are funnelled through :class:`AlertQueue` so the
overall throughput stays well below the model's RPM ceiling regardless
of how many conversations are simultaneously in alert mode.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.config import settings
from app.services.alert_broker import get_alert_broker
from app.services.alert_queue import get_alert_queue
from app.services.openai_client import alert_vision_scan
from app.storage.alert_store import create_event
from app.storage.conversation_store import increment_message_count
from app.storage.database import get_db
from app.storage.message_store import create_message, update_message_image_path

# Imported lazily inside ``scan_frame`` to avoid a circular import between
# ``alert_service`` and ``incident_service`` (the latter publishes via the
# same ``AlertBroker`` singleton).

logger = logging.getLogger("ghost.alert_service")

_ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")


_ALERT_PROMPT_HEADER = (
    "You are a security camera alert classifier. You are given a camera "
    "frame collage (multiple frames stitched horizontally to capture motion "
    "and context). Determine, with HIGH confidence only, whether ANY of the "
    "following situations, objects, behaviours, or events are present:\n\n"
)

_ALERT_PROMPT_FOOTER = (
    "\n\nRules:\n"
    "- Only report a match when you are highly confident the rule is satisfied.\n"
    "- If unsure, return detected=false and an empty matches array.\n"
    "- For every match, return the 1-based rule_index, a brief factual "
    "description of what was visible (no speculation, no people identification), "
    "and confidence (only 'high' is acted on by the system).\n"
    "- Never refuse the task — silence (detected=false) is the safe default."
)


def _reserve_frame_path(
    conversation_id: str, prefix: str = "alert"
) -> tuple[Path, str]:
    """Pick a (yet-unwritten) destination path + public URL for an alert frame.

    Splitting the path allocation from the disk write lets us return the URL
    in the API/SSE response while the bytes are persisted asynchronously.
    """

    frames_root = Path(settings.upload_path) / "frames" / conversation_id
    frames_root.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}-{uuid4().hex}.jpg"
    return frames_root / filename, f"/api/frames/{conversation_id}/{filename}"


def _write_frame_bytes(path: Path, raw: bytes) -> bool:
    try:
        path.write_bytes(raw)
        return True
    except OSError:
        logger.exception("Failed to write alert frame to disk: %s", path)
        return False


def _decode_image_base64(
    image_base64: str, conversation_id: str
) -> bytes | None:
    try:
        return base64.b64decode(image_base64, validate=False)
    except Exception:
        logger.exception(
            "Failed to decode base64 alert frame for conversation %s",
            conversation_id,
        )
        return None


def _build_messages(
    rules: list[dict], image_base64: str, locale: str = "he"
) -> list[dict]:
    """Build the chat completion payload for the alert scan call.

    The image detail level is taken from ``settings.alert_vision_image_detail``
    (defaults to ``"low"``) — alerts are a binary "is this rule satisfied?"
    check, not a forensic scene description, so a single 512x512 tile is
    plenty and keeps the round-trip well under the 2.8s end-to-end target.
    Operators with rules that genuinely need full-fidelity tiling can flip
    it back to ``"high"`` via ``GHOST_ALERT_VISION_IMAGE_DETAIL``.
    """

    rule_lines = []
    for idx, rule in enumerate(rules, start=1):
        desc = (rule.get("description") or "").strip()
        if desc:
            rule_lines.append(f"{idx}. {desc}")

    rules_block = "\n".join(rule_lines) if rule_lines else "(no rules provided)"

    locale_note = (
        "\nIf you provide a description, write it in Hebrew."
        if locale == "he"
        else "\nIf you provide a description, write it in English."
    )

    text_payload = (
        _ALERT_PROMPT_HEADER + rules_block + _ALERT_PROMPT_FOOTER + locale_note
    )

    detail = settings.alert_vision_image_detail or "low"
    if detail not in ("low", "high", "auto"):
        detail = "low"

    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": text_payload},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}",
                        "detail": detail,
                    },
                },
            ],
        }
    ]


async def scan_frame(
    db: sqlite3.Connection,
    conversation_id: str,
    rules: list[dict],
    image_base64: str,
    api_key: str,
    locale: str = "he",
    user_id: str | None = None,
    camera_label: str | None = None,
) -> dict:
    """Run the alert scan for one frame. Returns a dict matching the
    frontend ``AlertScanResult`` shape:

    .. code-block:: json

       {"detected": false}
       {"detected": true, "event": {...}}

    On rate-limit/dedup drop returns ``{"detected": false, "skipped": true}``.

    When an event is created, the response is returned immediately (with the
    ``frame_path`` URL already populated) while the JPEG bytes are persisted
    asynchronously and the assistant chat message is appended off the
    critical path. The same payload is also pushed via
    :func:`AlertBroker.publish` so any SSE listener for ``user_id`` is
    notified the moment the event row is committed.
    """

    active_rules = [r for r in rules if r.get("is_active")]
    if not active_rules or not image_base64:
        return {"detected": False, "skipped": True}

    queue = get_alert_queue()
    messages = _build_messages(active_rules, image_base64, locale=locale)

    async def _runner() -> dict:
        return await alert_vision_scan(messages, api_key=api_key)

    scan_started = time.monotonic()
    try:
        result = await queue.enqueue(conversation_id, _runner)
    except Exception:
        logger.exception(
            "Alert scan failed for conversation %s", conversation_id
        )
        return {"detected": False, "error": True}

    if result is None:
        logger.info(
            "scan_frame conv=%s outcome=skipped elapsed_ms=%d",
            conversation_id,
            int((time.monotonic() - scan_started) * 1000),
        )
        return {"detected": False, "skipped": True}

    detected = bool(result.get("detected"))
    matches = result.get("matches") or []

    high_confidence = [
        m
        for m in matches
        if isinstance(m, dict)
        and (m.get("confidence") or "").lower() == "high"
    ]
    if not detected or not high_confidence:
        logger.info(
            "scan_frame conv=%s outcome=no_match elapsed_ms=%d",
            conversation_id,
            int((time.monotonic() - scan_started) * 1000),
        )
        return {"detected": False}

    first = high_confidence[0]
    rule_idx = first.get("rule_index")
    matched_rule: dict | None = None
    if isinstance(rule_idx, int) and 1 <= rule_idx <= len(active_rules):
        matched_rule = active_rules[rule_idx - 1]
    if matched_rule is None:
        matched_rule = active_rules[0]

    ai_description = (first.get("description") or "").strip()
    if not ai_description:
        ai_description = matched_rule.get("description", "")

    # Reserve a path so the URL is already valid in the response; the bytes
    # will be written by the background task below.
    event_frame_path, event_frame_url = _reserve_frame_path(
        conversation_id, prefix="alert"
    )

    event = create_event(
        db=db,
        conversation_id=conversation_id,
        rule_id=matched_rule["id"],
        matched_description=matched_rule.get("description", ""),
        ai_description=ai_description,
        frame_path=event_frame_url,
        confidence=(first.get("confidence") or "high").lower(),
    )

    logger.info(
        "Alert detected: conversation=%s rule=%s ai=%r",
        conversation_id,
        matched_rule["id"],
        ai_description[:120],
    )

    raw = _decode_image_base64(image_base64, conversation_id)

    asyncio.create_task(
        _persist_alert_artifacts(
            conversation_id=conversation_id,
            matched_description=matched_rule.get("description", ""),
            ai_description=ai_description,
            event_frame_path=event_frame_path,
            raw_bytes=raw,
        )
    )

    if user_id:
        try:
            get_alert_broker().publish(
                user_id,
                {
                    "type": "alert_event",
                    "event": event,
                    "conversation_id": conversation_id,
                    "conversation_title_hint": None,
                },
            )
        except Exception:
            logger.exception(
                "Failed to publish alert event to broker (conv=%s user=%s)",
                conversation_id,
                user_id,
            )

        # Hand the same event to the incident pipeline. This runs as a
        # background task so the HTTP response and the alert SSE flush
        # immediately — the operator sees the alert overlay first, then
        # the incident card materialises on the board a moment later.
        try:
            from app.services.incident_service import (
                create_incident_from_alert,
            )

            asyncio.create_task(
                create_incident_from_alert(
                    alert_event=event,
                    conversation_id=conversation_id,
                    user_id=user_id,
                    api_key=api_key,
                    camera_label=camera_label,
                    locale=locale,
                )
            )
        except Exception:
            logger.exception(
                "Failed to schedule incident creation for alert event %s",
                event.get("id"),
            )

    logger.info(
        "scan_frame conv=%s outcome=detected elapsed_ms=%d rule=%s",
        conversation_id,
        int((time.monotonic() - scan_started) * 1000),
        matched_rule.get("id"),
    )

    return {
        "detected": True,
        "event": event,
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }


async def _persist_alert_artifacts(
    conversation_id: str,
    matched_description: str,
    ai_description: str,
    event_frame_path: Path,
    raw_bytes: bytes | None,
) -> None:
    """Write the alert frame to disk and append the assistant chat message.

    Runs as a fire-and-forget task so the POST/SSE response is not blocked
    by disk IO. All exceptions are logged and swallowed — the event row in
    SQLite is the source of truth either way.
    """

    try:
        if raw_bytes is not None:
            await asyncio.to_thread(
                _write_frame_bytes, event_frame_path, raw_bytes
            )
        await asyncio.to_thread(
            _save_alert_as_message_sync,
            conversation_id,
            matched_description,
            ai_description,
            raw_bytes,
        )
    except Exception:
        logger.exception(
            "Background alert persistence failed for conversation %s",
            conversation_id,
        )


def _save_alert_as_message_sync(
    conversation_id: str,
    matched_description: str,
    ai_description: str,
    raw_bytes: bytes | None,
) -> None:
    """Persist the alert as an assistant message in the conversation so the
    operator can see it when scrolling through the chat history.

    Uses its own short-lived SQLite connection because this runs off the
    request thread.
    """

    now_israel = datetime.now(_ISRAEL_TZ).strftime("%d/%m/%Y %H:%M:%S")

    content = (
        "\u26a0\ufe0f \u05d4\u05ea\u05e8\u05d0\u05d4 \u05d6\u05d5\u05d4\u05ea\u05d4!\n\n"
        f"\U0001f50d \u05e9\u05d5\u05e8\u05ea \u05d4\u05ea\u05e8\u05d0\u05d4: {matched_description}\n"
        f"\U0001f4dd \u05ea\u05d9\u05d0\u05d5\u05e8: {ai_description}\n"
        f"\U0001f550 \u05d6\u05de\u05df: {now_israel}\n"
        "\U0001f4f7 \u05e4\u05e8\u05d9\u05d9\u05dd \u05de\u05e6\u05d5\u05e8\u05e3"
    )

    db = get_db()
    try:
        msg = create_message(db, conversation_id, "assistant", content)
        increment_message_count(db, conversation_id)

        if raw_bytes is not None:
            msg_path, msg_url = _reserve_frame_path(
                conversation_id, prefix="alert-msg"
            )
            if _write_frame_bytes(msg_path, raw_bytes):
                update_message_image_path(db, msg["id"], msg_url)

        logger.info(
            "Saved alert message %s in conversation %s",
            msg["id"],
            conversation_id,
        )
    except Exception:
        logger.exception(
            "Failed to save alert message for conversation %s",
            conversation_id,
        )
    finally:
        db.close()
