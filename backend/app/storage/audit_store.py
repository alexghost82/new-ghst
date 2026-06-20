"""Append-only audit log persistence for the admin panel.

Every sensitive admin action lands here: who did it, to whom, what changed
(before/after), from which IP/device, and whether it succeeded. Reads power the
Logs screen with filtering. Writes are best-effort by design (see
``audit_service.record``) so a logging failure never blocks the action itself.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.audit")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dump(value) -> str | None:
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:  # noqa: BLE001
        return None


def insert_audit(
    db: sqlite3.Connection,
    *,
    action: str,
    actor_admin_id: str | None = None,
    actor_label: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    status: str = "success",
    reason: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> str:
    entry_id = uuid4().hex
    db.execute(
        """
        INSERT INTO audit_log
            (id, actor_admin_id, actor_label, action, target_type, target_id,
             status, reason, before_json, after_json, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id,
            actor_admin_id,
            actor_label,
            action,
            target_type,
            target_id,
            status,
            reason,
            _dump(before),
            _dump(after),
            ip,
            user_agent,
            _now(),
        ),
    )
    db.commit()
    return entry_id


def list_audit(
    db: sqlite3.Connection,
    *,
    action: str | None = None,
    actor_admin_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    where, params = ["1=1"], []
    if action:
        where.append("action = ?")
        params.append(action)
    if actor_admin_id:
        where.append("actor_admin_id = ?")
        params.append(actor_admin_id)
    if target_type:
        where.append("target_type = ?")
        params.append(target_type)
    if target_id:
        where.append("target_id = ?")
        params.append(target_id)
    if status:
        where.append("status = ?")
        params.append(status)
    if search:
        where.append("(action LIKE ? OR actor_label LIKE ? OR target_id LIKE ? OR reason LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like, like])
    limit = max(1, min(limit, 500))
    sql = (
        "SELECT * FROM audit_log WHERE "
        + " AND ".join(where)
        + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    )
    params.extend([limit, max(0, offset)])
    rows = db.execute(sql, tuple(params)).fetchall()
    return [dict(r) for r in rows]


def count_audit(db: sqlite3.Connection) -> int:
    row = db.execute("SELECT COUNT(*) AS n FROM audit_log").fetchone()
    return int(row["n"]) if row else 0
