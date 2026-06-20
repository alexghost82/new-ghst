from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Query
from starlette.responses import StreamingResponse

from app.schemas.requests import (
    AcknowledgeAlertRequest,
    AlertScanRequest,
    CreateAlertRuleRequest,
    SetAlertModeRequest,
    UpdateAlertRuleRequest,
)
from app.schemas.responses import GhostException, error_response, ok_response
from app.services.alert_broker import get_alert_broker
from app.services.alert_queue import get_alert_queue
from app.services.alert_service import scan_frame
from app.storage.alert_store import (
    acknowledge_event,
    create_rule,
    delete_rule,
    get_event,
    get_rule,
    list_events,
    list_rules,
    set_alert_mode,
    update_rule,
)
from app.storage.conversation_store import get_conversation
from app.storage.database import get_db
from app.storage.user_store import get_user_api_key

logger = logging.getLogger("ghost.routes.alerts")
router = APIRouter(tags=["alerts"])

# How often to send a keepalive comment line on idle SSE streams.
_SSE_KEEPALIVE_SECONDS = 15.0


def _require_conversation(db, conversation_id: str, user_id: str) -> dict:
    conv = get_conversation(db, conversation_id, user_id=user_id)
    if not conv:
        error_response(
            "CONVERSATION_NOT_FOUND",
            "Conversation not found or access denied",
            404,
        )
    return conv  # type: ignore[return-value]


def _require_rule_for_user(db, rule_id: str, user_id: str) -> dict:
    rule = get_rule(db, rule_id)
    if not rule:
        error_response("ALERT_RULE_NOT_FOUND", "Alert rule not found", 404)
        # error_response raises, but mypy/type-checkers don't know that
        raise AssertionError  # pragma: no cover
    conv = get_conversation(db, rule["conversation_id"], user_id=user_id)
    if not conv:
        error_response(
            "CONVERSATION_NOT_FOUND",
            "Conversation not found or access denied",
            404,
        )
    return rule


