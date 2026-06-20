from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.alert")


def _row_to_rule(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["is_active"] = bool(data.get("is_active", 0))
    return data


def _row_to_event(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["acknowledged"] = bool(data.get("acknowledged", 0))
    return data


def list_rules(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    # source='task' rows are hidden shadow rules backing task triggers; they
    # must never surface in the alerts panel or the scan loop.
    rows = db.execute(
        "SELECT id, conversation_id, description, is_active, created_at, updated_at "
        "FROM alert_rules WHERE conversation_id = ? AND source = 'manual' "
        "ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    return [_row_to_rule(r) for r in rows]


def list_active_rules(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, description, is_active, created_at, updated_at "
        "FROM alert_rules WHERE conversation_id = ? AND is_active = 1 "
        "AND source = 'manual' ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    return [_row_to_rule(r) for r in rows]


def get_rule(db: sqlite3.Connection, rule_id: str) -> dict | None:
    row = db.execute(
        "SELECT id, conversation_id, description, is_active, created_at, updated_at "
        "FROM alert_rules WHERE id = ?",
        (rule_id,),
    ).fetchone()
    return _row_to_rule(row) if row else None


def create_rule(
    db: sqlite3.Connection, conversation_id: str, description: str
) -> dict:
    rule_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO alert_rules "
        "(id, conversation_id, description, is_active, created_at, updated_at) "
        "VALUES (?, ?, ?, 1, ?, ?)",
        (rule_id, conversation_id, description, now, now),
    )
    db.commit()
    logger.info("Created alert rule %s for conversation %s", rule_id, conversation_id)
    return {
        "id": rule_id,
        "conversation_id": conversation_id,
        "description": description,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def update_rule(
    db: sqlite3.Connection,
    rule_id: str,
    description: str | None = None,
    is_active: bool | None = None,
) -> dict | None:
    updates: list[str] = []
    params: list = []
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)
    if not updates:
        return get_rule(db, rule_id)

    now = datetime.now(timezone.utc).isoformat()
    updates.append("updated_at = ?")
    params.append(now)
    params.append(rule_id)
    db.execute(
        f"UPDATE alert_rules SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    db.commit()
    return get_rule(db, rule_id)


def delete_rule(db: sqlite3.Connection, rule_id: str) -> bool:
    cursor = db.execute("DELETE FROM alert_rules WHERE id = ?", (rule_id,))
    db.commit()
    return cursor.rowcount > 0


def set_alert_mode(
    db: sqlite3.Connection, conversation_id: str, enabled: bool
) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.execute(
        "UPDATE conversations SET alert_mode_enabled = ?, updated_at = ? "
        "WHERE id = ?",
        (1 if enabled else 0, now, conversation_id),
    )
    db.commit()
    return cursor.rowcount > 0


def get_alert_mode(db: sqlite3.Connection, conversation_id: str) -> bool:
    row = db.execute(
        "SELECT alert_mode_enabled FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    if not row:
        return False
    return bool(row["alert_mode_enabled"])


def create_event(
    db: sqlite3.Connection,
    conversation_id: str,
    rule_id: str,
    matched_description: str,
    ai_description: str,
    frame_path: str | None = None,
    confidence: str = "high",
    source: str = "camera",
    task_id: str | None = None,
    trigger_id: str | None = None,
) -> dict:
    event_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO alert_events "
        "(id, conversation_id, rule_id, matched_description, ai_description, "
        " frame_path, confidence, acknowledged, created_at, source, task_id, "
        " trigger_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)",
        (
            event_id,
            conversation_id,
            rule_id,
            matched_description,
            ai_description,
            frame_path,
            confidence,
            now,
            source,
            task_id,
            trigger_id,
        ),
    )
    db.commit()
    logger.info(
        "Created alert event %s for conversation %s (rule=%s, source=%s)",
        event_id,
        conversation_id,
        rule_id,
        source,
    )
    return {
        "id": event_id,
        "conversation_id": conversation_id,
        "rule_id": rule_id,
        "matched_description": matched_description,
        "ai_description": ai_description,
        "frame_path": frame_path,
        "confidence": confidence,
        "acknowledged": False,
        "created_at": now,
        "source": source,
        "task_id": task_id,
        "trigger_id": trigger_id,
    }


def list_events(
    db: sqlite3.Connection, conversation_id: str, limit: int = 50
) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, rule_id, matched_description, ai_description, "
        "       frame_path, confidence, acknowledged, created_at, source, "
        "       task_id, trigger_id "
        "FROM alert_events WHERE conversation_id = ? "
        "ORDER BY created_at DESC LIMIT ?",
        (conversation_id, max(1, min(limit, 500))),
    ).fetchall()
    return [_row_to_event(r) for r in rows]


def get_event(db: sqlite3.Connection, event_id: str) -> dict | None:
    row = db.execute(
        "SELECT id, conversation_id, rule_id, matched_description, ai_description, "
        "       frame_path, confidence, acknowledged, created_at, source, "
        "       task_id, trigger_id "
        "FROM alert_events WHERE id = ?",
        (event_id,),
    ).fetchone()
    return _row_to_event(row) if row else None


def acknowledge_event(db: sqlite3.Connection, event_id: str) -> dict | None:
    cursor = db.execute(
        "UPDATE alert_events SET acknowledged = 1 WHERE id = ?",
        (event_id,),
    )
    db.commit()
    if cursor.rowcount == 0:
        return None
    return get_event(db, event_id)


def list_alert_mode_conversations(
    db: sqlite3.Connection, user_id: str
) -> list[dict]:
    rows = db.execute(
        "SELECT id, title FROM conversations "
        "WHERE user_id = ? AND alert_mode_enabled = 1",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]
