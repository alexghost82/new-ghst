"""Persistence for the Owner / Super-Admin panel: admin identities and their
rotating refresh tokens. Kept separate from ``user_store`` because admins are a
different identity domain (email + password + TOTP) from operators.

TOTP secrets are encrypted at rest with the Fernet master key (same key used
for operator API keys). Passwords are hashed by ``admin_auth_service`` (argon2)
before they ever reach this layer — this module only stores the resulting hash.
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from cryptography.fernet import Fernet

from app.config import settings

logger = logging.getLogger("ghost.store.admin")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fernet() -> Fernet:
    return Fernet(settings.ghost_master_key.encode())


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


def _public(row: sqlite3.Row | dict) -> dict:
    """Admin record safe to return to the panel — never includes the password
    hash or the encrypted TOTP secret."""
    d = dict(row)
    return {
        "id": d["id"],
        "email": d["email"],
        "display_name": d.get("display_name") or "",
        "role": d["role"],
        "status": d["status"],
        "totp_enabled": bool(d.get("totp_enabled")),
        "last_login_at": d.get("last_login_at"),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


# ----------------------------------------------------------------------------
# Admin CRUD
# ----------------------------------------------------------------------------
def create_admin(
    db: sqlite3.Connection,
    *,
    email: str,
    password_hash: str,
    role: str,
    display_name: str = "",
    created_by: str | None = None,
    totp_secret: str | None = None,
    totp_enabled: bool = False,
) -> dict:
    email_norm = email.strip().lower()
    existing = db.execute(
        "SELECT id FROM admin_users WHERE email = ?", (email_norm,)
    ).fetchone()
    if existing:
        raise ValueError(f"Admin with email '{email_norm}' already exists")

    admin_id = uuid4().hex
    now = _now()
    enc_secret = encrypt_secret(totp_secret) if totp_secret else None
    db.execute(
        """
        INSERT INTO admin_users
            (id, email, password_hash, display_name, role, status,
             totp_secret_encrypted, totp_enabled, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
        """,
        (
            admin_id,
            email_norm,
            password_hash,
            display_name,
            role,
            enc_secret,
            1 if totp_enabled else 0,
            created_by,
            now,
            now,
        ),
    )
    db.commit()
    logger.info("Created admin %s (%s, role=%s)", admin_id, email_norm, role)
    row = db.execute("SELECT * FROM admin_users WHERE id = ?", (admin_id,)).fetchone()
    return _public(row)


def get_admin_by_email(db: sqlite3.Connection, email: str) -> dict | None:
    """Full row (including password_hash + encrypted TOTP) — auth-internal use."""
    row = db.execute(
        "SELECT * FROM admin_users WHERE email = ?", (email.strip().lower(),)
    ).fetchone()
    return dict(row) if row else None


def get_admin_by_id(db: sqlite3.Connection, admin_id: str) -> dict | None:
    """Full row — auth-internal use."""
    row = db.execute("SELECT * FROM admin_users WHERE id = ?", (admin_id,)).fetchone()
    return dict(row) if row else None


def get_admin_public(db: sqlite3.Connection, admin_id: str) -> dict | None:
    row = db.execute("SELECT * FROM admin_users WHERE id = ?", (admin_id,)).fetchone()
    return _public(row) if row else None


def list_admins(db: sqlite3.Connection) -> list[dict]:
    rows = db.execute(
        "SELECT * FROM admin_users ORDER BY created_at ASC"
    ).fetchall()
    return [_public(r) for r in rows]


def count_admins(db: sqlite3.Connection) -> int:
    row = db.execute("SELECT COUNT(*) AS n FROM admin_users").fetchone()
    return int(row["n"]) if row else 0


def get_admin_totp_secret(db: sqlite3.Connection, admin_id: str) -> str | None:
    row = db.execute(
        "SELECT totp_secret_encrypted FROM admin_users WHERE id = ?", (admin_id,)
    ).fetchone()
    if not row or not row["totp_secret_encrypted"]:
        return None
    try:
        return decrypt_secret(row["totp_secret_encrypted"])
    except Exception:  # noqa: BLE001 - corrupt/rotated key → treat as no secret
        logger.warning("Failed to decrypt TOTP secret for admin %s", admin_id)
        return None


def set_admin_totp(
    db: sqlite3.Connection, admin_id: str, *, secret: str, enabled: bool
) -> None:
    db.execute(
        "UPDATE admin_users SET totp_secret_encrypted = ?, totp_enabled = ?, updated_at = ? WHERE id = ?",
        (encrypt_secret(secret), 1 if enabled else 0, _now(), admin_id),
    )
    db.commit()


def update_admin_password(db: sqlite3.Connection, admin_id: str, password_hash: str) -> None:
    db.execute(
        "UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?",
        (password_hash, _now(), admin_id),
    )
    db.commit()


def update_admin_fields(
    db: sqlite3.Connection,
    admin_id: str,
    *,
    role: str | None = None,
    status: str | None = None,
    display_name: str | None = None,
) -> dict | None:
    sets, params = [], []
    if role is not None:
        sets.append("role = ?")
        params.append(role)
    if status is not None:
        sets.append("status = ?")
        params.append(status)
    if display_name is not None:
        sets.append("display_name = ?")
        params.append(display_name)
    if not sets:
        return get_admin_public(db, admin_id)
    sets.append("updated_at = ?")
    params.append(_now())
    params.append(admin_id)
    db.execute(f"UPDATE admin_users SET {', '.join(sets)} WHERE id = ?", tuple(params))
    db.commit()
    return get_admin_public(db, admin_id)


def record_login_success(db: sqlite3.Connection, admin_id: str) -> None:
    db.execute(
        "UPDATE admin_users SET last_login_at = ?, failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?",
        (_now(), _now(), admin_id),
    )
    db.commit()


def record_login_failure(
    db: sqlite3.Connection, admin_id: str, *, max_failures: int, lockout_minutes: int
) -> None:
    """Increment the failure counter and lock the account when it crosses the
    threshold. Best-effort throttle against password brute force."""
    from datetime import timedelta

    row = db.execute(
        "SELECT failed_login_count FROM admin_users WHERE id = ?", (admin_id,)
    ).fetchone()
    if not row:
        return
    count = int(row["failed_login_count"]) + 1
    locked_until = None
    if count >= max_failures:
        locked_until = (
            datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)
        ).isoformat()
    db.execute(
        "UPDATE admin_users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?",
        (count, locked_until, _now(), admin_id),
    )
    db.commit()


def is_locked(admin_row: dict) -> bool:
    locked_until = admin_row.get("locked_until")
    if not locked_until:
        return False
    try:
        return datetime.fromisoformat(locked_until) > datetime.now(timezone.utc)
    except Exception:  # noqa: BLE001
        return False


# ----------------------------------------------------------------------------
# Refresh tokens
# ----------------------------------------------------------------------------
def store_refresh_token(
    db: sqlite3.Connection,
    *,
    admin_id: str,
    token_hash: str,
    expires_at: str,
    user_agent: str | None = None,
    ip: str | None = None,
) -> str:
    token_id = uuid4().hex
    db.execute(
        """
        INSERT INTO admin_refresh_tokens
            (id, admin_id, token_hash, user_agent, ip, issued_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (token_id, admin_id, token_hash, user_agent, ip, _now(), expires_at),
    )
    db.commit()
    return token_id


def get_active_refresh_token(db: sqlite3.Connection, token_hash: str) -> dict | None:
    row = db.execute(
        "SELECT * FROM admin_refresh_tokens WHERE token_hash = ?", (token_hash,)
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    if d.get("revoked_at"):
        return None
    try:
        if datetime.fromisoformat(d["expires_at"]) <= datetime.now(timezone.utc):
            return None
    except Exception:  # noqa: BLE001
        return None
    return d


def revoke_refresh_token(db: sqlite3.Connection, token_hash: str) -> None:
    db.execute(
        "UPDATE admin_refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
        (_now(), token_hash),
    )
    db.commit()


def revoke_all_refresh_tokens(db: sqlite3.Connection, admin_id: str) -> None:
    db.execute(
        "UPDATE admin_refresh_tokens SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL",
        (_now(), admin_id),
    )
    db.commit()


def purge_expired_refresh_tokens(db: sqlite3.Connection) -> int:
    cur = db.execute(
        "DELETE FROM admin_refresh_tokens WHERE expires_at <= ?", (_now(),)
    )
    db.commit()
    return cur.rowcount or 0
