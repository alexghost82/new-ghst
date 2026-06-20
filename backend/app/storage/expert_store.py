"""Storage for Ghost Expert advisory reports.

A report holds the structured recommendation set (8 tasks + 8 alerts) produced
at the end of an Expert session, persisted so the in-chat PDF card survives a
refresh and the "set up as drafts" action can materialise it on demand.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.expert")


def _row_to_report(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["applied"] = bool(data.get("applied", 0))
    try:
        data["payload"] = json.loads(data.pop("payload_json", "{}") or "{}")
    except (ValueError, TypeError):
        data["payload"] = {}
    return data


def create_report(
    db: sqlite3.Connection,
    conversation_id: str,
    summary: str,
    payload: dict,
) -> dict:
    report_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO expert_reports "
        "(id, conversation_id, summary, payload_json, message_id, applied, "
        " created_at, updated_at) "
        "VALUES (?, ?, ?, ?, NULL, 0, ?, ?)",
        (report_id, conversation_id, summary, json.dumps(payload, ensure_ascii=False), now, now),
    )
    db.commit()
    logger.info("Created expert report %s for conversation %s", report_id, conversation_id)
    return get_report(db, report_id)  # type: ignore[return-value]


def get_report(db: sqlite3.Connection, report_id: str) -> dict | None:
    row = db.execute(
        "SELECT id, conversation_id, summary, payload_json, message_id, applied, "
        "created_at, updated_at FROM expert_reports WHERE id = ?",
        (report_id,),
    ).fetchone()
    return _row_to_report(row) if row else None


def set_report_message(db: sqlite3.Connection, report_id: str, message_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE expert_reports SET message_id = ?, updated_at = ? WHERE id = ?",
        (message_id, now, report_id),
    )
    db.commit()


def mark_applied(db: sqlite3.Connection, report_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE expert_reports SET applied = 1, updated_at = ? WHERE id = ?",
        (now, report_id),
    )
    db.commit()
