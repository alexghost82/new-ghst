"""HTTP routes for standalone local / fallback vision analysis."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.config import settings
from app.schemas.requests import LocalVisionAnalyzeRequest
from app.schemas.responses import GhostException, error_response, ok_response
from app.services.rate_limiter import rate_limit
from app.services.vision_analyze_service import analyze_local_vision
from app.storage.conversation_store import get_conversation
from app.storage.database import get_db
from app.storage.user_store import get_user_api_key

logger = logging.getLogger("ghost.routes.vision")
router = APIRouter(tags=["vision"])


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


def _effective_provider(provider: str | None) -> str:
    from app.services.vision_provider import resolve_effective_provider

    return resolve_effective_provider(provider)


def _openai_key_required(provider: str | None) -> bool:
    return _effective_provider(provider) == "openai"


@router.post(
    "/vision/local-analyze",
    dependencies=[Depends(rate_limit("vision_local_analyze", 60, 60))],
)
async def local_vision_analyze_endpoint(req: LocalVisionAnalyzeRequest):
    db = get_db()
    try:
        if req.conversation_id:
            _require_conversation(db, req.conversation_id, req.user_id)

        api_key: str | None = None
        if _openai_key_required(req.provider):
            api_key = _require_api_key(db, req.user_id)
        else:
            api_key = get_user_api_key(db, req.user_id)

        result = await analyze_local_vision(
            db=db,
            user_id=req.user_id,
            image_base64=req.image_base64,
            prompt=req.prompt,
            conversation_id=req.conversation_id,
            camera_id=req.camera_id,
            provider_override=req.provider,
            api_key=api_key,
        )
        return ok_response(result)
    except GhostException:
        raise
    except Exception:
        logger.exception("Local vision analyze failed")
        error_response(
            "VISION_ANALYZE_FAILED",
            "Local vision analysis failed",
            500,
        )
    finally:
        db.close()
