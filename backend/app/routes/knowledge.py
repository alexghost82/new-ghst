from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.services.rate_limiter import rate_limit

from app.schemas.requests import UpdateKnowledgeSourceRequest
from app.schemas.responses import GhostException, error_response, ok_response
from app.services.knowledge_service import delete_source, ingest_file, ingest_text, re_ingest_text
from app.storage.database import get_db
from app.storage.knowledge_store import (
    get_knowledge_source,
    list_knowledge_chunks,
    list_knowledge_sources,
    update_knowledge_source,
)
from app.storage.user_store import get_user, get_user_api_key
from app.dependencies import get_vector_store

logger = logging.getLogger("ghost.routes.knowledge")
router = APIRouter(tags=["knowledge"])


@router.post(
    "/knowledge/sources",
    dependencies=[Depends(rate_limit("knowledge_ingest", 30, 60))],
)
async def create_knowledge_source_endpoint(
    user_id: str = Form(...),
    source_type: str = Form(...),
    content: str | None = Form(None),
    tags: str = Form("[]"),
    file: UploadFile | None = File(None),
):
    db = get_db()
    try:
        vs = get_vector_store()

        user = get_user(db, user_id)
        if not user:
            error_response("USER_NOT_FOUND", "User not found", 404)

        api_key = get_user_api_key(db, user_id)
        if not api_key:
            error_response("API_KEY_MISSING", "No API key configured for this user", 400)

        try:
            parsed_tags = json.loads(tags) if isinstance(tags, str) else tags
        except json.JSONDecodeError:
            parsed_tags = []

        if source_type == "file":
            if not file:
                error_response("FILE_REQUIRED", "File is required for source_type=file", 400)
            source = await ingest_file(
                user_id, file, api_key, db, vs, tags=parsed_tags
            )
        elif source_type == "text":
            if not content:
                error_response("CONTENT_REQUIRED", "Content is required for source_type=text", 400)
            source = await ingest_text(
                user_id, content, api_key, db, vs, tags=parsed_tags
            )
        else:
            error_response("INVALID_SOURCE_TYPE", "source_type must be 'file' or 'text'", 400)

        return ok_response(source, status_code=201)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to create knowledge source")
        error_response("KNOWLEDGE_CREATE_FAILED", "Failed to create knowledge source", 500)
    finally:
        db.close()


@router.get("/knowledge/sources")
async def list_knowledge_sources_endpoint(user_id: str = Query(...)):
    db = get_db()
    try:
        sources = list_knowledge_sources(db, user_id)
        return ok_response(sources)
    finally:
        db.close()


@router.delete("/knowledge/sources/{source_id}")
async def delete_knowledge_source_endpoint(source_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        vs = get_vector_store()
        source = get_knowledge_source(db, source_id, user_id=user_id)
        if not source:
            error_response("SOURCE_NOT_FOUND", "Knowledge source not found", 404)

        delete_source(user_id, source_id, db, vs)
        return ok_response({"deleted": True})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to delete knowledge source")
        error_response("KNOWLEDGE_DELETE_FAILED", "Failed to delete knowledge source", 500)
    finally:
        db.close()


@router.patch("/knowledge/sources/{source_id}")
async def update_knowledge_source_endpoint(
    source_id: str, req: UpdateKnowledgeSourceRequest, user_id: str = Query(...)
):
    db = get_db()
    try:
        vs = get_vector_store()
        source = get_knowledge_source(db, source_id, user_id=user_id)
        if not source:
            error_response("SOURCE_NOT_FOUND", "Knowledge source not found", 404)

        if req.content is not None and source["source_type"] == "text":
            api_key = get_user_api_key(db, user_id)
            if not api_key:
                error_response("API_KEY_MISSING", "No API key configured for this user", 400)
            updated = await re_ingest_text(
                source_id, user_id, req.content, api_key, db, vs
            )
            if req.filename is not None:
                updated = update_knowledge_source(db, source_id, filename=req.filename)
            if req.is_active is not None or req.tags is not None:
                updated = update_knowledge_source(
                    db, source_id, is_active=req.is_active, tags=req.tags
                )
        else:
            updated = update_knowledge_source(
                db, source_id, is_active=req.is_active, tags=req.tags, filename=req.filename
            )
        return ok_response(updated)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update knowledge source")
        error_response("KNOWLEDGE_UPDATE_FAILED", "Failed to update knowledge source", 500)
    finally:
        db.close()


@router.get("/knowledge/sources/{source_id}/chunks")
async def get_knowledge_chunks_endpoint(
    source_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        source = get_knowledge_source(db, source_id, user_id=user_id)
        if not source:
            error_response("SOURCE_NOT_FOUND", "Knowledge source not found", 404)

        chunks = list_knowledge_chunks(db, source_id)
        return ok_response(chunks)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to get knowledge chunks")
        error_response("CHUNKS_GET_FAILED", "Failed to get knowledge chunks", 500)
    finally:
        db.close()
