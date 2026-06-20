"""Incident pipeline service.

Translates raw alert events into managed *incidents* and exposes the
operations the operator UI needs (status transitions, assignment,
notes, evidence, AI summary, investigation chat, entity correlation).

Key design notes:

* **Singleton DB connection per call** — every public coroutine opens
  its own short-lived ``sqlite3.Connection`` via ``get_db()``. This
  keeps the function safe to schedule with ``asyncio.create_task`` from
  inside other request handlers without sharing connection state.

* **SSE fan-out** — every state mutation publishes through the existing
  :class:`AlertBroker` with payload type ``incident_event`` (create) or
  ``incident_update`` (status / assign / note / evidence / summary).
  The frontend ``alertStream`` switches on ``type``.

* **AI calls are best-effort** — severity scoring and summary generation
  never raise. If OpenAI fails or returns a refusal-shaped reply, we
  fall back to safe defaults (severity=medium, summary=Ghost-branded
  placeholder).
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Any

from app.services.alert_broker import get_alert_broker
from app.services.openai_client import (
    looks_like_refusal_text,
    score_incident_severity,
    summarize_incident,
)
from app.storage.conversation_store import (
    create_conversation,
    get_conversation,
    update_conversation,
)
from app.storage.database import get_db
from app.storage.incident_store import (
    INCIDENT_SEVERITIES,
    INCIDENT_STATUSES,
    add_evidence,
    add_note,
    append_activity,
    attach_conversation_to_incident,
    create_incident,
    find_merge_candidate,
    get_incident,
    list_activity,
    list_evidence,
    list_notes,
    update_incident_assignment,
    update_incident_fields,
    update_incident_status,
)
from app.storage.user_store import get_user

logger = logging.getLogger("ghost.incident_service")

_ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")

# Window used by the auto-merge heuristic. Aligns with the alert engine's
# 600ms scan rate: 20s covers up to ~33 frames from the same camera so
# duplicate detections fold into a single incident.
MERGE_WINDOW_SECONDS = 20

# Default Ghost-branded fallbacks for refused AI output. Never reference
# OpenAI or other providers.
_GHOST_SEVERITY_FALLBACK_HE = "Ghost לא הצליח לדרג את האירוע אוטומטית."
_GHOST_SEVERITY_FALLBACK_EN = (
    "Ghost couldn't auto-score this incident's severity."
)
_GHOST_SUMMARY_FALLBACK_HE = (
    "Ghost לא הצליח לסכם את האירוע. סקור את ה-timeline ידנית."
)
_GHOST_SUMMARY_FALLBACK_EN = (
    "Ghost couldn't summarise this incident. Review the timeline manually."
)


def _local_time_of_day(iso: str | None = None) -> str:
    try:
        dt = (
            datetime.fromisoformat(iso) if iso else datetime.now(timezone.utc)
        )
    except ValueError:
        dt = datetime.now(timezone.utc)
    return dt.astimezone(_ISRAEL_TZ).strftime("%H:%M")


def _safe_severity_fallback(locale: str) -> str:
    return (
        _GHOST_SEVERITY_FALLBACK_HE
        if locale == "he"
        else _GHOST_SEVERITY_FALLBACK_EN
    )


def _safe_summary_fallback(locale: str) -> str:
    return (
        _GHOST_SUMMARY_FALLBACK_HE
        if locale == "he"
        else _GHOST_SUMMARY_FALLBACK_EN
    )


def _publish_create(user_id: str, incident: dict) -> None:
    try:
        get_alert_broker().publish(
            user_id,
            {"type": "incident_event", "incident": incident},
        )
    except Exception:
        logger.exception(
            "Failed to publish incident_event for incident=%s user=%s",
            incident.get("id"),
            user_id,
        )


def _publish_update(user_id: str, incident_id: str, patch: dict) -> None:
    try:
        get_alert_broker().publish(
            user_id,
            {
                "type": "incident_update",
                "incident_id": incident_id,
                "patch": patch,
            },
        )
    except Exception:
        logger.exception(
            "Failed to publish incident_update for incident=%s user=%s",
            incident_id,
            user_id,
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def create_incident_from_alert(
    *,
    alert_event: dict,
    conversation_id: str,
    user_id: str,
    api_key: str | None,
    camera_label: str | None = None,
    locale: str = "he",
) -> dict | None:
    """Pipeline entry-point: convert an ``alert_events`` row into a managed
    incident, auto-merging duplicates that arrived within
    :data:`MERGE_WINDOW_SECONDS` for the same camera.

    Returns the resulting incident dict (existing if merged, freshly
    created otherwise). Never raises — callers (the alert scan task) must
    keep running on failure.
    """

    if not alert_event or not user_id:
        return None

    matched_rule = (alert_event.get("matched_description") or "").strip()
    ai_description = (alert_event.get("ai_description") or "").strip()
    confidence = alert_event.get("confidence") or "high"
    frame_path = alert_event.get("frame_path")
    created_at = alert_event.get("created_at")

    db = get_db()
    try:
        conv = get_conversation(db, conversation_id)
        camera = camera_label or (conv["title"] if conv else None) or "Unknown"

        # 1) Merge candidate first — silent dedup of bursty alerts.
        existing = find_merge_candidate(
            db,
            user_id=user_id,
            source_camera_label=camera,
            window_seconds=MERGE_WINDOW_SECONDS,
        )
        if existing:
            evidence = add_evidence(
                db,
                incident_id=existing["id"],
                evidence_type="alert",
                image_path=frame_path,
                alert_event_id=alert_event.get("id"),
                metadata={
                    "matched_description": matched_rule,
                    "ai_description": ai_description,
                },
            )
            append_activity(
                db,
                incident_id=existing["id"],
                activity_type="merge",
                actor="system",
                content="duplicate alert merged",
                metadata={
                    "alert_event_id": alert_event.get("id"),
                    "ai_description": ai_description[:300],
                },
            )
            fresh = get_incident(db, existing["id"]) or existing
            _publish_update(
                user_id,
                fresh["id"],
                {"merged_alert_event_id": alert_event.get("id"), "evidence": evidence},
            )
            logger.info(
                "Merged alert %s into incident %s (camera=%s)",
                alert_event.get("id"),
                existing["id"],
                camera,
            )
            return fresh

        # 2) AI severity scoring (best-effort, gpt-4o-mini).
        severity = "medium"
        ai_reasoning = _safe_severity_fallback(locale)
        tags: list[str] = []
        if api_key:
            scored = await score_incident_severity(
                matched_rule=matched_rule,
                ai_description=ai_description,
                camera_label=camera,
                time_of_day=_local_time_of_day(created_at),
                confidence=confidence,
                locale=locale,
                api_key=api_key,
            )
            if scored.get("severity") in INCIDENT_SEVERITIES:
                severity = scored["severity"]
            if scored.get("reasoning"):
                ai_reasoning = scored["reasoning"]
            if scored.get("tags"):
                tags = scored["tags"]

        # 3) Build title — short, factual, falls back to the rule itself.
        title = matched_rule or ai_description[:80] or "Incident"
        if len(title) > 120:
            title = title[:117] + "..."

        incident = create_incident(
            db,
            user_id=user_id,
            title=title,
            conversation_id=None,
            alert_event_id=alert_event.get("id"),
            summary=None,
            status="new",
            severity=severity,
            assigned_to=None,
            source_camera_label=camera,
            preview_image_path=frame_path,
            confidence=confidence,
            ai_reasoning=ai_reasoning,
            tags=tags,
        )

        append_activity(
            db,
            incident_id=incident["id"],
            activity_type="created",
            actor="system",
            content="incident opened from alert",
            metadata={
                "alert_event_id": alert_event.get("id"),
                "matched_description": matched_rule[:300],
                "severity": severity,
                "tags": tags,
            },
        )

        if frame_path:
            add_evidence(
                db,
                incident_id=incident["id"],
                evidence_type="snapshot",
                image_path=frame_path,
                alert_event_id=alert_event.get("id"),
                metadata={"source": "initial_alert"},
            )

        _publish_create(user_id, get_incident(db, incident["id"]) or incident)
        logger.info(
            "Opened incident %s (severity=%s, camera=%s) from alert %s",
            incident["id"],
            severity,
            camera,
            alert_event.get("id"),
        )
        return incident
    except Exception:
        logger.exception(
            "create_incident_from_alert failed for alert=%s user=%s",
            alert_event.get("id"),
            user_id,
        )
        return None
    finally:
        db.close()


def transition_status(
    *,
    incident_id: str,
    user_id: str,
    new_status: str,
    actor: str | None,
) -> dict | None:
    """Synchronous status transition. Returns the refreshed incident."""

    if new_status not in INCIDENT_STATUSES:
        raise ValueError(f"Invalid status: {new_status!r}")

    db = get_db()
    try:
        current = get_incident(db, incident_id, user_id=user_id)
        if not current:
            return None
        updated = update_incident_status(
            db,
            incident_id,
            new_status=new_status,
            actor=actor,
        )
        if updated:
            _publish_update(
                user_id,
                incident_id,
                {
                    "status": updated["status"],
                    "updated_at": updated["updated_at"],
                    "handling_started_at": updated.get("handling_started_at"),
                    "closed_at": updated.get("closed_at"),
                },
            )
        return updated
    finally:
        db.close()


def assign_incident(
    *,
    incident_id: str,
    user_id: str,
    assignee_id: str | None,
    actor: str | None,
) -> dict | None:
    db = get_db()
    try:
        current = get_incident(db, incident_id, user_id=user_id)
        if not current:
            return None
        if assignee_id is not None and not get_user(db, assignee_id):
            raise ValueError(f"Assignee user not found: {assignee_id!r}")
        updated = update_incident_assignment(
            db,
            incident_id,
            assignee_id=assignee_id,
            actor=actor,
        )
        if updated:
            _publish_update(
                user_id,
                incident_id,
                {
                    "assigned_to": updated["assigned_to"],
                    "updated_at": updated["updated_at"],
                },
            )
        return updated
    finally:
        db.close()


def patch_incident(
    *,
    incident_id: str,
    user_id: str,
    actor: str | None,
    status: str | None = None,
    severity: str | None = None,
    tags: list[str] | None = None,
    assigned_to: str | None = None,
    assigned_to_changed: bool = False,
) -> dict | None:
    """Generic PATCH endpoint handler. Applies status/assignment via
    their dedicated functions (so timeline rows fire) and plain fields
    via :func:`update_incident_fields`."""

    db = get_db()
    try:
        current = get_incident(db, incident_id, user_id=user_id)
        if not current:
            return None

        if assigned_to_changed:
            if assigned_to is not None and not get_user(db, assigned_to):
                raise ValueError(
                    f"Assignee user not found: {assigned_to!r}"
                )
            update_incident_assignment(
                db,
                incident_id,
                assignee_id=assigned_to,
                actor=actor,
            )

        if severity is not None or tags is not None:
            update_incident_fields(
                db,
                incident_id,
                severity=severity,
                tags=tags,
            )

        if status is not None and status != current["status"]:
            update_incident_status(
                db,
                incident_id,
                new_status=status,
                actor=actor,
            )

        fresh = get_incident(db, incident_id)
        if fresh:
            _publish_update(
                user_id,
                incident_id,
                {
                    "status": fresh["status"],
                    "severity": fresh["severity"],
                    "assigned_to": fresh["assigned_to"],
                    "tags": fresh["tags"],
                    "updated_at": fresh["updated_at"],
                },
            )
        return fresh
    finally:
        db.close()


def add_incident_note(
    *,
    incident_id: str,
    user_id: str,
    author: str,
    content: str,
) -> dict | None:
    if not content or not content.strip():
        return None
    db = get_db()
    try:
        current = get_incident(db, incident_id, user_id=user_id)
        if not current:
            return None
        note = add_note(
            db,
            incident_id=incident_id,
            author=author,
            content=content.strip(),
        )
        append_activity(
            db,
            incident_id=incident_id,
            activity_type="note",
            actor=author,
            content=content.strip()[:300],
            metadata={"note_id": note["id"]},
        )
        _publish_update(
            user_id,
            incident_id,
            {"note_added": note},
        )
        return note
    finally:
        db.close()


def add_incident_evidence(
    *,
    incident_id: str,
    user_id: str,
    evidence_type: str,
    actor: str,
    image_path: str | None = None,
    observation_id: str | None = None,
    entity_id: str | None = None,
    alert_event_id: str | None = None,
    metadata: dict | None = None,
) -> dict | None:
    db = get_db()
    try:
        current = get_incident(db, incident_id, user_id=user_id)
        if not current:
            return None
        evidence = add_evidence(
            db,
            incident_id=incident_id,
            evidence_type=evidence_type,
            image_path=image_path,
            observation_id=observation_id,
            entity_id=entity_id,
            alert_event_id=alert_event_id,
            metadata=metadata,
        )
        append_activity(
            db,
            incident_id=incident_id,
            activity_type="evidence_added",
            actor=actor,
            content=evidence_type,
            metadata={"evidence_id": evidence["id"]},
        )
        _publish_update(
            user_id,
            incident_id,
            {"evidence_added": evidence},
        )
        return evidence
    finally:
        db.close()


def close_incident(
    *,
    incident_id: str,
    user_id: str,
    actor: str | None,
    resolution: str | None = None,
) -> dict | None:
    """Close an incident.

    When the operator provides a ``resolution`` string, it is persisted
    on three surfaces:

    1. ``incident_events.summary`` so the card and workspace render it.
    2. ``incident_notes`` (prefixed ``[resolution]``) for the activity log.
    3. ``incident_activity`` (already added by ``update_incident_status``).

    The presence of a manual resolution is signalled to the caller via
    the ``manual_resolution`` key on the returned dict so the route
    handler can skip the optional AI-summary background task.
    """

    db = get_db()
    manual_resolution = False
    try:
        current = get_incident(db, incident_id, user_id=user_id)
        if not current:
            return None
        normalised = (resolution or "").strip()
        if normalised:
            manual_resolution = True
            update_incident_fields(db, incident_id, summary=normalised)
            add_note(
                db,
                incident_id=incident_id,
                author=actor,
                content=f"[resolution] {normalised}",
            )
        updated = update_incident_status(
            db,
            incident_id,
            new_status="closed",
            actor=actor,
        )
        if updated:
            _publish_update(
                user_id,
                incident_id,
                {
                    "status": updated["status"],
                    "summary": updated["summary"],
                    "closed_at": updated["closed_at"],
                    "updated_at": updated["updated_at"],
                },
            )
            updated["manual_resolution"] = manual_resolution
        return updated
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Detail eager-loaders
# ---------------------------------------------------------------------------


def fetch_full_incident(
    *,
    incident_id: str,
    user_id: str,
) -> dict | None:
    """Bundle incident row + activity + notes + evidence in one response
    for the workspace drawer."""

    db = get_db()
    try:
        incident = get_incident(db, incident_id, user_id=user_id)
        if not incident:
            return None
        return {
            "incident": incident,
            "timeline": list_activity(db, incident_id),
            "notes": list_notes(db, incident_id),
            "evidence": list_evidence(db, incident_id),
        }
    finally:
        db.close()


def fetch_timeline(
    *, incident_id: str, user_id: str
) -> list[dict] | None:
    db = get_db()
    try:
        if not get_incident(db, incident_id, user_id=user_id):
            return None
        return list_activity(db, incident_id)
    finally:
        db.close()


def fetch_evidence(
    *, incident_id: str, user_id: str
) -> list[dict] | None:
    db = get_db()
    try:
        if not get_incident(db, incident_id, user_id=user_id):
            return None
        return list_evidence(db, incident_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Correlation
# ---------------------------------------------------------------------------


def correlate_entities(
    *, incident_id: str, user_id: str
) -> dict | None:
    """Find recurring people / vehicles seen on the incident's camera in
    a +/- 5 minute window around ``created_at``, plus the union of
    cameras those entities have been seen on (suggested cameras to check).

    Implementation note: visual_entities are scoped per *conversation*,
    but incident conversations are created lazily — so today the most
    useful index is "all entities ever observed on this camera". We
    pull the recent observations for the same camera_label across the
    user's incidents and dedupe by entity_id.
    """

    db = get_db()
    try:
        incident = get_incident(db, incident_id, user_id=user_id)
        if not incident:
            return None

        camera = incident.get("source_camera_label")
        if not camera:
            return {
                "entities": [],
                "suggested_cameras": [],
                "observations": [],
            }

        # Pull observations from every conversation the user owns where
        # the camera_label matches. visual_observations isn't indexed by
        # user_id, so we approximate via the related conversation rows.
        rows = db.execute(
            "SELECT o.id, o.conversation_id, o.message_id, o.entity_id, o.entity_type, "
            "       o.camera_label, o.camera_device_id, o.description, "
            "       o.visual_attributes, o.position_in_frame, o.direction, "
            "       o.activity, o.confidence, o.semantic_tags, o.image_path, "
            "       o.observed_at "
            "FROM visual_observations o "
            "JOIN conversations c ON c.id = o.conversation_id "
            "WHERE c.user_id = ? AND o.camera_label = ? "
            "ORDER BY datetime(o.observed_at) DESC LIMIT 50",
            (user_id, camera),
        ).fetchall()

        observations: list[dict] = []
        entity_ids: set[str] = set()
        suggested_cameras: set[str] = set()

        for row in rows:
            obs = dict(row)
            try:
                obs["visual_attributes"] = (
                    json.loads(obs["visual_attributes"])
                    if obs.get("visual_attributes")
                    else {}
                )
            except (TypeError, ValueError, json.JSONDecodeError):
                obs["visual_attributes"] = {}
            try:
                obs["semantic_tags"] = (
                    json.loads(obs["semantic_tags"])
                    if obs.get("semantic_tags")
                    else []
                )
            except (TypeError, ValueError, json.JSONDecodeError):
                obs["semantic_tags"] = []
            observations.append(obs)
            if obs.get("entity_id"):
                entity_ids.add(obs["entity_id"])

        entities: list[dict] = []
        if entity_ids:
            placeholders = ",".join("?" * len(entity_ids))
            ent_rows = db.execute(
                "SELECT id, conversation_id, entity_type, signature, "
                "       canonical_description, visual_attributes, cameras_seen, "
                "       first_seen, last_seen, times_seen, last_match_confidence "
                "FROM visual_entities "
                f"WHERE id IN ({placeholders}) "
                "ORDER BY datetime(last_seen) DESC",
                list(entity_ids),
            ).fetchall()
            for row in ent_rows:
                ent = dict(row)
                try:
                    ent["visual_attributes"] = (
                        json.loads(ent["visual_attributes"])
                        if ent.get("visual_attributes")
                        else {}
                    )
                except (TypeError, ValueError, json.JSONDecodeError):
                    ent["visual_attributes"] = {}
                try:
                    cameras = (
                        json.loads(ent["cameras_seen"])
                        if ent.get("cameras_seen")
                        else []
                    )
                except (TypeError, ValueError, json.JSONDecodeError):
                    cameras = []
                ent["cameras_seen"] = cameras
                entities.append(ent)
                for cam in cameras:
                    if cam and cam != camera:
                        suggested_cameras.add(cam)

        return {
            "entities": entities,
            "suggested_cameras": sorted(suggested_cameras),
            "observations": observations[:20],
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# AI summary
# ---------------------------------------------------------------------------


async def generate_incident_summary(
    *,
    incident_id: str,
    user_id: str,
    api_key: str | None,
    locale: str = "he",
) -> dict | None:
    """Build a textual debrief and persist it on the incident row."""

    db = get_db()
    try:
        incident = get_incident(db, incident_id, user_id=user_id)
        if not incident:
            return None
        timeline = list_activity(db, incident_id)
        notes = list_notes(db, incident_id)
        evidence = list_evidence(db, incident_id)
    finally:
        db.close()

    context = {
        "incident": {
            "title": incident["title"],
            "severity": incident["severity"],
            "status": incident["status"],
            "source_camera": incident["source_camera_label"],
            "created_at": incident["created_at"],
            "closed_at": incident.get("closed_at"),
            "ai_reasoning": incident.get("ai_reasoning"),
            "tags": incident.get("tags") or [],
        },
        "timeline": [
            {
                "type": t["type"],
                "actor": t.get("actor"),
                "content": t.get("content"),
                "created_at": t["created_at"],
            }
            for t in timeline
        ][:60],
        "notes": [
            {
                "author": n.get("author"),
                "content": n.get("content"),
                "created_at": n.get("created_at"),
            }
            for n in notes
        ][:30],
        "evidence": [
            {
                "type": e.get("type"),
                "created_at": e.get("created_at"),
                "metadata": e.get("metadata"),
            }
            for e in evidence
        ][:40],
    }

    summary_text = _safe_summary_fallback(locale)
    key_observations: list[str] = []

    if api_key:
        result = await summarize_incident(
            context=context, locale=locale, api_key=api_key
        )
        if result.get("summary") and not looks_like_refusal_text(
            result["summary"]
        ):
            summary_text = result["summary"]
        key_observations = result.get("key_observations") or []

    db = get_db()
    try:
        update_incident_fields(db, incident_id, summary=summary_text)
        append_activity(
            db,
            incident_id=incident_id,
            activity_type="ai_summary",
            actor="system",
            content=summary_text[:300],
            metadata={"key_observations": key_observations},
        )
    finally:
        db.close()

    payload = {
        "summary": summary_text,
        "key_observations": key_observations,
    }
    _publish_update(user_id, incident_id, {"summary": summary_text})
    return payload


# ---------------------------------------------------------------------------
# Investigation chat
# ---------------------------------------------------------------------------


_INVESTIGATION_SYSTEM_PROMPT_HE = """\
אתה Ghost — מנוע חקירה אופרטיבי לאירוע אבטחה ספציפי.

