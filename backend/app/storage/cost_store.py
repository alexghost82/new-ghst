"""Persistence + aggregates for captured LLM usage (``llm_usage`` table).

Each row is one model call's token usage and estimated USD cost. Writes are
best-effort (see ``cost_service``); reads power the admin Costs dashboard.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _month_start() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


def insert_llm_usage(
    db: sqlite3.Connection,
    *,
    model: str,
    action: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
    user_id: str | None = None,
    conversation_id: str | None = None,
) -> None:
    db.execute(
        """
        INSERT INTO llm_usage
            (id, user_id, conversation_id, model, action,
             prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            uuid4().hex,
            user_id,
            conversation_id,
            model,
            action,
            prompt_tokens,
            completion_tokens,
            prompt_tokens + completion_tokens,
            cost_usd,
            _now(),
        ),
    )
    db.commit()


def _sum(db: sqlite3.Connection, sql: str, params: tuple = ()) -> float:
    row = db.execute(sql, params).fetchone()
    return round(float(row[0]), 4) if row and row[0] is not None else 0.0


def overview(db: sqlite3.Connection) -> dict:
    total_calls = db.execute("SELECT COUNT(*) FROM llm_usage").fetchone()[0]

    by_model = [
        {
            "model": r["model"],
            "calls": int(r["calls"]),
            "total_tokens": int(r["tok"] or 0),
            "cost_usd": round(float(r["cost"] or 0), 4),
        }
        for r in db.execute(
            """
            SELECT model, COUNT(*) AS calls, SUM(total_tokens) AS tok, SUM(cost_usd) AS cost
            FROM llm_usage GROUP BY model ORDER BY cost DESC
            """
        ).fetchall()
    ]
    by_action = [
        {
            "action": r["action"],
            "calls": int(r["calls"]),
            "cost_usd": round(float(r["cost"] or 0), 4),
        }
        for r in db.execute(
            """
            SELECT action, COUNT(*) AS calls, SUM(cost_usd) AS cost
            FROM llm_usage GROUP BY action ORDER BY cost DESC
            """
        ).fetchall()
    ]
    top_users = [
        {
            "user_id": r["user_id"],
            "nickname": r["nickname"],
            "cost_usd": round(float(r["cost"] or 0), 4),
            "calls": int(r["calls"]),
        }
        for r in db.execute(
            """
            SELECT lu.user_id, u.nickname, SUM(lu.cost_usd) AS cost, COUNT(*) AS calls
            FROM llm_usage lu
            LEFT JOIN users u ON u.id = lu.user_id
            WHERE lu.user_id IS NOT NULL
            GROUP BY lu.user_id ORDER BY cost DESC LIMIT 10
            """
        ).fetchall()
    ]
    daily = [
        {"day": r["day"], "cost_usd": round(float(r["cost"] or 0), 4)}
        for r in db.execute(
            """
            SELECT substr(created_at,1,10) AS day, SUM(cost_usd) AS cost
            FROM llm_usage WHERE created_at >= ?
            GROUP BY day ORDER BY day
            """,
            (_cutoff(14),),
        ).fetchall()
    ]

    return {
        "month_to_date_usd": _sum(
            db, "SELECT SUM(cost_usd) FROM llm_usage WHERE created_at >= ?", (_month_start(),)
        ),
        "today_usd": _sum(
            db, "SELECT SUM(cost_usd) FROM llm_usage WHERE created_at >= ?", (_cutoff(1),)
        ),
        "last_7d_usd": _sum(
            db, "SELECT SUM(cost_usd) FROM llm_usage WHERE created_at >= ?", (_cutoff(7),)
        ),
        "total_calls": int(total_calls),
        "by_model": by_model,
        "by_action": by_action,
        "top_users": top_users,
        "daily": daily,
        "tracking_active": int(total_calls) > 0,
    }
