"""Admin-facing queries over the operator ``users`` table.

Kept separate from ``user_store`` (the operator-facing CRUD) so the admin
panel's richer listing/filtering/lifecycle logic doesn't bloat the hot path the
product itself uses. Read-mostly; lifecycle mutations (suspend/block/soft-
delete) live here too since they are admin-only.

Operator account ``status`` values: active | suspended | blocked | deleted.
``suspended``/``blocked`` are policy states the panel sets; ``deleted`` is a
soft delete (row retained, ``deleted_at`` stamped) so it can be restored.
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone

logger = logging.getLogger("ghost.store.admin_user")

USER_STATUSES = ("active", "suspended", "blocked", "deleted")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["status"] = d.get("status") or "active"
    return d


def list_users_admin(
    db: sqlite3.Connection,
    *,
    search: str | None = None,
    status: str | None = None,
    origin: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    where, params = ["1=1"], []
    if not include_deleted:
        where.append("u.status != 'deleted'")
    if status:
        where.append("u.status = ?")
        params.append(status)
    if origin:
        where.append("u.origin = ?")
        params.append(origin)
    if search:
        where.append(
            "(u.nickname LIKE ? OR u.id LIKE ? OR u.lead_email LIKE ? OR u.lead_name LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like, like])
    limit = max(1, min(limit, 200))
    sql = (
        """
        SELECT u.id, u.nickname, u.created_at, u.origin, u.status,
               u.last_login_at, u.deleted_at, u.admin_note,
               u.lead_name, u.lead_email, u.lead_phone,
               COUNT(c.id) AS conversation_count,
               MAX(c.updated_at) AS last_conversation_at
        FROM users u
        LEFT JOIN conversations c ON c.user_id = u.id
        WHERE """
        + " AND ".join(where)
        + " GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?"
    )
    params.extend([limit, max(0, offset)])
    rows = db.execute(sql, tuple(params)).fetchall()
    return [_row(r) for r in rows]


def count_users_admin(
    db: sqlite3.Connection,
    *,
    search: str | None = None,
    status: str | None = None,
    origin: str | None = None,
    include_deleted: bool = False,
) -> int:
    where, params = ["1=1"], []
    if not include_deleted:
        where.append("status != 'deleted'")
    if status:
        where.append("status = ?")
        params.append(status)
    if origin:
        where.append("origin = ?")
        params.append(origin)
    if search:
        where.append("(nickname LIKE ? OR id LIKE ? OR lead_email LIKE ? OR lead_name LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like, like])
    row = db.execute(
        "SELECT COUNT(*) AS n FROM users WHERE " + " AND ".join(where), tuple(params)
    ).fetchone()
    return int(row["n"]) if row else 0


def status_breakdown(db: sqlite3.Connection) -> dict:
    rows = db.execute(
        "SELECT COALESCE(status,'active') AS s, COUNT(*) AS n FROM users GROUP BY s"
    ).fetchall()
    return {r["s"]: int(r["n"]) for r in rows}


def get_user_profile(db: sqlite3.Connection, user_id: str) -> dict | None:
    row = db.execute(
        """
        SELECT id, nickname, created_at, origin, status, last_login_at,
               deleted_at, admin_note, lead_name, lead_email, lead_phone
        FROM users WHERE id = ?
        """,
        (user_id,),
    ).fetchone()
    if not row:
        return None
    profile = _row(row)

    def _count(sql: str) -> int:
        r = db.execute(sql, (user_id,)).fetchone()
        return int(r[0]) if r else 0

    profile["stats"] = {
        "conversations": _count("SELECT COUNT(*) FROM conversations WHERE user_id = ?"),
        "knowledge_sources": _count(
            "SELECT COUNT(*) FROM knowledge_sources WHERE user_id = ?"
        ),
        "incidents": _count("SELECT COUNT(*) FROM incident_events WHERE user_id = ?"),
    }
    last_conv = db.execute(
        "SELECT MAX(updated_at) FROM conversations WHERE user_id = ?", (user_id,)
    ).fetchone()
    profile["last_conversation_at"] = last_conv[0] if last_conv else None
    return profile


def set_user_status(db: sqlite3.Connection, user_id: str, status: str) -> dict | None:
    if status not in USER_STATUSES:
        raise ValueError(f"Invalid status '{status}'")
    deleted_at = _now() if status == "deleted" else None
    db.execute(
        "UPDATE users SET status = ?, deleted_at = ? WHERE id = ?",
        (status, deleted_at, user_id),
    )
    db.commit()
    return get_user_profile(db, user_id)


def restore_user(db: sqlite3.Connection, user_id: str) -> dict | None:
    db.execute(
        "UPDATE users SET status = 'active', deleted_at = NULL WHERE id = ?",
        (user_id,),
    )
    db.commit()
    return get_user_profile(db, user_id)


def set_user_origin(db: sqlite3.Connection, user_id: str, origin: str) -> dict | None:
    """Change an operator's tier. ``origin='trial'`` (free trial) or
    ``'standard'`` (production / paid). Does not touch the account's API key."""
    if origin not in ("trial", "standard"):
        raise ValueError(f"Invalid origin '{origin}'")
    db.execute("UPDATE users SET origin = ? WHERE id = ?", (origin, user_id))
    db.commit()
    return get_user_profile(db, user_id)


def update_user_admin(
    db: sqlite3.Connection,
    user_id: str,
    *,
    nickname: str | None = None,
    admin_note: str | None = None,
) -> dict | None:
    sets, params = [], []
    if nickname is not None:
        sets.append("nickname = ?")
        params.append(nickname)
    if admin_note is not None:
        sets.append("admin_note = ?")
        params.append(admin_note)
    if not sets:
        return get_user_profile(db, user_id)
    params.append(user_id)
    db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", tuple(params))
    db.commit()
    return get_user_profile(db, user_id)
