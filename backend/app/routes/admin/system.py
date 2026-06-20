"""System health & observability for the admin panel (``/api/admin/system``).

Composes the existing readiness checks, the alert-queue status, the active
environment, and a few headline counts into a single management-friendly view
with an overall severity (ok | warning | critical). Read-only.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.config import _PLACEHOLDER_MASTER_KEY, settings
from app.dependencies import require_permission
from app.security.rbac import PERM_SYSTEM_READ
from app.schemas.responses import ok_response
from app.storage.database import get_db
from app.storage.error_store import summary as error_summary

logger = logging.getLogger("ghost.routes.admin.system")
router = APIRouter(prefix="/system", tags=["admin-system"])


def _readiness_checks() -> dict[str, bool]:
    checks: dict[str, bool] = {}
    try:
        db = get_db()
        try:
            db.execute("SELECT 1").fetchone()
            checks["database"] = True
        finally:
            db.close()
    except Exception:
        checks["database"] = False
    try:
        from app.dependencies import get_vector_store

        get_vector_store()
        checks["vector_store"] = True
    except Exception:
        checks["vector_store"] = False
    key = (settings.ghost_master_key or "").strip()
    checks["master_key"] = bool(key) and key != _PLACEHOLDER_MASTER_KEY
    return checks


@router.get("/health")
async def system_health_endpoint(
    admin: dict = Depends(require_permission(PERM_SYSTEM_READ)),
):
    checks = _readiness_checks()

    # Alert queue status (read the singleton if it exists; never create it here).
    queue_status = None
    try:
        from app.services import alert_queue as _aq

        if getattr(_aq, "_singleton", None) is not None:
            queue_status = _aq._singleton.status()
    except Exception:
        logger.debug("alert queue status unavailable", exc_info=True)

    # Headline counts.
    counts: dict[str, int] = {}
    try:
        db = get_db()
        try:
            counts["total_users"] = db.execute(
                "SELECT COUNT(*) FROM users WHERE status != 'deleted'"
            ).fetchone()[0]
            counts["migrations_applied"] = db.execute(
                "SELECT COUNT(*) FROM _migrations"
            ).fetchone()[0]
            counts["llm_calls"] = db.execute("SELECT COUNT(*) FROM llm_usage").fetchone()[0]
            err = error_summary(db)
        finally:
            db.close()
    except Exception:
        err = {"last_24h": 0, "last_7d": 0, "by_severity": {}}

    # Overall severity.
    all_ready = all(checks.values())
    crit = int((err.get("by_severity") or {}).get("critical", 0))
    errors_24h = int(err.get("last_24h", 0))
    if not all_ready or crit > 0:
        status = "critical"
    elif errors_24h > 0:
        status = "warning"
    else:
        status = "ok"

    return ok_response(
        {
            "status": status,
            "environment": settings.environment,
            "checks": checks,
            "queue": queue_status,
            "counts": counts,
            "errors": {"last_24h": errors_24h, "critical_total": crit},
        }
    )
