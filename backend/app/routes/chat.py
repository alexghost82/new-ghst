from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from starlette.responses import StreamingResponse

from app.services.rate_limiter import rate_limit

from app.schemas.requests import (
    BroadcastExploreRequest,
    BroadcastMessageRequest,
    SendMessageRequest,
)
from app.schemas.responses import GhostException, error_response, ok_response
from app.services.chat_service import (
    handle_broadcast_explore,
    handle_broadcast_message,
    handle_send_message,
)
from app.storage.database import get_db
from app.storage.conversation_store import get_conversation
from app.storage.user_store import get_user_api_key
from app.storage.memory_store import delete_memory_item, get_memory_item, list_memory_items
from app.storage.message_store import list_messages
from app.storage.visual_memory_store import (
    get_summary as get_visual_summary,
    list_entities as list_visual_entities,
    list_recent_observations as list_visual_observations,
)
from app.dependencies import get_vector_store

logger = logging.getLogger("ghost.routes.chat")
router = APIRouter(tags=["chat"])


@router.post(
    "/conversations/{conversation_id}/messages",
    dependencies=[Depends(rate_limit("chat_send", 60, 60))],
)
async def send_message(conversation_id: str, req: SendMessageRequest):
    db = get_db()
    vs = get_vector_store()

    conv = get_conversation(db, conversation_id, user_id=req.user_id)
    if not conv:
        db.close()
        error_response("CONVERSATION_NOT_FOUND", "Conversation not found or access denied", 404)

    camera_frames_payload = (
        [cam.model_dump() for cam in req.camera_frames]
        if req.camera_frames
        else None
    )

    async def event_generator():
        try:
            async for event in handle_send_message(
                conversation_id=conversation_id,
                user_id=req.user_id,
                content=req.content,
                db=db,
                vector_store=vs,
                image_base64=req.image_base64,
                camera_frames=camera_frames_payload,
                locale=req.locale or "he",
                mode=req.mode or "chat",
                task_id=req.task_id,
                camera_label=req.camera_label,
            ):
                yield event
        finally:
            db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post(
    "/broadcast/messages",
    dependencies=[Depends(rate_limit("broadcast", 20, 60))],
)
async def broadcast_message(req: BroadcastMessageRequest):
    """Ephemeral area/group broadcast. Fans one message out to every supplied
    camera frame and streams a labelled reply per camera, persisting nothing."""
    db = get_db()
    try:
        api_key = get_user_api_key(db, req.user_id)
    finally:
        db.close()

    if not api_key:
        error_response("API_KEY_MISSING", "No API key configured for this user", 400)

    camera_frames_payload = [cam.model_dump() for cam in req.camera_frames]

    async def event_generator():
        async for event in handle_broadcast_message(
            content=req.content,
            camera_frames=camera_frames_payload,
            api_key=api_key,
            locale=req.locale or "he",
            system_prompt=req.system_prompt or "",
            scope_label=req.scope_label,
        ):
            yield event

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post(
    "/broadcast/explore",
    dependencies=[Depends(rate_limit("broadcast", 20, 60))],
)
async def broadcast_explore(req: BroadcastExploreRequest):
    """Ephemeral area/group "explore" turn. For each conversation in scope,
    answers the operator's message from that conversation's STORED text history
    (no live camera capture) and streams one warm reply per conversation,
    persisting nothing."""
    db = get_db()
    try:
        api_key = get_user_api_key(db, req.user_id)
    finally:
        db.close()

    if not api_key:
        error_response("API_KEY_MISSING", "No API key configured for this user", 400)

    async def event_generator():
        async for event in handle_broadcast_explore(
            content=req.content,
            conversation_ids=req.conversation_ids,
            user_id=req.user_id,
            api_key=api_key,
            locale=req.locale or "he",
            scope_label=req.scope_label,
        ):
            yield event

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    user_id: str = Query(...),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    db = get_db()
    try:
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            error_response("CONVERSATION_NOT_FOUND", "Conversation not found or access denied", 404)

        msgs = list_messages(db, conversation_id, limit=limit, offset=offset)
        return ok_response(msgs)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to get messages")
        error_response("MESSAGES_GET_FAILED", "Failed to get messages", 500)
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/memory")
async def get_memory(conversation_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            error_response("CONVERSATION_NOT_FOUND", "Conversation not found or access denied", 404)

        items = list_memory_items(db, conversation_id)
        return ok_response(items)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to get memory")
        error_response("MEMORY_GET_FAILED", "Failed to get memory items", 500)
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/visual-memory")
async def get_visual_memory(
    conversation_id: str,
    user_id: str = Query(...),
    observation_limit: int = Query(80, ge=1, le=500),
    entity_limit: int = Query(60, ge=1, le=200),
):
    """Return the persisted visual memory for this conversation: deduplicated
    entities (people / vehicles / environment / objects), the most recent raw
    observations, and a per-type summary. Used by the frontend Observations
    panel."""
    db = get_db()
    try:
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )

        entities = list_visual_entities(db, conversation_id, limit=entity_limit)
        observations = list_visual_observations(
            db, conversation_id, limit=observation_limit
        )
        summary = get_visual_summary(db, conversation_id)
        return ok_response(
            {
                "entities": entities,
                "observations": observations,
                "summary": summary,
            }
        )
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to get visual memory")
        error_response(
            "VISUAL_MEMORY_GET_FAILED",
            "Failed to get visual memory",
            500,
        )
    finally:
        db.close()


@router.delete("/conversations/{conversation_id}/memory/{memory_id}")
async def delete_memory(
    conversation_id: str, memory_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        vs = get_vector_store()
        # Ownership: the conversation must belong to the caller before any of
        # its memory items can be deleted.
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            error_response("CONVERSATION_NOT_FOUND", "Conversation not found", 404)
        item = get_memory_item(db, memory_id)
        if not item or item["conversation_id"] != conversation_id:
            error_response("MEMORY_NOT_FOUND", "Memory item not found", 404)

        delete_memory_item(db, memory_id)
        vs.delete_memory(conversation_id, memory_id)
        return ok_response({"deleted": True})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to delete memory item")
        error_response("MEMORY_DELETE_FAILED", "Failed to delete memory item", 500)
    finally:
        db.close()
