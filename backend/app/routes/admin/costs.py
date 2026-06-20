"""Cost dashboard reads for the admin panel (``/api/admin/costs``).

Reads the ``llm_usage`` ledger captured by ``cost_service``. ``tracking_active``
tells the UI whether any usage has been captured yet (false on a fresh deploy
until the first model call is made), so the screen can explain the empty state
honestly instead of implying spend is zero.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import require_permission
from app.security.rbac import PERM_COSTS_READ
from app.schemas.responses import ok_response
from app.storage.cost_store import overview
from app.storage.database import get_db

router = APIRouter(prefix="/costs", tags=["admin-costs"])


@router.get("/overview")
async def costs_overview_endpoint(
    admin: dict = Depends(require_permission(PERM_COSTS_READ)),
):
    db = get_db()
    try:
        return ok_response(overview(db))
    finally:
        db.close()
