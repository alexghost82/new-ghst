"""HTTP routes for the Object Tracking Engine."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from app.services.rate_limiter import rate_limit

from app.config import settings
from app.schemas.requests import (
    DetectionScanRequest,
    FlushDetectionBatchRequest,
    SetDetectionBatchTargetRequest,
    SetTrackingModeRequest,
)
from app.schemas.responses import GhostException, error_response, ok_response
from app.services.detection_batch_service import flush_batch
from app.services.detection_service import get_batch_status, scan_for_objects
from app.storage.conversation_store import get_conversation
from app.storage.database import get_db
from app.storage.detection_batch_store import set_batch_target
from app.storage.detection_store import (
    get_summary,
    get_tracking_enabled,
    list_events,
    list_objects,
    set_tracking_enabled,
)
from app.storage.user_store import get_user_api_key

logger = logging.getLogger("ghost.routes.detection")
router = APIRouter(tags=["detection"])


def _require_conversation(db, conversation_id: str, user_id: str) -> dict:
    conv = get_conversation(db, conversation_id, user_id=user_id)
    if not conv:
        error_response(
            "CONVERSATION_NOT_FOUND",
            "Conversation not found or access denied",
            404,
        )
    return conv  # type: ignore[return-value]


def _require_api_key(db, user_id: str) -> str:
    api_key = get_user_api_key(db, user_id)
    if not api_key:
        error_response(
            "API_KEY_MISSING",
            "No API key configured for this user",
            400,
        )
    return api_key  # type: ignore[return-value]


@router.post(
    "/conversations/{conversation_id}/detection/scan",
    # Generous ceiling: live tracking scans at a high cadence across cameras,
    # so this only trips on a pathological flood, not normal operation.
    dependencies=[Depends(rate_limit("detection_scan", 1500, 60))],
)
async def detection_scan_endpoint(
    conversation_id: str, req: DetectionScanRequest
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        api_key = _require_api_key(db, req.user_id)
        result = await scan_for_objects(
            db=db,
            conversation_id=conversation_id,
            image_base64=req.image_base64,
            camera_device_id=req.device_id,
            camera_label=req.camera_label,
            captured_at=req.captured_at,
            api_key=api_key,
        )
        return ok_response(result)
    except GhostException:
        raise
    except Exception:
        logger.exception("Detection scan failed")
        error_response("DETECTION_SCAN_FAILED", "Detection scan failed", 500)
    finally:
        db.close()


@router.put("/conversations/{conversation_id}/detection/mode")
async def set_tracking_mode_endpoint(
    conversation_id: str, req: SetTrackingModeRequest
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        ok = set_tracking_enabled(db, conversation_id, req.enabled)
        if not ok:
            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )
        return ok_response({"tracking_enabled": req.enabled})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to set tracking mode")
        error_response(
            "TRACKING_MODE_UPDATE_FAILED",
            "Failed to update tracking mode",
            500,
        )
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/detection/mode")
async def get_tracking_mode_endpoint(
    conversation_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        enabled = get_tracking_enabled(db, conversation_id)
        return ok_response({"tracking_enabled": enabled})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to read tracking mode")
        error_response(
            "TRACKING_MODE_READ_FAILED",
            "Failed to read tracking mode",
            500,
        )
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/detection/events")
async def list_detection_events_endpoint(
    conversation_id: str,
    user_id: str = Query(...),
    limit: int = Query(100, ge=1, le=500),
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        return ok_response(list_events(db, conversation_id, limit=limit))
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list detection events")
        error_response(
            "DETECTION_EVENTS_LIST_FAILED",
            "Failed to list detection events",
            500,
        )
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/detection/objects")
async def list_detected_objects_endpoint(
    conversation_id: str,
    user_id: str = Query(...),
    limit: int = Query(200, ge=1, le=1000),
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        objects = list_objects(db, conversation_id, limit=limit)
        summary = get_summary(db, conversation_id)
        return ok_response({"objects": objects, "summary": summary})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list detected objects")
        error_response(
            "DETECTION_OBJECTS_LIST_FAILED",
            "Failed to list detected objects",
            500,
        )
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/detection/batch")
async def get_batch_status_endpoint(
    conversation_id: str,
    user_id: str = Query(...),
):
    """Current crop queue progress + recent batch history."""

    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        return ok_response(
            get_batch_status(db=db, conversation_id=conversation_id)
        )
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to read detection batch status")
        error_response(
            "DETECTION_BATCH_STATUS_FAILED",
            "Failed to read detection batch status",
            500,
        )
    finally:
        db.close()


@router.put("/conversations/{conversation_id}/detection/batch/target")
async def set_batch_target_endpoint(
    conversation_id: str,
    req: SetDetectionBatchTargetRequest,
):
    """Operator-tunable batch target. Clamped 1..``detection_batch_target_max``."""

    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        try:
            clamped = set_batch_target(
                db,
                conversation_id,
                req.target,
                maximum=settings.detection_batch_target_max,
            )
        except ValueError:
            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )
        return ok_response({"target_count": clamped})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to set detection batch target")
        error_response(
            "DETECTION_BATCH_TARGET_FAILED",
            "Failed to set batch target",
            500,
        )
    finally:
        db.close()


@router.post("/conversations/{conversation_id}/detection/batch/flush")
async def flush_batch_endpoint(
    conversation_id: str,
    req: FlushDetectionBatchRequest,
):
    """Manual flush — build a collage from whatever is pending and send
    it to Ghost Vision now, even if the queue hasn't reached its target."""

    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        api_key = _require_api_key(db, req.user_id)
        result = await flush_batch(
            db=db,
            conversation_id=conversation_id,
            api_key=api_key,
            triggered_by="manual",
        )
        return ok_response(result)
    except GhostException:
        raise
    except Exception:
        logger.exception("Manual detection batch flush failed")
        error_response(
            "DETECTION_BATCH_FLUSH_FAILED",
            "Manual batch flush failed",
            500,
        )
    finally:
        db.close()
