from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.camera")


def list_cameras(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, device_id, label, position, created_at "
        "FROM conversation_cameras WHERE conversation_id = ? "
        "ORDER BY position ASC, created_at ASC",
        (conversation_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def replace_cameras(
    db: sqlite3.Connection,
    conversation_id: str,
    cameras: list[dict],
) -> list[dict]:
    """Replace the saved camera setup for a conversation in a single transaction.

    Each ``cameras`` entry must include ``device_id`` and ``label``; ``position``
    defaults to the index in the list when not provided. Older rows for the same
    conversation are removed."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        db.execute("BEGIN")
        db.execute(
            "DELETE FROM conversation_cameras WHERE conversation_id = ?",
            (conversation_id,),
        )
        for idx, cam in enumerate(cameras):
            cam_id = uuid4().hex
            db.execute(
                "INSERT INTO conversation_cameras "
                "(id, conversation_id, device_id, label, position, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    cam_id,
                    conversation_id,
                    cam["device_id"],
                    cam["label"],
                    int(cam.get("position", idx)),
                    now,
                ),
            )
        db.commit()
    except sqlite3.Error:
        db.rollback()
        logger.exception("Failed to replace cameras for %s", conversation_id)
        raise
    return list_cameras(db, conversation_id)


def delete_cameras(db: sqlite3.Connection, conversation_id: str) -> int:
    cursor = db.execute(
        "DELETE FROM conversation_cameras WHERE conversation_id = ?",
        (conversation_id,),
    )
    db.commit()
    return cursor.rowcount


def get_camera_counts(
    db: sqlite3.Connection, conversation_ids: list[str]
) -> dict[str, int]:
    if not conversation_ids:
        return {}
    placeholders = ",".join("?" * len(conversation_ids))
    rows = db.execute(
        f"SELECT conversation_id, COUNT(*) AS cnt FROM conversation_cameras "
        f"WHERE conversation_id IN ({placeholders}) GROUP BY conversation_id",
        conversation_ids,
    ).fetchall()
    return {r["conversation_id"]: r["cnt"] for r in rows}
