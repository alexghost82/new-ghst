from __future__ import annotations

import hmac

from fastapi import Depends, Header, Request

from app.config import settings
from app.schemas.responses import error_response
from app.storage.vector_store import VectorStore

_vector_store: VectorStore | None = None

# Type alias for an authenticated admin record passed through routes.
AdminContext = dict


def set_vector_store(vs: VectorStore) -> None:
    global _vector_store
    _vector_store = vs


def get_vector_store() -> VectorStore:
    assert _vector_store is not None, "VectorStore not initialised"
    return _vector_store


def require_admin(
    x_ghost_admin_token: str | None = Header(default=None),
) -> None:
    """Guard internal admin / PII endpoints (download leads, job applications,
    the trial-account roster, magic-link minting).

    The caller must present a shared secret via the ``X-Ghost-Admin-Token``
    header that matches ``GHOST_ADMIN_TOKEN``. If the token is not configured
    on the server the endpoint is CLOSED to everyone (fail-safe) rather than
    silently open. Comparison is constant-time to avoid timing oracles.
    """
    configured = (settings.admin_token or "").strip()
    presented = (x_ghost_admin_token or "").strip()
    if not configured or not presented or not hmac.compare_digest(configured, presented):
        error_response("ADMIN_FORBIDDEN", "Admin authorization required", 403)


# ----------------------------------------------------------------------------
# Owner / Super-Admin panel auth — JWT Bearer + RBAC.
# Distinct from ``require_admin`` (the legacy shared-token PII guard). The
# panel's ``/api/admin/*`` routes use these dependencies exclusively.
# ----------------------------------------------------------------------------
def get_current_admin(
    authorization: str | None = Header(default=None),
) -> AdminContext:
    """Resolve the bearer access token to an active admin record, or 401.

    Returns the public admin dict augmented with ``permissions`` (the role's
    expanded permission list) so routes/UI can branch without re-deriving it.
    """
    from app.security.rbac import permissions_for_role
    from app.services.admin_auth_service import ACCESS_TOKEN_TYPE, decode_token
    from app.storage.admin_store import get_admin_public
    from app.storage.database import get_db

    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        error_response("ADMIN_UNAUTHENTICATED", "Admin session required", 401)

    payload = decode_token(token, expected_type=ACCESS_TOKEN_TYPE)
    if not payload:
        error_response("ADMIN_TOKEN_INVALID", "Session expired or invalid", 401)

    db = get_db()
    try:
        admin = get_admin_public(db, payload["sub"])
    finally:
        db.close()

    if not admin:
        error_response("ADMIN_TOKEN_INVALID", "Session expired or invalid", 401)
    if admin.get("status") != "active":
        error_response("ADMIN_SUSPENDED", "This admin account is suspended", 403)

    admin["permissions"] = permissions_for_role(admin.get("role"))
    return admin


def require_permission(permission: str):
    """Dependency factory: allow the request only if the current admin's role
    grants ``permission``. Denials are recorded to the audit log."""
    from app.security.rbac import role_has_permission

    def _checker(
        request: Request,
        admin: AdminContext = Depends(get_current_admin),
    ) -> AdminContext:
        if not role_has_permission(admin.get("role"), permission):
            from app.services.audit_service import record

            record(
                action="permission_denied",
                actor_admin_id=admin.get("id"),
                actor_label=admin.get("email"),
                target_type="permission",
                target_id=permission,
                status="denied",
                request=request,
            )
            error_response(
                "ADMIN_FORBIDDEN_PERMISSION",
                f"Missing required permission: {permission}",
                403,
            )
        return admin

    return _checker