@router.get("/conversations/{conversation_id}/alerts/rules")
async def list_rules_endpoint(
    conversation_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        return ok_response(list_rules(db, conversation_id))
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list alert rules")
        error_response(
            "ALERT_RULES_LIST_FAILED", "Failed to list alert rules", 500
        )
    finally:
        db.close()


@router.post("/conversations/{conversation_id}/alerts/rules")
async def create_rule_endpoint(
    conversation_id: str, req: CreateAlertRuleRequest
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        rule = create_rule(db, conversation_id, req.description.strip())
        return ok_response(rule, status_code=201)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to create alert rule")
        error_response(
            "ALERT_RULE_CREATE_FAILED", "Failed to create alert rule", 500
        )
    finally:
        db.close()


@router.patch("/alerts/rules/{rule_id}")
async def update_rule_endpoint(rule_id: str, req: UpdateAlertRuleRequest):
    db = get_db()
    try:
        _require_rule_for_user(db, rule_id, req.user_id)
        description = req.description.strip() if req.description else None
        updated = update_rule(
            db, rule_id, description=description, is_active=req.is_active
        )
        if not updated:
            error_response(
                "ALERT_RULE_NOT_FOUND", "Alert rule not found", 404
            )
        return ok_response(updated)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update alert rule")
        error_response(
            "ALERT_RULE_UPDATE_FAILED", "Failed to update alert rule", 500
        )
    finally:
        db.close()


@router.delete("/alerts/rules/{rule_id}")
async def delete_rule_endpoint(rule_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        _require_rule_for_user(db, rule_id, user_id)
        deleted = delete_rule(db, rule_id)
        return ok_response({"deleted": deleted})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to delete alert rule")
        error_response(
            "ALERT_RULE_DELETE_FAILED", "Failed to delete alert rule", 500
        )
    finally:
        db.close()


@router.put("/conversations/{conversation_id}/alerts/mode")
async def set_alert_mode_endpoint(
    conversation_id: str, req: SetAlertModeRequest
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        # Server-side guard: enabling alert mode without an active rule or
        # without a configured camera leaves the engine running a no-op loop
        # that quietly burns API quota. The frontend already does this
        # check; we enforce it here so any client (or stale tab) cannot
        # bypass it.
        if req.enabled:
            from app.storage.camera_store import list_cameras

            active_rules = [
                r for r in list_rules(db, conversation_id) if r["is_active"]
            ]
            if not active_rules:
                error_response(
                    "ALERT_NO_ACTIVE_RULE",
                    "At least one active alert rule is required",
                    400,
                )
            cameras = list_cameras(db, conversation_id)
            if not cameras:
                error_response(
                    "ALERT_NO_CAMERA",
                    "At least one camera must be configured",
                    400,
                )
        ok = set_alert_mode(db, conversation_id, req.enabled)
        if not ok:
            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )
        return ok_response({"alert_mode_enabled": req.enabled})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to set alert mode")
        error_response(
            "ALERT_MODE_UPDATE_FAILED", "Failed to update alert mode", 500
        )
    finally:
        db.close()


@router.post("/conversations/{conversation_id}/alerts/scan")
async def scan_alert_endpoint(
    conversation_id: str, req: AlertScanRequest
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        api_key = get_user_api_key(db, req.user_id)
        if not api_key:
            error_response(
                "API_KEY_MISSING",
                "No API key configured for this user",
                400,
            )

        rules = list_rules(db, conversation_id)
        active_rules = [r for r in rules if r["is_active"]]
        if not active_rules:
            return ok_response({"detected": False, "skipped": True})

        result = await scan_frame(
            db=db,
            conversation_id=conversation_id,
            rules=active_rules,
            image_base64=req.image_base64,
            api_key=api_key,
            locale=req.locale or "he",
            user_id=req.user_id,
            camera_label=req.camera_label,
        )
        return ok_response(result)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to scan alert frame")
        error_response("ALERT_SCAN_FAILED", "Failed to scan alert frame", 500)
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/alerts/events")
async def list_events_endpoint(
    conversation_id: str,
    user_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        events = list_events(db, conversation_id, limit=limit)
        return ok_response(events)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list alert events")
        error_response(
            "ALERT_EVENTS_LIST_FAILED", "Failed to list alert events", 500
        )
    finally:
        db.close()


@router.post("/alerts/events/{event_id}/acknowledge")
async def acknowledge_event_endpoint(
    event_id: str, req: AcknowledgeAlertRequest
):
    db = get_db()
    try:
        existing = get_event(db, event_id)
        if not existing:
            error_response(
                "ALERT_EVENT_NOT_FOUND", "Alert event not found", 404
            )
            return None
        _require_conversation(db, existing["conversation_id"], req.user_id)
        updated = acknowledge_event(db, event_id)
        return ok_response(updated)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to acknowledge alert event")
        error_response(
            "ALERT_ACK_FAILED", "Failed to acknowledge alert event", 500
        )
    finally:
        db.close()


@router.get("/alerts/queue/status")
async def queue_status_endpoint():
    return ok_response(get_alert_queue().status())


@router.get("/users/{user_id}/alerts/stream")
async def alerts_stream_endpoint(user_id: str):
    """Server-Sent Events channel that pushes alert events to the frontend
    the moment they're created in :func:`scan_frame`.

    The endpoint is intentionally not authenticated beyond the opaque
    ``user_id`` path parameter — this matches the rest of the API surface
    (which uses ``user_id`` as a bearer-ish key) and avoids forcing a
    session cookie on this read-only stream.
    """

    broker = get_alert_broker()
    queue = await broker.register(user_id)

    async def generator():
        try:
            # Initial comment so the connection is immediately flushed
            # through any proxies (Vite dev server, etc.).
            yield ": connected\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(
                        queue.get(), timeout=_SSE_KEEPALIVE_SECONDS
                    )
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                except asyncio.CancelledError:
                    raise
                try:
                    data = json.dumps(payload, default=str)
                except Exception:
                    logger.exception(
                        "Failed to serialise alert payload for user=%s",
                        user_id,
                    )
                    continue
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            raise
        finally:
            await broker.unregister(user_id, queue)

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    }
    return StreamingResponse(
        generator(), media_type="text/event-stream", headers=headers
    )
