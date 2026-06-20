"""Usage & analytics reads for the admin panel (``/api/admin/usage``).

Read-only aggregates derived from existing product data — no operator hot-path
instrumentation. Powers the Overview KPIs and the Usage screen.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_permission
from app.security.rbac import PERM_USAGE_READ
from app.schemas.responses import ok_response
from app.storage.admin_analytics_store import overview, signups_timeseries, top_users
from app.storage.database import get_db

router = APIRouter(prefix="/usage", tags=["admin-usage"])


@router.get("/overview")
async def usage_overview_endpoint(
    admin: dict = Depends(require_permission(PERM_USAGE_READ)),
):
    db = get_db()
    try:
        return ok_response(
            {
                "metrics": overview(db),
                "top_users": top_users(db, limit=10),
                "signups": signups_timeseries(db, days=14),
            }
        )
    finally:
        db.close()


@router.get("/top-users")
async def top_users_endpoint(
    admin: dict = Depends(require_permission(PERM_USAGE_READ)),
    limit: int = Query(default=10, ge=1, le=50),
):
    db = get_db()
    try:
        return ok_response({"items": top_users(db, limit=limit)})
    finally:
        db.close()
