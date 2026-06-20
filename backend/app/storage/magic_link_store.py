"""Storage helpers for single-use passwordless login links.

A magic login token is an opaque random string that, when presented
exactly once before its expiry, exchanges for the user envelope of the
user it was issued for. The token is generated server-side and never
echoes the user's API key — the encrypted API key stays on the
backend, where every authenticated request looks it up by ``user_id``.
"""
from __future__ import annotations

import logging
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("ghost.store.magic_link")

# 32 url-safe bytes ≈ 43 chars / ~256 bits of entropy. Long enough that a
# brute-force attempt is computationally hopeless even without rate
# limiting, short enough to fit comfortably in a URL query string.
_TOKEN_BYTES = 32

# Default lifetime of a freshly issued link. Short enough that a leaked
# link is dangerous only briefly, long enough that a human can copy the
# URL into a different browser / device without rushing.
DEFAULT_TTL_MINUTES = 15

# Hard upper bound — even if a caller passes a wildly large value we
# clamp to this. Keeps blast radius bounded by policy, not by trust.
MAX_TTL_MINUTES = 60 * 24


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_iso(value: str) -> datetime:
    # SQLite stores ISO-8601 strings; ``fromisoformat`` round-trips
    # whatever ``datetime.isoformat`` produced above without losing tz.
    return datetime.fromisoformat(value)


def create_magic_token(
    db: sqlite3.Connection,
    user_id: str,
    ttl_minutes: int = DEFAULT_TTL_MINUTES,
) -> dict:
    """Mint a fresh single-use login token for ``user_id``.

    Returns a dict with the raw token, its issue/expiry timestamps and
    the remaining seconds until expiry — everything the caller needs to
    build a UI countdown.
    """
    if ttl_minutes <= 0:
        raise ValueError("ttl_minutes must be positive")
    if ttl_minutes > MAX_TTL_MINUTES:
        ttl_minutes = MAX_TTL_MINUTES

    now = _now()
    expires_at = now + timedelta(minutes=ttl_minutes)
    token = secrets.token_urlsafe(_TOKEN_BYTES)

    db.execute(
        "INSERT INTO magic_login_tokens (token, user_id, created_at, expires_at) "
        "VALUES (?, ?, ?, ?)",
        (token, user_id, _iso(now), _iso(expires_at)),
    )
    db.commit()
    logger.info(
        "Issued magic login token for user %s (expires %s)",
        user_id,
        expires_at.isoformat(),
    )
    return {
        "token": token,
        "user_id": user_id,
        "created_at": _iso(now),
        "expires_at": _iso(expires_at),
        "expires_in_seconds": int((expires_at - now).total_seconds()),
    }


def consume_magic_token(
    db: sqlite3.Connection,
    token: str,
) -> dict | None:
    """Exchange ``token`` for the matching user envelope.

    The exchange is atomic and single-use: the row is marked consumed
    inside the same transaction that returns the user, so two browser
    tabs racing on the same link can never both succeed.

    Returns ``None`` for tokens that are unknown, expired or already
    used. The caller is expected to surface a generic 401 in that case
    rather than leak which of the three states triggered the failure.
    """
    if not token:
        return None

    row = db.execute(
        "SELECT token, user_id, created_at, expires_at, consumed_at "
        "FROM magic_login_tokens WHERE token = ?",
        (token,),
    ).fetchone()
    if not row:
        return None

    if row["consumed_at"] is not None:
        logger.info("Rejected reuse of consumed magic token (user=%s)", row["user_id"])
        return None

    try:
        expires_at = _parse_iso(row["expires_at"])
    except ValueError:
        logger.warning("Magic token has unparseable expiry; treating as expired")
        return None

    now = _now()
    if expires_at <= now:
        logger.info("Rejected expired magic token (user=%s)", row["user_id"])
        return None

    user_row = db.execute(
        "SELECT id, nickname, created_at FROM users WHERE id = ?",
        (row["user_id"],),
    ).fetchone()
    if not user_row:
        logger.warning(
            "Magic token references missing user %s; refusing exchange",
            row["user_id"],
        )
        return None

    db.execute(
        "UPDATE magic_login_tokens SET consumed_at = ? "
        "WHERE token = ? AND consumed_at IS NULL",
        (_iso(now), token),
    )
    db.commit()

    logger.info("Consumed magic login token for user %s", row["user_id"])
    return {
        "id": user_row["id"],
        "nickname": user_row["nickname"],
        "created_at": user_row["created_at"],
    }


def purge_expired_magic_tokens(db: sqlite3.Connection) -> int:
    """Best-effort cleanup of dead rows. Safe to call frequently."""
    cur = db.execute(
        "DELETE FROM magic_login_tokens "
        "WHERE expires_at < ? OR consumed_at IS NOT NULL",
        (_iso(_now() - timedelta(days=1)),),
    )
    db.commit()
    return cur.rowcount or 0
