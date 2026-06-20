"""Authentication primitives for the Owner / Super-Admin panel.

Three responsibilities, all stateless helpers:
  1. Password hashing/verification  — argon2id via argon2-cffi.
  2. TOTP 2FA                        — provisioning + verification via pyotp.
  3. JWT access tokens + opaque rotating refresh tokens.

The login *flow* (throttling, 2FA gating, DB writes) lives in the admin auth
route; this module stays pure so it is trivially unit-testable.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import settings

logger = logging.getLogger("ghost.admin.auth")

_ph = PasswordHasher()

_JWT_ALG = "HS256"
ACCESS_TOKEN_TYPE = "admin_access"
# A short-lived intermediate token issued after a correct password but BEFORE
# the TOTP step — it can ONLY be used to complete 2FA, never to call the API.
MFA_TOKEN_TYPE = "admin_mfa"
MFA_TOKEN_TTL_SECONDS = 300


# ----------------------------------------------------------------------------
# Passwords
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:  # noqa: BLE001 - malformed hash → fail closed
        logger.warning("Password verification raised unexpectedly", exc_info=True)
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _ph.check_needs_rehash(password_hash)
    except Exception:  # noqa: BLE001
        return False


# ----------------------------------------------------------------------------
# TOTP 2FA
# ----------------------------------------------------------------------------
def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, email: str, issuer: str = "Ghost Admin") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    try:
        # valid_window=1 tolerates ~30s clock skew on either side.
        return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)
    except Exception:  # noqa: BLE001
        return False


# ----------------------------------------------------------------------------
# JWT access tokens
# ----------------------------------------------------------------------------
def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.effective_admin_jwt_secret(), algorithm=_JWT_ALG)


def issue_access_token(admin_id: str, role: str) -> tuple[str, int]:
    """Return ``(token, expires_in_seconds)`` for an admin access JWT."""
    ttl = max(1, settings.admin_access_ttl_minutes) * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": admin_id,
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
    }
    return _encode(payload), ttl


def issue_mfa_token(admin_id: str) -> str:
    """Short-lived token that only authorises completing the TOTP step."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": admin_id,
        "type": MFA_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=MFA_TOKEN_TTL_SECONDS)).timestamp()),
    }
    return _encode(payload)


def decode_token(token: str, *, expected_type: str) -> dict | None:
    """Decode and validate a JWT, enforcing the ``type`` claim. Returns the
    payload or ``None`` on any failure (expired, bad signature, wrong type)."""
    try:
        payload = jwt.decode(
            token, settings.effective_admin_jwt_secret(), algorithms=[_JWT_ALG]
        )
    except Exception:  # noqa: BLE001 - all decode failures collapse to None
        return None
    if payload.get("type") != expected_type:
        return None
    return payload


# ----------------------------------------------------------------------------
# Refresh tokens — opaque random strings; only their hash is stored.
# ----------------------------------------------------------------------------
def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_expiry_iso() -> str:
    return (
        datetime.now(timezone.utc) + timedelta(days=max(1, settings.admin_refresh_ttl_days))
    ).isoformat()
