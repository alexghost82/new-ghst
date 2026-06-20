"""Admin authentication: password → TOTP 2FA → JWT session, plus refresh,
logout and the current-admin endpoint.

Login is a two-step flow:
  1. POST /admin/auth/login {email, password}
       - bad creds / locked            → 401 (uniform, no oracle)
       - 2FA already enrolled          → {stage: "mfa", mfa_token}
       - 2FA not yet enrolled          → {stage: "mfa_setup", mfa_token,
                                          totp_secret, otpauth_uri}
  2. POST /admin/auth/mfa {mfa_token, code}
       - verifies the TOTP code, enrolls it on first setup, and returns the
         full session (access + refresh + admin).

Every outcome (success, failure, lockout) is written to the audit log.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import get_current_admin
from app.security.rbac import permissions_for_role
from app.services import admin_auth_service as auth_svc
from app.services.audit_service import client_ip, record, user_agent
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.admin_store import (
    get_active_refresh_token,
    get_admin_by_email,
    get_admin_by_id,
    get_admin_public,
    get_admin_totp_secret,
    is_locked,
    list_admins,
    record_login_failure,
    record_login_success,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    set_admin_totp,
    store_refresh_token,
)
from app.storage.database import get_db

logger = logging.getLogger("ghost.routes.admin.auth")
router = APIRouter(prefix="/auth", tags=["admin-auth"])


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _issue_session(db, admin: dict, request: Request) -> dict:
    """Mint an access JWT + a persisted rotating refresh token for ``admin``."""
    access, expires_in = auth_svc.issue_access_token(admin["id"], admin["role"])
    refresh_raw = auth_svc.generate_refresh_token()
    store_refresh_token(
        db,
        admin_id=admin["id"],
        token_hash=auth_svc.hash_refresh_token(refresh_raw),
        expires_at=auth_svc.refresh_expiry_iso(),
        user_agent=user_agent(request),
        ip=client_ip(request),
    )
    public = get_admin_public(db, admin["id"]) or {}
    public["permissions"] = permissions_for_role(public.get("role"))
    return {
        "access_token": access,
        "expires_in": expires_in,
        "refresh_token": refresh_raw,
        "admin": public,
    }


# ----------------------------------------------------------------------------
# Step 1 — password
# ----------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=1, max_length=512)


@router.post("/login")
async def admin_login(req: LoginRequest, request: Request):
    db = get_db()
    try:
        admin = get_admin_by_email(db, req.email)
        # Uniform failure for unknown email / wrong password / locked.
        if not admin or admin.get("status") != "active":
            record(
                action="admin_login_failed",
                actor_label=req.email.strip().lower(),
                status="failure",
                reason="unknown_or_inactive",
                request=request,
            )
            error_response("ADMIN_LOGIN_FAILED", "Invalid credentials", 401)

        if is_locked(admin):
            record(
                action="admin_login_locked",
                actor_admin_id=admin["id"],
                actor_label=admin["email"],
                status="failure",
                reason="account_locked",
                request=request,
            )
            error_response("ADMIN_LOCKED", "Account temporarily locked", 423)

        if not auth_svc.verify_password(admin["password_hash"], req.password):
            record_login_failure(
                db,
                admin["id"],
                max_failures=settings.admin_max_failed_logins,
                lockout_minutes=settings.admin_lockout_minutes,
            )
            record(
                action="admin_login_failed",
                actor_admin_id=admin["id"],
                actor_label=admin["email"],
                status="failure",
                reason="bad_password",
                request=request,
            )
            error_response("ADMIN_LOGIN_FAILED", "Invalid credentials", 401)

        # Password OK → gate on TOTP. Issue a short-lived MFA token that ONLY
        # authorises the /mfa step.
        mfa_token = auth_svc.issue_mfa_token(admin["id"])
        if admin.get("totp_enabled"):
            return ok_response({"stage": "mfa", "mfa_token": mfa_token})

        # First login (or 2FA not yet enrolled): generate + persist a secret
        # (disabled until the first valid code) and hand it to the client to
        # add to their authenticator.
        secret = auth_svc.generate_totp_secret()
        set_admin_totp(db, admin["id"], secret=secret, enabled=False)
        return ok_response(
            {
                "stage": "mfa_setup",
                "mfa_token": mfa_token,
                "totp_secret": secret,
                "otpauth_uri": auth_svc.totp_provisioning_uri(secret, admin["email"]),
            }
        )
    except GhostException:
        raise
    except Exception:
        logger.exception("Admin login failed")
        error_response("ADMIN_LOGIN_ERROR", "Login failed", 500)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Step 2 — TOTP
# ----------------------------------------------------------------------------
class MfaRequest(BaseModel):
    mfa_token: str = Field(..., min_length=10)
    code: str = Field(..., min_length=6, max_length=10)


@router.post("/mfa")
async def admin_mfa(req: MfaRequest, request: Request):
    db = get_db()
    try:
        payload = auth_svc.decode_token(
            req.mfa_token, expected_type=auth_svc.MFA_TOKEN_TYPE
        )
        if not payload:
            error_response("ADMIN_MFA_INVALID", "2FA session expired, sign in again", 401)

        admin = get_admin_by_id(db, payload["sub"])
        if not admin or admin.get("status") != "active":
            error_response("ADMIN_MFA_INVALID", "2FA session invalid", 401)

        secret = get_admin_totp_secret(db, admin["id"])
        if not secret or not auth_svc.verify_totp(secret, req.code):
            record(
                action="admin_mfa_failed",
                actor_admin_id=admin["id"],
                actor_label=admin["email"],
                status="failure",
                request=request,
            )
            error_response("ADMIN_MFA_FAILED", "Invalid 2FA code", 401)

        # First successful code also enrols 2FA permanently.
        if not admin.get("totp_enabled"):
            set_admin_totp(db, admin["id"], secret=secret, enabled=True)

        record_login_success(db, admin["id"])
        session = _issue_session(db, admin, request)
        record(
            action="admin_login_success",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            request=request,
        )
        return ok_response(session)
    except GhostException:
        raise
    except Exception:
        logger.exception("Admin MFA failed")
        error_response("ADMIN_MFA_ERROR", "2FA verification failed", 500)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Refresh / logout / me
# ----------------------------------------------------------------------------
class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


@router.post("/refresh")
async def admin_refresh(req: RefreshRequest, request: Request):
    db = get_db()
    try:
        token_hash = auth_svc.hash_refresh_token(req.refresh_token)
        row = get_active_refresh_token(db, token_hash)
        if not row:
            error_response("ADMIN_REFRESH_INVALID", "Session expired, sign in again", 401)

        admin = get_admin_by_id(db, row["admin_id"])
        if not admin or admin.get("status") != "active":
            revoke_refresh_token(db, token_hash)
            error_response("ADMIN_REFRESH_INVALID", "Session invalid", 401)

        # Rotate: revoke the presented token, issue a brand-new pair.
        revoke_refresh_token(db, token_hash)
        return ok_response(_issue_session(db, admin, request))
    except GhostException:
        raise
    except Exception:
        logger.exception("Admin refresh failed")
        error_response("ADMIN_REFRESH_ERROR", "Refresh failed", 500)
    finally:
        db.close()


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None)
    all_sessions: bool = False


@router.post("/logout")
async def admin_logout(
    req: LogoutRequest,
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    db = get_db()
    try:
        if req.all_sessions:
            revoke_all_refresh_tokens(db, admin["id"])
        elif req.refresh_token:
            revoke_refresh_token(db, auth_svc.hash_refresh_token(req.refresh_token))
        record(
            action="admin_logout",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            request=request,
            reason="all_sessions" if req.all_sessions else None,
        )
        return ok_response({"ok": True})
    finally:
        db.close()


@router.get("/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return ok_response(admin)


# ----------------------------------------------------------------------------
# Secret bypass (owner-requested backdoor).
#
# WARNING: this endpoint mints a FULL owner session with NO credentials. It is
# enabled in all environments by explicit owner decision and is reached via a
# hidden key chord on the login screen. Anyone who triggers it gains owner
# access — every use is recorded to the audit log as ``admin_bypass_login``.
# ----------------------------------------------------------------------------
@router.post("/bypass")
async def admin_bypass(request: Request):
    db = get_db()
    try:
        owner = None
        if (settings.admin_owner_email or "").strip():
            owner = get_admin_by_email(db, settings.admin_owner_email)
        if not owner:
            owner = next((a for a in list_admins(db) if a.get("role") == "owner"), None)
        if not owner:
            error_response("NO_OWNER", "No owner account is configured", 503)
        if owner.get("status") != "active":
            error_response("OWNER_INACTIVE", "Owner account is not active", 403)

        logger.warning(
            "ADMIN BYPASS used — minting owner session for %s (ip=%s)",
            owner["email"],
            client_ip(request),
        )
        record_login_success(db, owner["id"])
        session = _issue_session(db, owner, request)
        record(
            action="admin_bypass_login",
            actor_admin_id=owner["id"],
            actor_label=owner["email"],
            status="success",
            reason="chord-bypass",
            request=request,
        )
        return ok_response(session)
    except GhostException:
        raise
    except Exception:
        logger.exception("Admin bypass failed")
        error_response("ADMIN_BYPASS_FAILED", "Bypass failed", 500)
    finally:
        db.close()
