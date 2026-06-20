"""Storage layer for conversational automation drafts.

A draft is the staging record produced when an operator describes an alert or
a task in free language from the composer. The model's extracted fields are
held here as ``payload_json`` until the operator reviews, optionally edits, and
confirms — at which point :mod:`automation_service` materialises the draft into
the existing ``alert_rules`` / ``scheduled_tasks`` pipelines.

Follows the same conventions as :mod:`task_store` — plain functions over a
caller-supplied ``sqlite3.Connection``, short transactions, dict rows.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.automation")

_DRAFT_COLUMNS = (
    "id, conversation_id, kind, status, payload_json, source_text, "
    "message_id, created_task_id, created_rule_id, activated, "
    "created_at, updated_at"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_draft(row: sqlite3.Row) -> dict:
    data = dict(row)
    raw = data.pop("payload_json", "{}") or "{}"
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        payload = {}
    data["payload"] = payload if isinstance(payload, dict) else {}
    data["activated"] = bool(data.get("activated", 0))
    return data


def create_draft(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    kind: str,
    payload: dict,
    source_text: str = "",
    message_id: str | None = None,
) -> dict:
    draft_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO automation_drafts "
        "(id, conversation_id, kind, status, payload_json, source_text, "
        " message_id, created_task_id, created_rule_id, activated, "
        " created_at, updated_at) "
        "VALUES (?, ?, ?, 'draft', ?, ?, ?, NULL, NULL, 0, ?, ?)",
        (
            draft_id,
            conversation_id,
            kind,
            json.dumps(payload, ensure_ascii=False),
            source_text,
            message_id,
            now,
            now,
        ),
    )
    db.commit()
    logger.info(
        "Created automation draft %s (kind=%s conversation=%s)",
        draft_id,
        kind,
        conversation_id,
    )
    return get_draft(db, draft_id)  # type: ignore[return-value]


def get_draft(db: sqlite3.Connection, draft_id: str) -> dict | None:
    row = db.execute(
        f"SELECT {_DRAFT_COLUMNS} FROM automation_drafts WHERE id = ?",
        (draft_id,),
    ).fetchone()
    return _row_to_draft(row) if row else None


def list_drafts(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    rows = db.execute(
        f"SELECT {_DRAFT_COLUMNS} FROM automation_drafts "
        "WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    return [_row_to_draft(r) for r in rows]


def set_draft_message(
    db: sqlite3.Connection, draft_id: str, message_id: str
) -> None:
    db.execute(
        "UPDATE automation_drafts SET message_id = ?, updated_at = ? "
        "WHERE id = ?",
        (message_id, _now_iso(), draft_id),
    )
    db.commit()


def update_draft_payload(
    db: sqlite3.Connection, draft_id: str, payload: dict
) -> dict | None:
    existing = get_draft(db, draft_id)
    if not existing:
        return None
    db.execute(
        "UPDATE automation_drafts SET payload_json = ?, updated_at = ? "
        "WHERE id = ?",
        (json.dumps(payload, ensure_ascii=False), _now_iso(), draft_id),
    )
    db.commit()
    return get_draft(db, draft_id)


def set_draft_status(
    db: sqlite3.Connection,
    draft_id: str,
    status: str,
    *,
    created_task_id: str | None = None,
    created_rule_id: str | None = None,
    activated: bool | None = None,
) -> dict | None:
    existing = get_draft(db, draft_id)
    if not existing:
        return None
    updates = ["status = ?"]
    params: list = [status]
    if created_task_id is not None:
        updates.append("created_task_id = ?")
        params.append(created_task_id)
    if created_rule_id is not None:
        updates.append("created_rule_id = ?")
        params.append(created_rule_id)
    if activated is not None:
        updates.append("activated = ?")
        params.append(1 if activated else 0)
    updates.append("updated_at = ?")
    params.append(_now_iso())
    params.append(draft_id)
    db.execute(
        f"UPDATE automation_drafts SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    db.commit()
    return get_draft(db, draft_id)
