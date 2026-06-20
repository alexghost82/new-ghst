"""Audit-log reads for the admin panel (``/api/admin/audit``).

Read-only. The log is written from across the panel (auth, user lifecycle,
impersonation, permission denials); this surfaces it with filtering + paging.
Distinct admin identities are also exposed so the UI can show "who" by email.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_permission
from app.security.rbac import PERM_AUDIT_READ
from app.schemas.responses import ok_response
from app.storage.admin_store import list_admins
from app.storage.audit_store import count_audit, list_audit
from app.storage.database import get_db

logger = logging.getLogger("ghost.routes.admin.audit")
router = APIRouter(prefix="/audit", tags=["admin-audit"])


@router.get("")
async def list_audit_endpoint(
    admin: dict = Depends(require_permission(PERM_AUDIT_READ)),
    action: str | None = Query(default=None),
    actor_admin_id: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    db = get_db()
    try:
        items = list_audit(
            db,
            action=action,
            actor_admin_id=actor_admin_id,
            target_type=target_type,
            target_id=target_id,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )
        # Map admin id -> email so the UI can render "who" without N requests.
        actors = {a["id"]: a["email"] for a in list_admins(db)}
        for it in items:
            if it.get("actor_admin_id") and not it.get("actor_label"):
                it["actor_label"] = actors.get(it["actor_admin_id"])
        return ok_response(
            {
                "items": items,
                "total": count_audit(db),
                "limit": limit,
                "offset": offset,
            }
        )
    finally:
        db.close()
