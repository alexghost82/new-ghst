"""Best-effort recording of failures into the global ``error_events`` ledger.

Never raises. Used by the global exception handler (API failures) and available
to background-job guards that today only ``logger.exception`` their failures.
"""

from __future__ import annotations

import hashlib
import logging
import traceback

from app.config import settings
from app.storage.database import get_db
from app.storage.error_store import insert_error

logger = logging.getLogger("ghost.errors")


def _stack_hash(exc: BaseException) -> str:
    """Stable hash of the exception type + traceback frames so identical
    failures group together in the UI."""
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    # Drop volatile memory addresses/line-specific noise: hash type + frame fns.
    key = f"{type(exc).__name__}:{tb[-1500:]}"
    return hashlib.sha256(key.encode("utf-8", "replace")).hexdigest()[:16]


def record(
    *,
    message: str,
    source: str,
    severity: str = "high",
    route: str | None = None,
    user_id: str | None = None,
    exc: BaseException | None = None,
) -> None:
    try:
        db = get_db()
        try:
            insert_error(
                db,
                message=message,
                source=source,
                severity=severity,
                route=route,
                user_id=user_id,
                environment=settings.environment,
                stack_hash=_stack_hash(exc) if exc is not None else None,
            )
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - error logging must never raise
        logger.debug("Failed to record error_event", exc_info=True)
