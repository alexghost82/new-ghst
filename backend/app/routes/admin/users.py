"""Operator account management for the admin panel (``/api/admin/users``).

Every endpoint is permission-gated via ``require_permission`` and every mutation
is written to the audit log (who / whom / before-after / reason / IP). High-risk
actions (soft-delete, impersonation) additionally require a reason; impersonation
also re-verifies the admin's TOTP.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import require_permission
from app.security.rbac import (
    PERM_USERS_CREATE,
    PERM_USERS_DELETE,
    PERM_USERS_IMPERSONATE,
    PERM_USERS_READ,
    PERM_USERS_RESET,
    PERM_USERS_TIER,
    PERM_USERS_WRITE,
)
from app.services import admin_auth_service as auth_svc
from app.services.audit_service import record
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.admin_store import get_admin_totp_secret
from app.storage.admin_user_store import (
    count_users_admin,
    get_user_profile,
    list_users_admin,
    restore_user,
    set_user_origin,
    set_user_status,
    status_breakdown,
    update_user_admin,
)
from app.storage.database import get_db
from app.storage.magic_link_store import DEFAULT_TTL_MINUTES, create_magic_token
from app.storage.user_store import create_user

# tier (UI/business term) -> origin (DB value)
_TIER_TO_ORIGIN = {"trial": "trial", "production": "standard"}

logger = logging.getLogger("ghost.routes.admin.users")
router = APIRouter(prefix="/users", tags=["admin-users"])


# ----------------------------------------------------------------------------
# Read
# ----------------------------------------------------------------------------
@router.get("")
async def list_users_endpoint(
    admin: dict = Depends(require_permission(PERM_USERS_READ)),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    origin: str | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    db = get_db()
    try:
        items = list_users_admin(
            db,
            search=search,
            status=status,
            origin=origin,
            include_deleted=include_deleted,
            limit=limit,
            offset=offset,
        )
        total = count_users_admin(
            db, search=search, status=status, origin=origin, include_deleted=include_deleted
        )
        return ok_response(
            {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset,
                "status_breakdown": status_breakdown(db),
            }
        )
    finally:
        db.close()


@router.get("/{user_id}")
async def get_user_endpoint(
    user_id: str,
    admin: dict = Depends(require_permission(PERM_USERS_READ)),
):
    db = get_db()
    try:
        profile = get_user_profile(db, user_id)
        if not profile:
            error_response("USER_NOT_FOUND", "User not found", 404)
        return ok_response(profile)
    except GhostException:
        raise
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Create (owner-only) — provision a new operator as trial or production.
# ----------------------------------------------------------------------------
class CreateUserAdminRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=120)
    tier: str = Field(..., description="trial | production")
    # Required for production accounts (their login credential). For trial the
    # server-held demo key is used when omitted.
    api_key: str | None = Field(default=None, min_length=1, max_length=512)


@router.post("")
async def create_user_admin_endpoint(
    req: CreateUserAdminRequest,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_CREATE)),
):
    origin = _TIER_TO_ORIGIN.get(req.tier)
    if not origin:
        error_response("INVALID_TIER", "tier must be 'trial' or 'production'", 400)

    api_key = (req.api_key or "").strip()
    if not api_key:
        if origin == "trial":
            api_key = (settings.demo_api_key or "").strip()
            if not api_key:
                error_response(
                    "DEMO_KEY_UNSET",
                    "No server demo key configured for trial accounts",
                    503,
                )
        else:
            error_response("API_KEY_REQUIRED", "A production account requires an API key", 400)

    db = get_db()
    try:
        user = create_user(db, nickname=req.nickname, api_key=api_key, origin=origin)
        record(
            action="user_created",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user["id"],
            after={"nickname": req.nickname, "tier": req.tier, "origin": origin},
            request=request,
        )
        profile = get_user_profile(db, user["id"])
        return ok_response(profile, status_code=201)
    except ValueError as ve:
        error_response("NICKNAME_TAKEN", str(ve), 409)
    except GhostException:
        raise
    except Exception:
        logger.exception("Admin failed to create user")
        error_response("USER_CREATE_FAILED", "Failed to create user", 500)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Tier (owner-only) — flip trial <-> production (paid).
# ----------------------------------------------------------------------------
class TierRequest(BaseModel):
    tier: str = Field(..., description="trial | production")
    reason: str | None = Field(default=None, max_length=500)


@router.post("/{user_id}/tier")
async def set_tier_endpoint(
    user_id: str,
    req: TierRequest,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_TIER)),
):
    origin = _TIER_TO_ORIGIN.get(req.tier)
    if not origin:
        error_response("INVALID_TIER", "tier must be 'trial' or 'production'", 400)
    db = get_db()
    try:
        before = get_user_profile(db, user_id)
        if not before:
            error_response("USER_NOT_FOUND", "User not found", 404)
        after = set_user_origin(db, user_id, origin)
        record(
            action="user_tier_changed",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user_id,
            reason=req.reason,
            before={"origin": before.get("origin")},
            after={"origin": origin},
            request=request,
        )
        return ok_response(after)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to change user tier")
        error_response("USER_TIER_FAILED", "Failed to change tier", 500)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Edit
# ----------------------------------------------------------------------------
class UpdateUserAdminRequest(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=120)
    admin_note: str | None = Field(default=None, max_length=2000)


@router.patch("/{user_id}")
async def update_user_endpoint(
    user_id: str,
    req: UpdateUserAdminRequest,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_WRITE)),
):
    db = get_db()
    try:
        before = get_user_profile(db, user_id)
        if not before:
            error_response("USER_NOT_FOUND", "User not found", 404)
        after = update_user_admin(
            db, user_id, nickname=req.nickname, admin_note=req.admin_note
        )
        record(
            action="user_updated",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user_id,
            before={"nickname": before.get("nickname"), "admin_note": before.get("admin_note")},
            after={"nickname": after.get("nickname"), "admin_note": after.get("admin_note")},
            request=request,
        )
        return ok_response(after)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update user")
        error_response("USER_UPDATE_FAILED", "Failed to update user", 500)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Lifecycle: status / soft-delete / restore
# ----------------------------------------------------------------------------
class StatusRequest(BaseModel):
    status: str = Field(..., description="active | suspended | blocked")
    reason: str | None = Field(default=None, max_length=500)


@router.post("/{user_id}/status")
async def set_status_endpoint(
    user_id: str,
    req: StatusRequest,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_WRITE)),
):
    if req.status not in ("active", "suspended", "blocked"):
        error_response("INVALID_STATUS", "Status must be active, suspended or blocked", 400)
    db = get_db()
    try:
        before = get_user_profile(db, user_id)
        if not before:
            error_response("USER_NOT_FOUND", "User not found", 404)
        after = set_user_status(db, user_id, req.status)
        record(
            action="user_status_changed",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user_id,
            reason=req.reason,
            before={"status": before.get("status")},
            after={"status": after.get("status")},
            request=request,
        )
        return ok_response(after)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to set user status")
        error_response("USER_STATUS_FAILED", "Failed to update status", 500)
    finally:
        db.close()


class DeleteRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/{user_id}/delete")
async def soft_delete_endpoint(
    user_id: str,
    req: DeleteRequest,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_DELETE)),
):
    """Soft delete: the account is marked deleted (and hidden) but its data is
    retained so it can be restored. No hard delete is exposed by design."""
    db = get_db()
    try:
        before = get_user_profile(db, user_id)
        if not before:
            error_response("USER_NOT_FOUND", "User not found", 404)
        after = set_user_status(db, user_id, "deleted")
        record(
            action="user_soft_deleted",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user_id,
            reason=req.reason,
            before={"status": before.get("status")},
            after={"status": "deleted"},
            request=request,
        )
        return ok_response(after)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to soft-delete user")
        error_response("USER_DELETE_FAILED", "Failed to delete user", 500)
    finally:
        db.close()


@router.post("/{user_id}/restore")
async def restore_endpoint(
    user_id: str,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_DELETE)),
):
    db = get_db()
    try:
        before = get_user_profile(db, user_id)
        if not before:
            error_response("USER_NOT_FOUND", "User not found", 404)
        after = restore_user(db, user_id)
        record(
            action="user_restored",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user_id,
            before={"status": before.get("status")},
            after={"status": "active"},
            request=request,
        )
        return ok_response(after)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to restore user")
        error_response("USER_RESTORE_FAILED", "Failed to restore user", 500)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Password reset / quick-login link
# ----------------------------------------------------------------------------
@router.post("/{user_id}/magic-link")
async def admin_magic_link_endpoint(
    user_id: str,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_RESET)),
):
    """Mint a single-use login link for support purposes. The token itself is
    never written to the audit log — only that a link was issued."""
    db = get_db()
    try:
        profile = get_user_profile(db, user_id)
        if not profile:
            error_response("USER_NOT_FOUND", "User not found", 404)
        issued = create_magic_token(db, user_id=user_id, ttl_minutes=DEFAULT_TTL_MINUTES)
        record(
            action="user_magic_link_issued",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user_id,
            request=request,
        )
        return ok_response(
            {
                "user_id": user_id,
                "expires_at": issued["expires_at"],
                "expires_in_seconds": issued["expires_in_seconds"],
                "login_path": f"/?magic={issued['token']}",
            },
            status_code=201,
        )
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to mint admin magic link")
        error_response("MAGIC_LINK_FAILED", "Failed to create login link", 500)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Controlled impersonation — high risk: re-verify TOTP + mandatory reason.
# Issues a magic-login link for the target so the admin can enter the operator
# app AS that user. Fully audited.
# ----------------------------------------------------------------------------
class ImpersonateRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)
    code: str = Field(..., min_length=6, max_length=10, description="Admin's current TOTP")


@router.post("/{user_id}/impersonate")
async def impersonate_endpoint(
    user_id: str,
    req: ImpersonateRequest,
    request: Request,
    admin: dict = Depends(require_permission(PERM_USERS_IMPERSONATE)),
):
    db = get_db()
    try:
        profile = get_user_profile(db, user_id)
        if not profile:
            error_response("USER_NOT_FOUND", "User not found", 404)

        # Re-verify the admin's 2FA for this high-risk action.
        secret = get_admin_totp_secret(db, admin["id"])
        if not secret or not auth_svc.verify_totp(secret, req.code):
            record(
                action="user_impersonate_denied",
                actor_admin_id=admin["id"],
                actor_label=admin["email"],
                target_type="user",
                target_id=user_id,
                status="denied",
                reason="bad_2fa",
                request=request,
            )
            error_response("ADMIN_MFA_FAILED", "2FA re-verification failed", 401)

        # Short TTL — impersonation links are meant to be used immediately.
        issued = create_magic_token(db, user_id=user_id, ttl_minutes=5)
        record(
            action="user_impersonated",
            actor_admin_id=admin["id"],
            actor_label=admin["email"],
            target_type="user",
            target_id=user_id,
            reason=req.reason,
            request=request,
        )
        return ok_response(
            {
                "user_id": user_id,
                "expires_in_seconds": issued["expires_in_seconds"],
                "login_path": f"/?magic={issued['token']}",
            },
            status_code=201,
        )
    except GhostException:
        raise
    except Exception:
        logger.exception("Impersonation failed")
        error_response("IMPERSONATE_FAILED", "Impersonation failed", 500)
    finally:
        db.close()
