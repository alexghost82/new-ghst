"""API routes for the conversational automation builder.

Operators describe an alert or task in free language from the composer; these
endpoints parse the request into a reviewable draft, let the operator edit it,
and on confirm materialise it into the existing alert / task pipelines.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query

from app.schemas.requests import (
    ConfirmAutomationDraftRequest,
    ParseAutomationRequest,
    UpdateAutomationDraftRequest,
)
from app.schemas.responses import GhostException, error_response, ok_response
from app.services.automation_service import (
    confirm_draft,
    dismiss_draft,
    parse_and_draft,
    update_draft,
)
from app.storage.automation_store import get_draft, list_drafts
from app.storage.conversation_store import get_conversation
from app.storage.database import get_db
from app.storage.task_store import count_active_tasks
from app.storage.user_store import get_user_api_key

logger = logging.getLogger("ghost.routes.automations")
router = APIRouter(tags=["automations"])

_MAX_ACTIVE_TASKS_PER_CONVERSATION = 10


def _require_conversation(db, conversation_id: str, user_id: str) -> dict:
    conv = get_conversation(db, conversation_id, user_id=user_id)
    if not conv:
        error_response(
            "CONVERSATION_NOT_FOUND",
            "Conversation not found or access denied",
            404,
        )
    return conv  # type: ignore[return-value]


def _require_standard_user(db, user_id: str) -> None:
    """Automations are blocked for public-trial sessions — they create
    standing rules / recurring model calls on the shared demo key."""
    row = db.execute(
        "SELECT origin FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not row:
        error_response("USER_NOT_FOUND", "User not found", 404)
    if (row["origin"] or "standard") == "trial":
        error_response(
            "AUTOMATIONS_TRIAL_BLOCKED",
            "Automations are not available in trial sessions",
            403,
        )


def _require_draft_for_user(db, draft_id: str, user_id: str) -> dict:
    draft = get_draft(db, draft_id)
    if not draft:
        error_response("AUTOMATION_DRAFT_NOT_FOUND", "Draft not found", 404)
        raise AssertionError  # pragma: no cover
    _require_conversation(db, draft["conversation_id"], user_id)
    return draft


@router.post("/conversations/{conversation_id}/automations/parse")
async def parse_automation_endpoint(
    conversation_id: str, req: ParseAutomationRequest
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, req.user_id)
        # Tasks issue recurring model calls, so they stay blocked for public
        # trial sessions (mirrors the tasks route). Alerts are ungated for
        # trials exactly like manual alert-rule creation, so alert automations
        # are allowed for trial sessions too.
        if req.kind == "task":
            _require_standard_user(db, req.user_id)
        api_key = get_user_api_key(db, req.user_id)
        if not api_key:
            error_response("API_KEY_MISSING", "No API key on file", 400)
        draft = await parse_and_draft(
            db,
            conversation_id=conversation_id,
            user_id=req.user_id,
            kind=req.kind,
            text=req.text,
            client_now=req.client_now,
            locale=req.locale or "he",
            api_key=api_key,
        )
        return ok_response(draft, status_code=201)
    except GhostException:
        raise
    except RuntimeError:
        logger.exception("Automation parse failed")
        error_response(
            "AUTOMATION_PARSE_FAILED",
            "Ghost could not read that request. Try rephrasing it.",
            502,
        )
    except Exception:
        logger.exception("Failed to parse automation request")
        error_response(
            "AUTOMATION_PARSE_FAILED", "Failed to parse request", 500
        )
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/automations/drafts")
async def list_drafts_endpoint(
    conversation_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        return ok_response(list_drafts(db, conversation_id))
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list automation drafts")
        error_response(
            "AUTOMATION_DRAFTS_LIST_FAILED", "Failed to list drafts", 500
        )
    finally:
        db.close()


@router.patch("/automations/drafts/{draft_id}")
async def update_draft_endpoint(
    draft_id: str, req: UpdateAutomationDraftRequest
):
    db = get_db()
    try:
        draft = _require_draft_for_user(db, draft_id, req.user_id)
        updated = update_draft(db, draft=draft, payload_patch=req.payload)
        return ok_response(updated)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update automation draft")
        error_response(
            "AUTOMATION_DRAFT_UPDATE_FAILED", "Failed to update draft", 500
        )
    finally:
        db.close()


@router.post("/automations/drafts/{draft_id}/confirm")
async def confirm_draft_endpoint(
    draft_id: str, req: ConfirmAutomationDraftRequest
):
    db = get_db()
    try:
        draft = _require_draft_for_user(db, draft_id, req.user_id)
        # Only task confirmation is trial-gated (recurring model calls); alert
        # rule creation is allowed for trials, matching the alerts route.
        if draft["kind"] == "task":
            _require_standard_user(db, req.user_id)
        if (
            req.activate
            and draft["kind"] == "task"
            and count_active_tasks(db, draft["conversation_id"])
            >= _MAX_ACTIVE_TASKS_PER_CONVERSATION
        ):
            error_response(
                "TASKS_LIMIT_REACHED",
                "Active task limit reached for this conversation",
                400,
            )
        result = confirm_draft(db, draft=draft, activate=req.activate)
        return ok_response(result)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to confirm automation draft")
        error_response(
            "AUTOMATION_DRAFT_CONFIRM_FAILED", "Failed to confirm draft", 500
        )
    finally:
        db.close()


@router.post("/automations/drafts/{draft_id}/dismiss")
async def dismiss_draft_endpoint(draft_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        draft = _require_draft_for_user(db, draft_id, user_id)
        result = dismiss_draft(db, draft=draft)
        return ok_response(result)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to dismiss automation draft")
        error_response(
            "AUTOMATION_DRAFT_DISMISS_FAILED", "Failed to dismiss draft", 500
        )
    finally:
        db.close()
