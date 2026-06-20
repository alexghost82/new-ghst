"""SQLite Repository for incident pipeline tables.

Mirrors the structural conventions used elsewhere in ``app/storage``
(``_row_to_*`` helpers, JSON-encoded list/dict columns, explicit
``commit`` per write). All access is synchronous and short-lived — each
function expects an open ``sqlite3.Connection`` provided by the route
handler and never tries to close it.

Schema lives in ``migrations/008_incident_management.sql``. The four
tables involved are::

    incident_events    (one row per managed incident)
    incident_activity  (timeline entries — append only)
    incident_notes     (free-form notes from operators)
    incident_evidence  (snapshots / observations / entity refs)

Status transitions and activity bookkeeping are implemented at the
service layer (``services/incident_service.py``). This file only knows
how to read and write rows.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from uuid import uuid4

logger = logging.getLogger("ghost.store.incident")

# Allowed enum values — kept here (not just at the DB CHECK level) so the
# service layer can validate before issuing the UPDATE and surface a 4xx
# instead of a 500 on a constraint violation.
INCIDENT_STATUSES = ("new", "handling", "investigation", "closed")
INCIDENT_SEVERITIES = ("low", "medium", "high", "critical")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dump_json(value: Any) -> str:
    if value is None:
        return "[]" if isinstance(value, list) else "{}"
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return "[]" if isinstance(value, list) else "{}"


def _parse_json(raw: Any, default: Any) -> Any:
    if raw is None:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return default


def _row_to_incident(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["tags"] = _parse_json(item.get("tags"), [])
    return item


def _row_to_activity(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["metadata"] = _parse_json(item.get("metadata_json"), {})
    item.pop("metadata_json", None)
    return item


def _row_to_note(row: sqlite3.Row) -> dict:
    return dict(row)


def _row_to_evidence(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["metadata"] = _parse_json(item.get("metadata_json"), {})
    item.pop("metadata_json", None)
    return item


# ---------------------------------------------------------------------------
# incident_events
# ---------------------------------------------------------------------------

_INCIDENT_COLS = (
    "id, user_id, conversation_id, alert_event_id, title, summary, "
    "status, severity, assigned_to, source_camera_label, preview_image_path, "
    "confidence, ai_reasoning, tags, handling_started_at, "
    "created_at, updated_at, closed_at"
)


def create_incident(
    db: sqlite3.Connection,
    *,
    user_id: str,
    title: str,
    conversation_id: str | None = None,
    alert_event_id: str | None = None,
    summary: str | None = None,
    status: str = "new",
    severity: str = "medium",
    assigned_to: str | None = None,
    source_camera_label: str | None = None,
    preview_image_path: str | None = None,
    confidence: str | None = None,
    ai_reasoning: str | None = None,
    tags: Iterable[str] | None = None,
) -> dict:
    """Insert a new incident row and return the eager-loaded dict."""

    if status not in INCIDENT_STATUSES:
        raise ValueError(f"Invalid incident status: {status!r}")
    if severity not in INCIDENT_SEVERITIES:
        raise ValueError(f"Invalid incident severity: {severity!r}")

    incident_id = uuid4().hex
    now = _now_iso()
    tags_list = list(tags or [])

    db.execute(
        f"INSERT INTO incident_events ({_INCIDENT_COLS}) VALUES ("
        "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        ")",
        (
            incident_id,
            user_id,
            conversation_id,
            alert_event_id,
            title,
            summary,
            status,
            severity,
            assigned_to,
            source_camera_label,
            preview_image_path,
            confidence,
            ai_reasoning,
            _dump_json(tags_list),
            None,
            now,
            now,
            None,
        ),
    )
    db.commit()
    logger.info(
        "Created incident %s for user=%s (severity=%s, camera=%s)",
        incident_id,
        user_id,
        severity,
        source_camera_label,
    )
    return {
        "id": incident_id,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "alert_event_id": alert_event_id,
        "title": title,
        "summary": summary,
        "status": status,
        "severity": severity,
        "assigned_to": assigned_to,
        "source_camera_label": source_camera_label,
        "preview_image_path": preview_image_path,
        "confidence": confidence,
        "ai_reasoning": ai_reasoning,
        "tags": tags_list,
        "handling_started_at": None,
        "created_at": now,
        "updated_at": now,
        "closed_at": None,
    }


def get_incident(
    db: sqlite3.Connection,
    incident_id: str,
    user_id: str | None = None,
) -> dict | None:
    """Fetch one incident. When ``user_id`` is given the row is also
    scoped to that user — protects against cross-user lookups."""

    if user_id:
        row = db.execute(
            f"SELECT {_INCIDENT_COLS} FROM incident_events "
            "WHERE id = ? AND user_id = ?",
            (incident_id, user_id),
        ).fetchone()
    else:
        row = db.execute(
            f"SELECT {_INCIDENT_COLS} FROM incident_events WHERE id = ?",
            (incident_id,),
        ).fetchone()
    return _row_to_incident(row) if row else None


def list_incidents(
    db: sqlite3.Connection,
    user_id: str,
    *,
    status: str | None = None,
    severity: str | None = None,
    assigned_to: str | None = None,
    search: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict]:
    """Search incidents for a user with optional filters.

    Results are ordered by ``created_at DESC`` — which is what the board
    expects when stacking cards within a column.
    """

    where = ["user_id = ?"]
    params: list[Any] = [user_id]

    if status:
        if status not in INCIDENT_STATUSES:
            raise ValueError(f"Invalid incident status: {status!r}")
        where.append("status = ?")
        params.append(status)
    if severity:
        if severity not in INCIDENT_SEVERITIES:
            raise ValueError(f"Invalid incident severity: {severity!r}")
        where.append("severity = ?")
        params.append(severity)
    if assigned_to:
        where.append("assigned_to = ?")
        params.append(assigned_to)
    if search:
        like = f"%{search.lower()}%"
        where.append(
            "(LOWER(title) LIKE ? OR LOWER(summary) LIKE ? "
            "OR LOWER(ai_reasoning) LIKE ? OR LOWER(source_camera_label) LIKE ?)"
        )
        params.extend([like, like, like, like])

    sql = (
        f"SELECT {_INCIDENT_COLS} FROM incident_events "
        f"WHERE {' AND '.join(where)} "
        "ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?"
    )
    params.extend([max(1, min(int(limit), 1000)), max(0, int(offset))])

    rows = db.execute(sql, params).fetchall()
    return [_row_to_incident(r) for r in rows]


def update_incident_fields(
    db: sqlite3.Connection,
    incident_id: str,
    *,
    title: str | None = None,
    summary: str | None = None,
    severity: str | None = None,
    tags: Iterable[str] | None = None,
    ai_reasoning: str | None = None,
    preview_image_path: str | None = None,
    confidence: str | None = None,
) -> dict | None:
    """Generic patch for editable fields (status + assignment have
    dedicated functions because they also emit activity rows)."""

    updates: list[str] = []
    params: list[Any] = []

    if title is not None:
        updates.append("title = ?")
        params.append(title)
    if summary is not None:
        updates.append("summary = ?")
        params.append(summary)
    if severity is not None:
        if severity not in INCIDENT_SEVERITIES:
            raise ValueError(f"Invalid incident severity: {severity!r}")
        updates.append("severity = ?")
        params.append(severity)
    if tags is not None:
        updates.append("tags = ?")
        params.append(_dump_json(list(tags)))
    if ai_reasoning is not None:
        updates.append("ai_reasoning = ?")
        params.append(ai_reasoning)
    if preview_image_path is not None:
        updates.append("preview_image_path = ?")
        params.append(preview_image_path)
    if confidence is not None:
        updates.append("confidence = ?")
        params.append(confidence)

    if not updates:
        return get_incident(db, incident_id)

    now = _now_iso()
    updates.append("updated_at = ?")
    params.append(now)
    params.append(incident_id)

    db.execute(
        f"UPDATE incident_events SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    db.commit()
    return get_incident(db, incident_id)


def update_incident_status(
    db: sqlite3.Connection,
    incident_id: str,
    *,
    new_status: str,
    actor: str | None = None,
) -> dict | None:
    """Transition status + write a matching ``incident_activity`` row in
    one logical operation (single ``commit``)."""

    if new_status not in INCIDENT_STATUSES:
        raise ValueError(f"Invalid status transition target: {new_status!r}")

    current = get_incident(db, incident_id)
    if not current:
        return None

    previous = current["status"]
    if previous == new_status:
        return current

    now = _now_iso()
    handling_started_at = current.get("handling_started_at")
    closed_at = current.get("closed_at")
    if new_status == "handling" and not handling_started_at:
        handling_started_at = now
    if new_status == "closed":
        closed_at = closed_at or now

    db.execute(
        "UPDATE incident_events SET status = ?, updated_at = ?, "
        "handling_started_at = ?, closed_at = ? WHERE id = ?",
        (new_status, now, handling_started_at, closed_at, incident_id),
    )
    db.execute(
        "INSERT INTO incident_activity (id, incident_id, type, actor, content, metadata_json, created_at) "
        "VALUES (?, ?, 'status_changed', ?, ?, ?, ?)",
        (
            uuid4().hex,
            incident_id,
            actor,
            f"{previous} -> {new_status}",
            _dump_json({"from": previous, "to": new_status}),
            now,
        ),
    )
    db.commit()
    return get_incident(db, incident_id)


def update_incident_assignment(
    db: sqlite3.Connection,
    incident_id: str,
    *,
    assignee_id: str | None,
    actor: str | None = None,
) -> dict | None:
    """Set ``assigned_to`` and append a timeline entry."""

    current = get_incident(db, incident_id)
    if not current:
        return None

    previous = current.get("assigned_to")
    if previous == assignee_id:
        return current

    now = _now_iso()
    db.execute(
        "UPDATE incident_events SET assigned_to = ?, updated_at = ? WHERE id = ?",
        (assignee_id, now, incident_id),
    )
    db.execute(
        "INSERT INTO incident_activity (id, incident_id, type, actor, content, metadata_json, created_at) "
        "VALUES (?, ?, 'assigned', ?, ?, ?, ?)",
        (
            uuid4().hex,
            incident_id,
            actor,
            assignee_id or "",
            _dump_json({"from": previous, "to": assignee_id}),
            now,
        ),
    )
    db.commit()
    return get_incident(db, incident_id)


def attach_conversation_to_incident(
    db: sqlite3.Connection,
    incident_id: str,
    conversation_id: str,
) -> None:
    """Set the bidirectional pointer used by the investigation chat:
    ``incident_events.conversation_id`` + ``conversations.incident_id``.

    Both rows are written in one commit so the pair never diverges."""

    now = _now_iso()
    db.execute(
        "UPDATE incident_events SET conversation_id = ?, updated_at = ? WHERE id = ?",
        (conversation_id, now, incident_id),
    )
    db.execute(
        "UPDATE conversations SET incident_id = ?, updated_at = ? WHERE id = ?",
        (incident_id, now, conversation_id),
    )
    db.commit()


# ---------------------------------------------------------------------------
# incident_activity
# ---------------------------------------------------------------------------


def append_activity(
    db: sqlite3.Connection,
    *,
    incident_id: str,
    activity_type: str,
    actor: str | None = None,
    content: str | None = None,
    metadata: dict | None = None,
) -> dict:
    activity_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO incident_activity "
        "(id, incident_id, type, actor, content, metadata_json, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            activity_id,
            incident_id,
            activity_type,
            actor,
            content,
            _dump_json(metadata or {}),
            now,
        ),
    )
    db.commit()
    return {
        "id": activity_id,
        "incident_id": incident_id,
        "type": activity_type,
        "actor": actor,
        "content": content,
        "metadata": metadata or {},
        "created_at": now,
    }


def list_activity(
    db: sqlite3.Connection, incident_id: str, limit: int = 500
) -> list[dict]:
    rows = db.execute(
        "SELECT id, incident_id, type, actor, content, metadata_json, created_at "
        "FROM incident_activity WHERE incident_id = ? "
        "ORDER BY datetime(created_at) ASC LIMIT ?",
        (incident_id, max(1, min(int(limit), 2000))),
    ).fetchall()
    return [_row_to_activity(r) for r in rows]


# ---------------------------------------------------------------------------
# incident_notes
# ---------------------------------------------------------------------------


def add_note(
    db: sqlite3.Connection,
    *,
    incident_id: str,
    author: str | None,
    content: str,
) -> dict:
    note_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO incident_notes (id, incident_id, author, content, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (note_id, incident_id, author, content, now),
    )
    db.commit()
    return {
        "id": note_id,
        "incident_id": incident_id,
        "author": author,
        "content": content,
        "created_at": now,
    }


def list_notes(
    db: sqlite3.Connection, incident_id: str, limit: int = 500
) -> list[dict]:
    rows = db.execute(
        "SELECT id, incident_id, author, content, created_at "
        "FROM incident_notes WHERE incident_id = ? "
        "ORDER BY datetime(created_at) ASC LIMIT ?",
        (incident_id, max(1, min(int(limit), 2000))),
    ).fetchall()
    return [_row_to_note(r) for r in rows]


# ---------------------------------------------------------------------------
# incident_evidence
# ---------------------------------------------------------------------------


def add_evidence(
    db: sqlite3.Connection,
    *,
    incident_id: str,
    evidence_type: str,
    image_path: str | None = None,
    observation_id: str | None = None,
    entity_id: str | None = None,
    alert_event_id: str | None = None,
    metadata: dict | None = None,
) -> dict:
    evidence_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO incident_evidence ("
        " id, incident_id, type, image_path, observation_id, entity_id, "
        " alert_event_id, metadata_json, created_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            evidence_id,
            incident_id,
            evidence_type,
            image_path,
            observation_id,
            entity_id,
            alert_event_id,
            _dump_json(metadata or {}),
            now,
        ),
    )
    db.commit()
    return {
        "id": evidence_id,
        "incident_id": incident_id,
        "type": evidence_type,
        "image_path": image_path,
        "observation_id": observation_id,
        "entity_id": entity_id,
        "alert_event_id": alert_event_id,
        "metadata": metadata or {},
        "created_at": now,
    }


def list_evidence(
    db: sqlite3.Connection, incident_id: str, limit: int = 500
) -> list[dict]:
    rows = db.execute(
        "SELECT id, incident_id, type, image_path, observation_id, entity_id, "
        "       alert_event_id, metadata_json, created_at "
        "FROM incident_evidence WHERE incident_id = ? "
        "ORDER BY datetime(created_at) ASC LIMIT ?",
        (incident_id, max(1, min(int(limit), 2000))),
    ).fetchall()
    return [_row_to_evidence(r) for r in rows]


# ---------------------------------------------------------------------------
# Merge candidate lookup
# ---------------------------------------------------------------------------


def find_merge_candidate(
    db: sqlite3.Connection,
    *,
    user_id: str,
    source_camera_label: str | None,
    window_seconds: int = 20,
) -> dict | None:
    """Find an open (new/handling) incident on the same camera within
    the last ``window_seconds`` — used by auto-merge to fold rapid
    duplicate alerts into a single timeline entry."""

    if not source_camera_label:
        return None

    cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=max(1, window_seconds))
    ).isoformat()

    row = db.execute(
        f"SELECT {_INCIDENT_COLS} FROM incident_events "
        "WHERE user_id = ? AND source_camera_label = ? "
        "  AND status IN ('new','handling') "
        "  AND datetime(created_at) >= datetime(?) "
        "ORDER BY datetime(created_at) DESC LIMIT 1",
        (user_id, source_camera_label, cutoff),
    ).fetchone()
    return _row_to_incident(row) if row else None


# ---------------------------------------------------------------------------
# KPI stats
# ---------------------------------------------------------------------------


def get_kpi_stats(
    db: sqlite3.Connection, user_id: str, window_hours: int = 24
) -> dict:
    """Aggregate KPIs for the operator dashboard.

    The window applies to ``created_at``: incidents that were *opened*
    in the lookback window. Times are computed in seconds for ease of
    formatting on the frontend.
    """

    cutoff = (
        datetime.now(timezone.utc)
        - timedelta(hours=max(1, int(window_hours)))
    ).isoformat()

    base_where = "user_id = ? AND datetime(created_at) >= datetime(?)"
    base_params = (user_id, cutoff)

    total_row = db.execute(
        f"SELECT COUNT(*) AS total FROM incident_events WHERE {base_where}",
        base_params,
    ).fetchone()

    critical_row = db.execute(
        f"SELECT COUNT(*) AS c FROM incident_events "
        f"WHERE {base_where} AND severity = 'critical'",
        base_params,
    ).fetchone()

    # avg seconds from created_at -> handling_started_at
    handle_row = db.execute(
        "SELECT AVG((julianday(handling_started_at) - julianday(created_at)) * 86400.0) AS s "
        f"FROM incident_events WHERE {base_where} "
        "  AND handling_started_at IS NOT NULL",
        base_params,
    ).fetchone()

    close_row = db.execute(
        "SELECT AVG((julianday(closed_at) - julianday(created_at)) * 86400.0) AS s "
        f"FROM incident_events WHERE {base_where} "
        "  AND closed_at IS NOT NULL",
        base_params,
    ).fetchone()

    cameras_rows = db.execute(
        "SELECT source_camera_label AS label, COUNT(*) AS count "
        f"FROM incident_events WHERE {base_where} "
        "  AND source_camera_label IS NOT NULL "
        "GROUP BY source_camera_label "
        "ORDER BY count DESC LIMIT 5",
        base_params,
    ).fetchall()

    status_rows = db.execute(
        "SELECT status, COUNT(*) AS count FROM incident_events "
        f"WHERE {base_where} GROUP BY status",
        base_params,
    ).fetchall()

    return {
        "window_hours": int(window_hours),
        "total": int(total_row["total"] if total_row else 0),
        "critical_count": int(critical_row["c"] if critical_row else 0),
        "avg_time_to_handle_sec": float(handle_row["s"]) if handle_row and handle_row["s"] is not None else 0.0,
        "avg_time_to_close_sec": float(close_row["s"]) if close_row and close_row["s"] is not None else 0.0,
        "hot_cameras": [
            {"label": r["label"], "count": int(r["count"])} for r in cameras_rows
        ],
        "by_status": {
            r["status"]: int(r["count"]) for r in status_rows
        },
    }
