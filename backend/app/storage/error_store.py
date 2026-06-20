"""Global error/failure ledger (``error_events``).

Fed by the global exception handler and (optionally) background-job guards.
Best-effort writes (see ``error_service``); reads power the admin Errors screen.
Severities: info | warning | high | critical.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def insert_error(
    db: sqlite3.Connection,
    *,
    message: str,
    source: str,
    severity: str = "high",
    route: str | None = None,
    user_id: str | None = None,
    environment: str = "development",
    stack_hash: str | None = None,
    metadata_json: str = "{}",
) -> None:
    db.execute(
        """
        INSERT INTO error_events
            (id, severity, source, route, user_id, environment, message,
             stack_hash, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            uuid4().hex,
            severity,
            source,
            route,
            user_id,
            environment,
            message[:2000],
            stack_hash,
            metadata_json,
            _now(),
        ),
    )
    db.commit()


def summary(db: sqlite3.Connection) -> dict:
    def _count(sql: str, params: tuple = ()) -> int:
        row = db.execute(sql, params).fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    by_sev = {
        r["severity"]: int(r["n"])
        for r in db.execute(
            "SELECT severity, COUNT(*) AS n FROM error_events GROUP BY severity"
        ).fetchall()
    }
    return {
        "last_24h": _count("SELECT COUNT(*) FROM error_events WHERE created_at >= ?", (_cutoff(1),)),
        "last_7d": _count("SELECT COUNT(*) FROM error_events WHERE created_at >= ?", (_cutoff(7),)),
        "by_severity": by_sev,
    }


def list_errors(
    db: sqlite3.Connection,
    *,
    severity: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    where, params = ["1=1"], []
    if severity:
        where.append("severity = ?")
        params.append(severity)
    if search:
        where.append("(message LIKE ? OR route LIKE ? OR source LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like])
    limit = max(1, min(limit, 500))
    rows = db.execute(
        "SELECT * FROM error_events WHERE "
        + " AND ".join(where)
        + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
        tuple(params + [limit, max(0, offset)]),
    ).fetchall()
    total = db.execute(
        "SELECT COUNT(*) FROM error_events WHERE " + " AND ".join(where), tuple(params)
    ).fetchone()[0]
    return {"items": [dict(r) for r in rows], "total": int(total)}
