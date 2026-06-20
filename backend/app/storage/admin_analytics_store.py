"""Read-only analytics for the admin Overview / Usage screens.

Deliberately derived from data the product ALREADY writes (users, conversations,
messages) plus the optional ``usage_events`` ledger — so it adds zero load to
the operator hot paths. "Active" is proxied by conversation activity in the
window, which is the truest signal of real product use we have without a new
client-side tracking pipeline.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone


def _cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _scalar(db: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    row = db.execute(sql, params).fetchone()
    return int(row[0]) if row and row[0] is not None else 0


def overview(db: sqlite3.Connection) -> dict:
    d1, d7, d30 = _cutoff(1), _cutoff(7), _cutoff(30)

    total_users = _scalar(db, "SELECT COUNT(*) FROM users WHERE status != 'deleted'")
    new_7d = _scalar(db, "SELECT COUNT(*) FROM users WHERE created_at >= ?", (d7,))
    new_30d = _scalar(db, "SELECT COUNT(*) FROM users WHERE created_at >= ?", (d30,))

    def _active(cutoff: str) -> int:
        return _scalar(
            db,
            "SELECT COUNT(DISTINCT user_id) FROM conversations WHERE updated_at >= ?",
            (cutoff,),
        )

    # Dormant: accounts with no conversation activity in 30 days.
    dormant = _scalar(
        db,
        """
        SELECT COUNT(*) FROM users u
        WHERE u.status != 'deleted'
          AND NOT EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.user_id = u.id AND c.updated_at >= ?
          )
        """,
        (d30,),
    )

    return {
        "total_users": total_users,
        "new_users_7d": new_7d,
        "new_users_30d": new_30d,
        "active_today": _active(d1),
        "active_7d": _active(d7),
        "active_30d": _active(d30),
        "dormant_30d": dormant,
        "total_conversations": _scalar(db, "SELECT COUNT(*) FROM conversations"),
        "total_messages": _scalar(db, "SELECT COUNT(*) FROM messages"),
        "messages_7d": _scalar(db, "SELECT COUNT(*) FROM messages WHERE created_at >= ?", (d7,)),
        "trial_users": _scalar(db, "SELECT COUNT(*) FROM users WHERE origin = 'trial'"),
    }


def top_users(db: sqlite3.Connection, limit: int = 10) -> list[dict]:
    rows = db.execute(
        """
        SELECT u.id, u.nickname, u.origin,
               COUNT(c.id) AS conversation_count,
               MAX(c.updated_at) AS last_active
        FROM users u
        LEFT JOIN conversations c ON c.user_id = u.id
        WHERE u.status != 'deleted'
        GROUP BY u.id
        ORDER BY conversation_count DESC, last_active DESC
        LIMIT ?
        """,
        (max(1, min(limit, 50)),),
    ).fetchall()
    return [dict(r) for r in rows]


def signups_timeseries(db: sqlite3.Connection, days: int = 14) -> list[dict]:
    """New users per day for the last ``days`` days (UTC), zero-filled."""
    cutoff = _cutoff(days)
    rows = db.execute(
        """
        SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
        FROM users WHERE created_at >= ?
        GROUP BY day ORDER BY day
        """,
        (cutoff,),
    ).fetchall()
    counts = {r["day"]: int(r["n"]) for r in rows}
    out = []
    base = datetime.now(timezone.utc).date()
    for i in range(days - 1, -1, -1):
        day = (base - timedelta(days=i)).isoformat()
        out.append({"day": day, "count": counts.get(day, 0)})
    return out
