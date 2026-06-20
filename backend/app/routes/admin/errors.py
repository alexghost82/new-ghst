"""Error / failed-process reads for the admin panel (``/api/admin/errors``)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import require_permission
from app.security.rbac import PERM_ERRORS_READ
from app.schemas.responses import ok_response
from app.storage.database import get_db
from app.storage.error_store import list_errors, summary

router = APIRouter(prefix="/errors", tags=["admin-errors"])


@router.get("/summary")
async def errors_summary_endpoint(
    admin: dict = Depends(require_permission(PERM_ERRORS_READ)),
):
    db = get_db()
    try:
        return ok_response(summary(db))
    finally:
        db.close()


@router.get("")
async def errors_list_endpoint(
    admin: dict = Depends(require_permission(PERM_ERRORS_READ)),
    severity: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    db = get_db()
    try:
        return ok_response(
            list_errors(db, severity=severity, search=search, limit=limit, offset=offset)
        )
    finally:
        db.close()
