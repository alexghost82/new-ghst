from __future__ import annotations

import logging

from fastapi import APIRouter

from app.config import _PLACEHOLDER_MASTER_KEY, settings
from app.schemas.responses import ok_response
from app.storage.database import get_db

logger = logging.getLogger("ghost.routes.health")
router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Liveness — cheap, dependency-free. Kept stable for existing probes."""
    return ok_response({"status": "healthy"})


@router.get("/health/live")
async def liveness():
    """Liveness alias: the process is up and serving."""
    return ok_response({"status": "alive"})


@router.get("/health/ready")
async def readiness():
    """Readiness — verifies the backend can actually serve requests:
    the database answers, ChromaDB is initialised, and the encryption key is
    real (not the placeholder). Returns 200 only when all checks pass so an
    orchestrator can gate traffic on it."""
    checks: dict[str, bool] = {}

    # SQLite reachable?
    try:
        db = get_db()
        try:
            db.execute("SELECT 1").fetchone()
            checks["database"] = True
        finally:
            db.close()
    except Exception:
        logger.exception("Readiness: database check failed")
        checks["database"] = False

    # ChromaDB initialised?
    try:
        from app.dependencies import get_vector_store

        get_vector_store()
        checks["vector_store"] = True
    except Exception:
        checks["vector_store"] = False

    # Encryption key is a real, non-placeholder value?
    key = (settings.ghost_master_key or "").strip()
    checks["master_key"] = bool(key) and key != _PLACEHOLDER_MASTER_KEY

    ready = all(checks.values())
    return ok_response(
        {"status": "ready" if ready else "not_ready", "checks": checks},
        status_code=200 if ready else 503,
    )
