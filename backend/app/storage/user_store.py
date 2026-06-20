from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from cryptography.fernet import Fernet

from app.config import settings

logger = logging.getLogger("ghost.store.user")


def _fernet() -> Fernet:
    return Fernet(settings.ghost_master_key.encode())


def encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


def create_user(
    db: sqlite3.Connection,
    nickname: str,
    api_key: str,
    origin: str = "standard",
    lead_name: str | None = None,
    lead_email: str | None = None,
    lead_phone: str | None = None,
) -> dict:
    # Trial accounts are auto-named after the visitor, so two visitors with
    # the same name must each get their own fresh account. Only standard
    # operator accounts enforce nickname uniqueness.
    if origin != "trial":
        existing = db.execute(
            "SELECT id FROM users WHERE nickname = ?", (nickname,)
        ).fetchone()
        if existing:
            raise ValueError(f"Nickname '{nickname}' is already taken")

    user_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    encrypted = encrypt_api_key(api_key)
    db.execute(
        """
        INSERT INTO users
            (id, nickname, api_key_encrypted, created_at,
             origin, lead_name, lead_email, lead_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, nickname, encrypted, now, origin, lead_name, lead_email, lead_phone),
    )
    db.commit()
    logger.info("Created user %s (%s, origin=%s)", user_id, nickname, origin)
    return {"id": user_id, "nickname": nickname, "created_at": now, "origin": origin}


def list_users(db: sqlite3.Connection) -> list[dict]:
    rows = db.execute("SELECT id, nickname, created_at FROM users").fetchall()
    return [dict(r) for r in rows]


def list_trial_users(db: sqlite3.Connection) -> list[dict]:
    """All accounts auto-created by the public trial gate, newest first,
    with the lead contact left by the visitor and how many conversations
    each one opened. Consumed by the demo-admin (8+0) account picker."""
    rows = db.execute(
        """
        SELECT u.id, u.nickname, u.created_at,
               u.lead_name, u.lead_email, u.lead_phone,
               COUNT(c.id) AS conversation_count
        FROM users u
        LEFT JOIN conversations c ON c.user_id = u.id
        WHERE u.origin = 'trial'
        GROUP BY u.id
        ORDER BY u.created_at DESC
        """
    ).fetchall()
    return [dict(r) for r in rows]


def get_user(db: sqlite3.Connection, user_id: str) -> dict | None:
    row = db.execute(
        "SELECT id, nickname, api_key_encrypted, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    return dict(row) if row else None


def get_user_api_key(db: sqlite3.Connection, user_id: str) -> str | None:
    row = db.execute(
        "SELECT api_key_encrypted FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not row:
        return None
    return decrypt_api_key(row["api_key_encrypted"])


def verify_user(db: sqlite3.Connection, nickname: str, api_key: str) -> dict | None:
    row = db.execute(
        "SELECT id, nickname, api_key_encrypted, created_at FROM users WHERE nickname = ? ORDER BY created_at DESC LIMIT 1",
        (nickname,),
    ).fetchone()
    if not row:
        return None
    try:
        stored_key = decrypt_api_key(row["api_key_encrypted"])
        if stored_key != api_key:
            return None
    except Exception:
        return None
    return {"id": row["id"], "nickname": row["nickname"], "created_at": row["created_at"]}


def update_user(
    db: sqlite3.Connection,
    user_id: str,
    nickname: str | None = None,
    api_key: str | None = None,
) -> dict | None:
    user = get_user(db, user_id)
    if not user:
        return None

    if nickname is not None:
        db.execute("UPDATE users SET nickname = ? WHERE id = ?", (nickname, user_id))
    if api_key is not None:
        encrypted = encrypt_api_key(api_key)
        db.execute(
            "UPDATE users SET api_key_encrypted = ? WHERE id = ?",
            (encrypted, user_id),
        )
    db.commit()

    updated = get_user(db, user_id)
    if not updated:
        return None
    return {
        "id": updated["id"],
        "nickname": updated["nickname"],
        "created_at": updated["created_at"],
    }
