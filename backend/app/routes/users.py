from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, Depends

from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import require_admin
from app.services.rate_limiter import rate_limit
from app.schemas.requests import CreateUserRequest, UpdateUserRequest
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.database import get_db
from app.storage.magic_link_store import (
    DEFAULT_TTL_MINUTES,
    MAX_TTL_MINUTES,
    consume_magic_token,
    create_magic_token,
)
from app.storage.user_store import (
    create_user,
    get_user,
    list_trial_users,
    list_users,
    update_user,
    verify_user,
)

logger = logging.getLogger("ghost.routes.users")
router = APIRouter(tags=["users"])


@router.post("/users")
async def create_user_endpoint(req: CreateUserRequest):
    # Self-service operator provisioning: a visitor creates an account with a
    # nickname + their own API key (bring-your-own-key). The public demo/trial
    # funnel uses the dedicated /users/demo/trial endpoint.
    db = get_db()
    try:
        user = create_user(
            db,
            nickname=req.nickname,
            api_key=req.api_key,
            origin=req.origin,
            lead_name=req.lead_name,
            lead_email=req.lead_email,
            lead_phone=req.lead_phone,
        )
        return ok_response(user, status_code=201)
    except ValueError as ve:
        error_response("NICKNAME_TAKEN", str(ve), 409)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to create user")
        error_response("USER_CREATE_FAILED", "Failed to create user", 500)
    finally:
        db.close()


@router.get("/users")
async def list_users_endpoint():
    db = get_db()
    try:
        users = list_users(db)
        return ok_response(users)
    finally:
        db.close()


@router.get("/users/trial-accounts", dependencies=[Depends(require_admin)])
async def list_trial_accounts_endpoint():
    """Every account opened by the public trial gate, newest first, with the
    visitor's contact details and conversation count. Feeds the demo-admin
    (8+0) account picker shown before entering the console.

    Guarded by ``require_admin`` — it exposes visitor PII (name/email/phone),
    so callers must present a valid ``X-Ghost-Admin-Token``.
    """
    db = get_db()
    try:
        users = list_trial_users(db)
        return ok_response(users)
    except Exception:
        logger.exception("Failed to list trial accounts")
        error_response("TRIAL_ACCOUNTS_FAILED", "Failed to list trial accounts", 500)
    finally:
        db.close()


class TrialUserRequest(BaseModel):
    """Public trial account creation. The visitor supplies only their contact
    details — the shared demo API key lives SERVER-SIDE and is never sent by
    the browser."""

    lead_name: str = Field(..., min_length=1, max_length=120)
    lead_email: str | None = Field(default=None, max_length=200)
    lead_phone: str | None = Field(default=None, max_length=60)


def _demo_key_or_503() -> str:
    key = (settings.demo_api_key or "").strip()
    if not key:
        error_response(
            "DEMO_UNAVAILABLE",
            "Demo is not configured on this server",
            503,
        )
    return key


@router.post(
    "/users/demo/trial",
    dependencies=[Depends(rate_limit("demo_trial", 6, 60))],
)
async def create_trial_user_endpoint(req: TrialUserRequest):
    """Open a fresh, clean trial account named after the visitor, using the
    server-held demo API key. Replaces the previous flow where the browser
    shipped the shared key in its bundle."""
    db = get_db()
    try:
        user = create_user(
            db,
            nickname=req.lead_name,
            api_key=_demo_key_or_503(),
            origin="trial",
            lead_name=req.lead_name,
            lead_email=req.lead_email,
            lead_phone=req.lead_phone,
        )
        return ok_response(user, status_code=201)
    except ValueError as ve:
        error_response("NICKNAME_TAKEN", str(ve), 409)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to start trial")
        error_response("TRIAL_START_FAILED", "Failed to start trial", 500)
    finally:
        db.close()


@router.post("/users/demo/admin-login")
async def demo_admin_login_endpoint():
    """Log into (or first-time seed) the shared legacy ``ghostdemo`` account
    using the server-held demo key. Used by the hidden demo-admin chord's
    'legacy shared account' path so the key never reaches the client."""
    db = get_db()
    try:
        key = _demo_key_or_503()
        nickname = settings.demo_nickname
        user = verify_user(db, nickname=nickname, api_key=key)
        if user:
            return ok_response(user)
        # The shared demo account may already exist but hold a STALE key — the
        # server-held demo key was rotated since the account was first seeded.
        # Re-sync it to the current key instead of failing (otherwise the
        # nickname is "taken", create_user raises, and the chord dead-ends).
        existing = db.execute(
            "SELECT id FROM users WHERE nickname = ? ORDER BY created_at DESC LIMIT 1",
            (nickname,),
        ).fetchone()
        if existing:
            update_user(db, existing["id"], api_key=key)
            healed = verify_user(db, nickname=nickname, api_key=key)
            if healed:
                logger.info("Re-synced stale demo account key for '%s'", nickname)
                return ok_response(healed)
        # First-time seed.
        user = create_user(db, nickname=nickname, api_key=key, origin="standard")
        return ok_response(user)
    except ValueError:
        # Raced creation — retry the login path once.
        user = verify_user(db, nickname=settings.demo_nickname, api_key=settings.demo_api_key)
        if user:
            return ok_response(user)
        error_response("DEMO_LOGIN_FAILED", "Demo login failed", 500)
    except GhostException:
        raise
    except Exception:
        logger.exception("Demo admin login failed")
        error_response("DEMO_LOGIN_FAILED", "Demo login failed", 500)
    finally:
        db.close()


class VerifyGmRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)


@router.post("/users/verify-gm")
async def verify_gm_code_endpoint(req: VerifyGmRequest):
    """Server-side check of the operator-provisioning authorization code.

    The code lives only on the server (``GHOST_GM_CODE``); the client posts a
    candidate and receives a boolean. An unset code means provisioning is
    disabled (returns ``valid: false``)."""
    configured = (settings.ghost_gm_code or "").strip()
    presented = (req.code or "").strip()
    valid = bool(configured) and hmac.compare_digest(configured, presented)
    return ok_response({"valid": valid})


class LoginRequest(BaseModel):
    nickname: str = Field(..., min_length=1)
    api_key: str = Field(..., min_length=1)


@router.post("/users/login")
async def login_user_endpoint(req: LoginRequest):
    db = get_db()
    try:
        user = verify_user(db, nickname=req.nickname, api_key=req.api_key)
        if not user:
            error_response("INVALID_CREDENTIALS", "Nickname or API key incorrect", 401)
        return ok_response(user)
    except GhostException:
        raise
    except Exception:
        logger.exception("Login failed")
        error_response("LOGIN_FAILED", "Login failed", 500)
    finally:
        db.close()


class MagicLinkRequest(BaseModel):
    """Optional knobs when minting a quick-login link.

    ``ttl_minutes`` is a hint — the storage layer clamps wild values to
    ``MAX_TTL_MINUTES`` and rejects non-positive numbers.
    """

    ttl_minutes: int | None = Field(
        default=None,
        ge=1,
        le=MAX_TTL_MINUTES,
        description="How long the link stays valid. Defaults to 15 minutes.",
    )


@router.post("/users/{user_id}/magic-link", dependencies=[Depends(require_admin)])
async def create_magic_link_endpoint(user_id: str, req: MagicLinkRequest | None = None):
    """Issue a single-use, time-bounded login link for ``user_id``.

    The endpoint never returns the user's API key — it returns only an
    opaque token and metadata. The caller is expected to embed the
    token in a URL like ``/?magic=<token>``; the frontend recognises
    that query param on boot and exchanges it via ``/users/login/magic``.
    """
    db = get_db()
    try:
        existing = get_user(db, user_id)
        if not existing:
            error_response("USER_NOT_FOUND", "User not found", 404)

        ttl = (req.ttl_minutes if req else None) or DEFAULT_TTL_MINUTES
        issued = create_magic_token(db, user_id=user_id, ttl_minutes=ttl)
        return ok_response(
            {
                "token": issued["token"],
                "user_id": issued["user_id"],
                "expires_at": issued["expires_at"],
                "expires_in_seconds": issued["expires_in_seconds"],
                # The relative path keeps the link valid regardless of
                # which host the operator is on — same machine on the
                # LAN, tunneled domain, etc. The frontend interprets
                # ``?magic=...`` on boot.
                "login_path": f"/?magic={issued['token']}",
            },
            status_code=201,
        )
    except ValueError as ve:
        error_response("INVALID_TTL", str(ve), 400)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to mint magic login token")
        error_response("MAGIC_LINK_FAILED", "Failed to create login link", 500)
    finally:
        db.close()


class MagicLoginRequest(BaseModel):
    token: str = Field(..., min_length=1)


@router.post("/users/login/magic")
async def magic_login_endpoint(req: MagicLoginRequest):
    """Exchange a magic token for a logged-in user envelope.

    Returns the same shape as ``/users/login`` so the frontend can
    persist the session through its existing flow. Any failure (unknown
    token, expired, already used) maps to a single ``401`` so a probing
    client cannot tell which condition triggered the rejection.
    """
    db = get_db()
    try:
        user = consume_magic_token(db, req.token.strip())
        if not user:
            error_response("INVALID_MAGIC_TOKEN", "Login link is invalid or expired", 401)
        return ok_response(user)
    except GhostException:
        raise
    except Exception:
        logger.exception("Magic login failed")
        error_response("MAGIC_LOGIN_FAILED", "Magic login failed", 500)
    finally:
        db.close()


@router.patch("/users/{user_id}")
async def update_user_endpoint(user_id: str, req: UpdateUserRequest):
    db = get_db()
    try:
        existing = get_user(db, user_id)
        if not existing:
            error_response("USER_NOT_FOUND", "User not found", 404)

        updated = update_user(
            db, user_id, nickname=req.nickname, api_key=req.api_key
        )
        return ok_response(updated)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update user")
        error_response("USER_UPDATE_FAILED", "Failed to update user", 500)
    finally:
        db.close()