אירוע: {title}
מקור: מצלמת {camera}
זמן פתיחה (UTC): {created_at}
חומרה: {severity}
תיאור AI מקורי: {ai_reasoning}
תיוגים: {tags}

תפקידך:
- לעזור למפעיל לחקור את האירוע: למצוא את אותו אדם/רכב במצלמות נוספות,
  לזהות תבניות, לחבר עם תצפיות קודמות מ-Visual Memory.
- לענות עברית, קצר ומדויק, ללא נימוסי AI גנריים.
- לעולם לא לסרב — אם המידע חלקי, אמור מה ידוע ומה חסר.
"""

_INVESTIGATION_SYSTEM_PROMPT_EN = """\
You are Ghost — the operational investigation engine for a single \
security incident.

Incident: {title}
Source: camera {camera}
Opened at (UTC): {created_at}
Severity: {severity}
Initial AI assessment: {ai_reasoning}
Tags: {tags}

Your job:
- Help the operator investigate: locate the same person/vehicle on \
  other cameras, find patterns, link with Visual Memory observations.
- Answer in English, brief and factual. No generic AI disclaimers.
- Never refuse — if information is partial, state what is known and \
  what is missing.
"""


def _build_investigation_system_prompt(
    incident: dict, locale: str
) -> str:
    tmpl = (
        _INVESTIGATION_SYSTEM_PROMPT_HE
        if locale == "he"
        else _INVESTIGATION_SYSTEM_PROMPT_EN
    )
    return tmpl.format(
        title=incident.get("title") or "",
        camera=incident.get("source_camera_label") or "(unspecified)",
        created_at=incident.get("created_at") or "",
        severity=incident.get("severity") or "medium",
        ai_reasoning=(incident.get("ai_reasoning") or "(none)")[:600],
        tags=", ".join(incident.get("tags") or []) or "(none)",
    )


def ensure_investigation_conversation(
    *,
    incident_id: str,
    user_id: str,
    locale: str = "he",
) -> dict | None:
    """Lazily create the conversation that backs the per-incident
    investigation chat. Returns ``{incident_id, conversation_id, created}``.

    Idempotent: a second call returns the same conversation, and the
    system prompt is refreshed if the incident metadata changed."""

    db = get_db()
    try:
        incident = get_incident(db, incident_id, user_id=user_id)
        if not incident:
            return None

        title_prefix = "חקירה" if locale == "he" else "Investigation"
        title = f"{title_prefix}: {(incident.get('title') or '').strip()[:80]}"
        system_prompt = _build_investigation_system_prompt(incident, locale)

        existing_conv_id = incident.get("conversation_id")
        if existing_conv_id:
            existing = get_conversation(db, existing_conv_id, user_id=user_id)
            if existing:
                update_conversation(
                    db,
                    existing_conv_id,
                    system_prompt=system_prompt,
                )
                return {
                    "incident_id": incident_id,
                    "conversation_id": existing_conv_id,
                    "created": False,
                }

        conv = create_conversation(
            db,
            user_id=user_id,
            title=title,
            system_prompt=system_prompt,
            title_source="manual",
        )
        attach_conversation_to_incident(db, incident_id, conv["id"])
        append_activity(
            db,
            incident_id=incident_id,
            activity_type="investigation_started",
            actor=user_id,
            content="investigation chat opened",
            metadata={"conversation_id": conv["id"]},
        )
        _publish_update(
            user_id,
            incident_id,
            {"conversation_id": conv["id"]},
        )
        return {
            "incident_id": incident_id,
            "conversation_id": conv["id"],
            "created": True,
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# KPI helper passthrough
# ---------------------------------------------------------------------------


def fetch_kpi(
    *, user_id: str, window_hours: int = 24
) -> dict:
    db = get_db()
    try:
        from app.storage.incident_store import get_kpi_stats

        return get_kpi_stats(db, user_id, window_hours=window_hours)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Background scheduling helper
# ---------------------------------------------------------------------------


def schedule_summary(
    *,
    incident_id: str,
    user_id: str,
    api_key: str | None,
    locale: str = "he",
) -> asyncio.Task[Any] | None:
    """Fire-and-forget summary generation. Used when closing an
    incident so the operator gets a debrief without blocking the close
    request."""

    if not api_key:
        return None
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return None
    return loop.create_task(
        generate_incident_summary(
            incident_id=incident_id,
            user_id=user_id,
            api_key=api_key,
            locale=locale,
        )
    )
