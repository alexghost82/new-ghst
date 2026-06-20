from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.knowledge")


def create_knowledge_source(
    db: sqlite3.Connection,
    user_id: str,
    source_type: str,
    filename: str | None = None,
    original_size: int | None = None,
    tags: list[str] | None = None,
) -> dict:
    source_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    tags_json = json.dumps(tags or [])
    db.execute(
        "INSERT INTO knowledge_sources (id, user_id, source_type, filename, original_size, chunk_count, is_active, tags, created_at) "
        "VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)",
        (source_id, user_id, source_type, filename, original_size, tags_json, now),
    )
    db.commit()
    logger.info("Created knowledge source %s for user %s", source_id, user_id)
    return {
        "id": source_id,
        "user_id": user_id,
        "source_type": source_type,
        "filename": filename,
        "original_size": original_size,
        "chunk_count": 0,
        "is_active": True,
        "tags": tags_json,
        "created_at": now,
    }


def create_knowledge_chunk(
    db: sqlite3.Connection,
    source_id: str,
    user_id: str,
    content: str,
    chunk_index: int,
) -> dict:
    chunk_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO knowledge_chunks (id, source_id, user_id, content, chunk_index, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (chunk_id, source_id, user_id, content, chunk_index, now),
    )
    db.commit()
    return {
        "id": chunk_id,
        "source_id": source_id,
        "user_id": user_id,
        "content": content,
        "chunk_index": chunk_index,
        "created_at": now,
    }


def update_chunk_count(db: sqlite3.Connection, source_id: str, count: int) -> None:
    db.execute(
        "UPDATE knowledge_sources SET chunk_count = ? WHERE id = ?", (count, source_id)
    )
    db.commit()


def list_knowledge_sources(db: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = db.execute(
        "SELECT id, user_id, source_type, filename, original_size, chunk_count, is_active, tags, created_at "
        "FROM knowledge_sources WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_knowledge_source(
    db: sqlite3.Connection, source_id: str, user_id: str | None = None
) -> dict | None:
    if user_id:
        row = db.execute(
            "SELECT id, user_id, source_type, filename, original_size, chunk_count, is_active, tags, created_at "
            "FROM knowledge_sources WHERE id = ? AND user_id = ?",
            (source_id, user_id),
        ).fetchone()
    else:
        row = db.execute(
            "SELECT id, user_id, source_type, filename, original_size, chunk_count, is_active, tags, created_at "
            "FROM knowledge_sources WHERE id = ?",
            (source_id,),
        ).fetchone()
    return dict(row) if row else None


def update_knowledge_source(
    db: sqlite3.Connection,
    source_id: str,
    is_active: bool | None = None,
    tags: list[str] | None = None,
    filename: str | None = None,
) -> dict | None:
    updates: list[str] = []
    params: list = []

    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)
    if tags is not None:
        updates.append("tags = ?")
        params.append(json.dumps(tags))
    if filename is not None:
        updates.append("filename = ?")
        params.append(filename)

    if not updates:
        return get_knowledge_source(db, source_id)

    params.append(source_id)
    db.execute(
        f"UPDATE knowledge_sources SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    db.commit()
    return get_knowledge_source(db, source_id)


def delete_knowledge_source(db: sqlite3.Connection, source_id: str) -> bool:
    cursor = db.execute("DELETE FROM knowledge_sources WHERE id = ?", (source_id,))
    db.commit()
    deleted = cursor.rowcount > 0
    if deleted:
        logger.info("Deleted knowledge source %s", source_id)
    return deleted


def list_knowledge_chunks(db: sqlite3.Connection, source_id: str) -> list[dict]:
    rows = db.execute(
        "SELECT id, source_id, user_id, content, chunk_index, created_at "
        "FROM knowledge_chunks WHERE source_id = ? ORDER BY chunk_index ASC",
        (source_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_chunk_ids_for_source(db: sqlite3.Connection, source_id: str) -> list[str]:
    rows = db.execute(
        "SELECT id FROM knowledge_chunks WHERE source_id = ?", (source_id,)
    ).fetchall()
    return [row["id"] for row in rows]
