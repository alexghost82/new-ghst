"""Thin service over ``audit_store`` that records sensitive admin actions.

Writes are best-effort: an audit failure must NEVER break the action being
audited, so ``record`` swallows and logs its own errors. Where an action's
correctness depends on the audit entry, callers can use ``insert_audit``
directly inside their own transaction instead.
"""

from __future__ import annotations

import logging

from fastapi import Request

from app.storage.audit_store import insert_audit
from app.storage.database import get_db

logger = logging.getLogger("ghost.audit")


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    # Cloud Run / Firebase Hosting place the real client IP first in XFF.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    return request.headers.get("user-agent")


def record(
    *,
    action: str,
    actor_admin_id: str | None = None,
    actor_label: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    status: str = "success",
    reason: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
    request: Request | None = None,
    ip: str | None = None,
    user_agent_str: str | None = None,
) -> None:
    """Append one audit entry. Opens its own short-lived DB connection so it can
    be called from anywhere (routes, services) without sharing a transaction."""
    db = get_db()
    try:
        insert_audit(
            db,
            action=action,
            actor_admin_id=actor_admin_id,
            actor_label=actor_label,
            target_type=target_type,
            target_id=target_id,
            status=status,
            reason=reason,
            before=before,
            after=after,
            ip=ip if ip is not None else client_ip(request),
            user_agent=user_agent_str if user_agent_str is not None else user_agent(request),
        )
    except Exception:  # noqa: BLE001 - auditing must never break the action
        logger.warning("Failed to write audit entry action=%s", action, exc_info=True)
    finally:
        db.close()
