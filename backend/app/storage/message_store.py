from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import tiktoken

logger = logging.getLogger("ghost.store.message")

_enc = tiktoken.get_encoding("cl100k_base")


def estimate_tokens(text: str) -> int:
    return len(_enc.encode(text))


def create_message(
    db: sqlite3.Connection,
    conversation_id: str,
    role: str,
    content: str,
    image_path: str | None = None,
    camera_label: str | None = None,
) -> dict:
    msg_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    token_est = estimate_tokens(content)

    seq = db.execute(
        "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM messages WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchone()[0]

    db.execute(
        "INSERT INTO messages (id, conversation_id, role, content, token_estimate, "
        "created_at, sequence_number, image_path, camera_label) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            msg_id,
            conversation_id,
            role,
            content,
            token_est,
            now,
            seq,
            image_path,
            camera_label,
        ),
    )
    db.commit()
    return {
        "id": msg_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "token_estimate": token_est,
        "created_at": now,
        "sequence_number": seq,
        "image_path": image_path,
        "camera_label": camera_label,
    }


def update_message_image_path(
    db: sqlite3.Connection,
    message_id: str,
    image_path: str,
) -> None:
    db.execute(
        "UPDATE messages SET image_path = ? WHERE id = ?",
        (image_path, message_id),
    )
    db.commit()


def list_messages(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, role, content, token_estimate, created_at, "
        "       sequence_number, image_path, camera_label "
        "FROM messages WHERE conversation_id = ? "
        "ORDER BY sequence_number ASC LIMIT ? OFFSET ?",
        (conversation_id, limit, offset),
    ).fetchall()
    return [dict(r) for r in rows]


def get_recent_messages(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int = 20,
) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, role, content, token_estimate, created_at, "
        "       sequence_number, image_path, camera_label "
        "FROM messages WHERE conversation_id = ? "
        "ORDER BY sequence_number DESC LIMIT ?",
        (conversation_id, limit),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


def get_messages_since(
    db: sqlite3.Connection,
    conversation_id: str,
    since_hours: int = 24,
    hard_limit: int = 200,
) -> list[dict]:
    """Return all messages from the last ``since_hours`` for a conversation,
    ordered chronologically. A ``hard_limit`` caps the row count to protect
    against runaway streams. Token-level trimming happens downstream in
    ``build_prompt()``.
    """
    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=since_hours)
    ).isoformat()
    rows = db.execute(
        "SELECT id, conversation_id, role, content, token_estimate, created_at, "
        "       sequence_number, image_path, camera_label "
        "FROM messages WHERE conversation_id = ? AND created_at >= ? "
        "ORDER BY sequence_number DESC LIMIT ?",
        (conversation_id, cutoff, hard_limit),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


def get_message_count(db: sqlite3.Connection, conversation_id: str) -> int:
    row = db.execute(
        "SELECT COUNT(*) FROM messages WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchone()
    return row[0]
