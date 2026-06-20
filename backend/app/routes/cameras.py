from __future__ import annotations

import logging

from fastapi import APIRouter, Query

from app.schemas.requests import SaveCameraSetupRequest
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.camera_store import (
    delete_cameras,
    list_cameras,
    replace_cameras,
)
from app.storage.conversation_store import get_conversation
from app.storage.database import get_db

logger = logging.getLogger("ghost.routes.cameras")
router = APIRouter(tags=["cameras"])


@router.get("/conversations/{conversation_id}/cameras")
async def list_cameras_endpoint(
    conversation_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )
        return ok_response(list_cameras(db, conversation_id))
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list cameras")
        error_response("CAMERAS_LIST_FAILED", "Failed to list cameras", 500)
    finally:
        db.close()


@router.put("/conversations/{conversation_id}/cameras")
async def save_cameras_endpoint(
    conversation_id: str, req: SaveCameraSetupRequest
):
    db = get_db()
    try:
        conv = get_conversation(db, conversation_id, user_id=req.user_id)
        if not conv:
            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )

        cameras = [cam.model_dump() for cam in req.cameras]
        saved = replace_cameras(db, conversation_id, cameras)
        return ok_response(saved)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to save cameras")
        error_response("CAMERAS_SAVE_FAILED", "Failed to save camera setup", 500)
    finally:
        db.close()


@router.delete("/conversations/{conversation_id}/cameras")
async def clear_cameras_endpoint(
    conversation_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )
        deleted = delete_cameras(db, conversation_id)
        return ok_response({"deleted": deleted})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to clear cameras")
        error_response("CAMERAS_CLEAR_FAILED", "Failed to clear cameras", 500)
    finally:
        db.close()
