from __future__ import annotations

import logging

from fastapi import APIRouter, Query, Request

from app.schemas.requests import (
    AutoTitleRequest,
    CreateConversationRequest,
    UpdateConversationRequest,
)
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.database import get_db
from app.storage.conversation_store import (
    create_conversation,
    delete_conversation,
    get_conversation,
    list_conversations,
    update_conversation,
)
from app.storage.message_store import get_recent_messages
from app.storage.user_store import get_user, get_user_api_key
from app.dependencies import get_vector_store
from app.services.openai_client import generate_conversation_title

logger = logging.getLogger("ghost.routes.conversations")
router = APIRouter(tags=["conversations"])


def _client_ip(request: Request) -> str | None:
    """Best-effort origin IP, derived server-side so it cannot be spoofed by
    the caller. Honours the first hop of ``X-Forwarded-For`` (reverse proxy /
    tunnel deployments) and falls back to the direct socket peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return None


@router.post("/conversations")
async def create_conversation_endpoint(req: CreateConversationRequest, request: Request):
    db = get_db()
    try:
        user = get_user(db, req.user_id)
        if not user:
            error_response("USER_NOT_FOUND", "User not found", 404)

        conv = create_conversation(
            db,
            user_id=req.user_id,
            title=req.title or "",
            system_prompt=req.system_prompt or "",
            origin_ip=_client_ip(request),
            lead_name=(req.lead_name or "").strip() or None,
            lead_email=(req.lead_email or "").strip() or None,
            lead_phone=(req.lead_phone or "").strip() or None,
        )
        return ok_response(conv, status_code=201)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to create conversation")
        error_response("CONVERSATION_CREATE_FAILED", "Failed to create conversation", 500)
    finally:
        db.close()


@router.get("/conversations")
async def list_conversations_endpoint(
    request: Request,
    user_id: str = Query(...),
    scope_ip: bool = Query(False),
):
    db = get_db()
    try:
        # Trial sessions pass ``scope_ip=1`` so a visitor only sees the
        # conversations they created from this same IP. Admin / standard
        # sessions omit it and see everything owned by the user.
        origin_ip = _client_ip(request) if scope_ip else None
        convs = list_conversations(db, user_id, origin_ip=origin_ip)
        return ok_response(convs)
    finally:
        db.close()


@router.get("/conversations/{conversation_id}")
async def get_conversation_endpoint(conversation_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            error_response("CONVERSATION_NOT_FOUND", "Conversation not found", 404)
        return ok_response(conv)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to get conversation")
        error_response("CONVERSATION_GET_FAILED", "Failed to get conversation", 500)
    finally:
        db.close()


@router.patch("/conversations/{conversation_id}")
async def update_conversation_endpoint(
    conversation_id: str,
    req: UpdateConversationRequest,
    user_id: str = Query(...),
):
    db = get_db()
    try:
        # Ownership is enforced here: the conversation must belong to the
        # caller's user_id, otherwise it is treated as not found (no IDOR).
        existing = get_conversation(db, conversation_id, user_id=user_id)
        if not existing:
            error_response("CONVERSATION_NOT_FOUND", "Conversation not found", 404)

        # A bare title change is an operator rename -> lock it as 'manual' so the
        # auto-naming orchestrator never overwrites it. An explicit title_source
        # (e.g. the auto-title endpoint) takes precedence.
        title_source = req.title_source
        if title_source is None and req.title is not None:
            title_source = "manual"

        contacts = (
            [c.model_dump() for c in req.escalation_contacts]
            if req.escalation_contacts is not None
            else None
        )

        conv = update_conversation(
            db,
            conversation_id,
            title=req.title,
            system_prompt=req.system_prompt,
            accuracy_level=req.accuracy_level,
            response_length=req.response_length,
            image_detail=req.image_detail,
            title_source=title_source,
            agent_name=req.agent_name,
            role_mission=req.role_mission,
            site_type=req.site_type,
            focus_priorities=req.focus_priorities,
            ignore_scope=req.ignore_scope,
            site_baseline=req.site_baseline,
            persona_tone=req.persona_tone,
            dry_humor=req.dry_humor,
            proactivity=req.proactivity,
            operator_profile=req.operator_profile,
            critical_event_definition=req.critical_event_definition,
            escalation_contacts=contacts,
            quiet_hours=req.quiet_hours,
        )
        return ok_response(conv)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update conversation")
        error_response("CONVERSATION_UPDATE_FAILED", "Failed to update conversation", 500)
    finally:
        db.close()


@router.post("/conversations/{conversation_id}/auto-title")
async def auto_title_conversation_endpoint(
    conversation_id: str, req: AutoTitleRequest
):
    """Generate a short summary title from the conversation's recent turns and
    persist it with ``title_source='auto'``. The frontend orchestrator decides
    *when* to call this (first reply, then every few messages) and never calls
    it for conversations the operator renamed or that live inside an area/group.

    Returns the updated conversation. If generation yields nothing usable the
    existing title is left untouched.
    """
    db = get_db()
    try:
        existing = get_conversation(db, conversation_id, user_id=req.user_id)
        if not existing:
            error_response("CONVERSATION_NOT_FOUND", "Conversation not found", 404)

        # Respect a manual lock even if the client raced a stale state.
        if existing.get("title_source") == "manual":
            return ok_response(existing)

        api_key = get_user_api_key(db, existing["user_id"])
        if not api_key:
            error_response("API_KEY_MISSING", "No API key configured for this user", 400)

        recent = get_recent_messages(db, conversation_id, limit=10)
        turns = [
            {"role": m["role"], "content": m["content"]}
            for m in recent
            if m.get("role") in ("user", "assistant") and (m.get("content") or "").strip()
        ]
        if not turns:
            return ok_response(existing)

        title = await generate_conversation_title(
            turns,
            api_key=api_key,
            locale=req.locale or "he",
            max_words=req.max_words,
        )
        if not title:
            return ok_response(existing)

        conv = update_conversation(
            db,
            conversation_id,
            title=title,
            title_source="auto",
        )
        return ok_response(conv)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to auto-title conversation")
        error_response("CONVERSATION_AUTOTITLE_FAILED", "Failed to auto-title conversation", 500)
    finally:
        db.close()


@router.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        vs = get_vector_store()
        existing = get_conversation(db, conversation_id, user_id=user_id)
        if not existing:
            error_response("CONVERSATION_NOT_FOUND", "Conversation not found", 404)

        vs.delete_conversation_memory(conversation_id)
        delete_conversation(db, conversation_id)
        return ok_response({"deleted": True})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to delete conversation")
        error_response("CONVERSATION_DELETE_FAILED", "Failed to delete conversation", 500)
    finally:
        db.close()
