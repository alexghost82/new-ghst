from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.memory")


def create_memory_item(
    db: sqlite3.Connection,
    conversation_id: str,
    item_type: str,
    content: str,
    relevance_score: float = 1.0,
) -> dict:
    item_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO memory_items (id, conversation_id, type, content, relevance_score, access_count, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
        (item_id, conversation_id, item_type, content, relevance_score, now, now),
    )
    db.commit()
    logger.info("Created memory item %s (type=%s) for conversation %s", item_id, item_type, conversation_id)
    return {
        "id": item_id,
        "conversation_id": conversation_id,
        "type": item_type,
        "content": content,
        "relevance_score": relevance_score,
        "access_count": 0,
        "created_at": now,
        "updated_at": now,
    }


def list_memory_items(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, type, content, relevance_score, access_count, created_at, updated_at "
        "FROM memory_items WHERE conversation_id = ? ORDER BY updated_at DESC",
        (conversation_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_memory_item(db: sqlite3.Connection, memory_id: str) -> dict | None:
    row = db.execute(
        "SELECT id, conversation_id, type, content, relevance_score, access_count, created_at, updated_at "
        "FROM memory_items WHERE id = ?",
        (memory_id,),
    ).fetchone()
    return dict(row) if row else None


def delete_memory_item(db: sqlite3.Connection, memory_id: str) -> bool:
    cursor = db.execute("DELETE FROM memory_items WHERE id = ?", (memory_id,))
    db.commit()
    return cursor.rowcount > 0


def increment_access_count(db: sqlite3.Connection, memory_ids: list[str]) -> None:
    if not memory_ids:
        return
    now = datetime.now(timezone.utc).isoformat()
    placeholders = ", ".join("?" for _ in memory_ids)
    db.execute(
        f"UPDATE memory_items SET access_count = access_count + 1, updated_at = ? "
        f"WHERE id IN ({placeholders})",
        [now, *memory_ids],
    )
    db.commit()


def get_stale_memories(
    db: sqlite3.Connection,
    conversation_id: str,
    min_relevance: float = 0.3,
    max_age_days: int = 30,
) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, type, content, relevance_score, access_count, created_at, updated_at "
        "FROM memory_items "
        "WHERE conversation_id = ? AND relevance_score < ? "
        "AND julianday('now') - julianday(created_at) > ?",
        (conversation_id, min_relevance, max_age_days),
    ).fetchall()
    return [dict(r) for r in rows]
