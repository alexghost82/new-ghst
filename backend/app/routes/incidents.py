"""HTTP layer for the incident pipeline.

Pattern mirrors ``alerts.py``: each handler opens a short-lived
``sqlite3.Connection`` via ``get_db()`` and dispatches to the service
layer (`incident_service`). Errors raise :class:`GhostException` so the
existing JSON error envelope is preserved.

All endpoints require ``user_id`` either as a query parameter or in the
request body — there is no session middleware in this codebase.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query

from app.schemas.requests import (
    AddIncidentEvidenceRequest,
    AddIncidentNoteRequest,
    AssignIncidentRequest,
    CloseIncidentRequest,
    InvestigateIncidentRequest,
    UpdateIncidentRequest,
)
from app.schemas.responses import GhostException, error_response, ok_response
from app.services import incident_service
from app.storage.database import get_db
from app.storage.incident_store import (
    INCIDENT_SEVERITIES,
    INCIDENT_STATUSES,
    get_incident,
    list_incidents,
)
from app.storage.user_store import get_user, get_user_api_key

logger = logging.getLogger("ghost.routes.incidents")
router = APIRouter(tags=["incidents"])


def _require_user(user_id: str) -> None:
    db = get_db()
    try:
        if not get_user(db, user_id):
            error_response("USER_NOT_FOUND", "User not found", 404)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Collection / lookup
# ---------------------------------------------------------------------------


@router.get("/incidents")
async def list_incidents_endpoint(
    user_id: str = Query(..., min_length=1),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    if status and status not in INCIDENT_STATUSES:
        error_response(
            "INVALID_STATUS",
            f"status must be one of {INCIDENT_STATUSES}",
            400,
        )
    if severity and severity not in INCIDENT_SEVERITIES:
        error_response(
            "INVALID_SEVERITY",
            f"severity must be one of {INCIDENT_SEVERITIES}",
            400,
        )

    db = get_db()
    try:
        items = list_incidents(
            db,
            user_id,
            status=status,
            severity=severity,
            assigned_to=assigned_to,
            search=search,
            limit=limit,
            offset=offset,
        )
        return ok_response(items)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list incidents")
        error_response("INCIDENTS_LIST_FAILED", "Failed to list incidents", 500)
    finally:
        db.close()


@router.get("/incidents/kpi")
async def incident_kpi_endpoint(
    user_id: str = Query(..., min_length=1),
    window_hours: int = Query(24, ge=1, le=720),
):
    try:
        return ok_response(
            incident_service.fetch_kpi(
                user_id=user_id, window_hours=window_hours
            )
        )
    except Exception:
        logger.exception("Failed to compute incident KPI")
        error_response("INCIDENT_KPI_FAILED", "Failed to compute KPI", 500)


@router.get("/incidents/{incident_id}")
async def get_incident_endpoint(
    incident_id: str,
    user_id: str = Query(..., min_length=1),
):
    bundle = incident_service.fetch_full_incident(
        incident_id=incident_id, user_id=user_id
    )
    if not bundle:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
    return ok_response(bundle)


@router.patch("/incidents/{incident_id}")
async def patch_incident_endpoint(
    incident_id: str, req: UpdateIncidentRequest
):
    try:
        assigned_to_changed = (
            req.assigned_to is not None or bool(req.clear_assignment)
        )
        target_assignee = (
            None if req.clear_assignment else req.assigned_to
        )
        updated = incident_service.patch_incident(
            incident_id=incident_id,
            user_id=req.user_id,
            actor=req.user_id,
            status=req.status,
            severity=req.severity,
            tags=req.tags,
            assigned_to=target_assignee,
            assigned_to_changed=assigned_to_changed,
        )
        if not updated:
            error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
        return ok_response(updated)
    except GhostException:
        raise
    except ValueError as exc:
        error_response("INVALID_INCIDENT_PATCH", str(exc), 400)
    except Exception:
        logger.exception("Failed to update incident")
        error_response(
            "INCIDENT_UPDATE_FAILED", "Failed to update incident", 500
        )


@router.post("/incidents/{incident_id}/assign")
async def assign_incident_endpoint(
    incident_id: str, req: AssignIncidentRequest
):
    try:
        updated = incident_service.assign_incident(
            incident_id=incident_id,
            user_id=req.user_id,
            assignee_id=req.assignee_id,
            actor=req.user_id,
        )
        if not updated:
            error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
        return ok_response(updated)
    except GhostException:
        raise
    except ValueError as exc:
        error_response("INVALID_ASSIGNEE", str(exc), 400)
    except Exception:
        logger.exception("Failed to assign incident")
        error_response(
            "INCIDENT_ASSIGN_FAILED", "Failed to assign incident", 500
        )


@router.post("/incidents/{incident_id}/notes")
async def add_incident_note_endpoint(
    incident_id: str, req: AddIncidentNoteRequest
):
    note = incident_service.add_incident_note(
        incident_id=incident_id,
        user_id=req.user_id,
        author=req.user_id,
        content=req.content,
    )
    if not note:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
    return ok_response(note, status_code=201)


@router.post("/incidents/{incident_id}/evidence")
async def add_incident_evidence_endpoint(
    incident_id: str, req: AddIncidentEvidenceRequest
):
    evidence = incident_service.add_incident_evidence(
        incident_id=incident_id,
        user_id=req.user_id,
        evidence_type=req.type,
        actor=req.user_id,
        image_path=req.image_path,
        observation_id=req.observation_id,
        entity_id=req.entity_id,
        alert_event_id=req.alert_event_id,
    )
    if not evidence:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
    return ok_response(evidence, status_code=201)


@router.post("/incidents/{incident_id}/close")
async def close_incident_endpoint(
    incident_id: str, req: CloseIncidentRequest
):
    updated = incident_service.close_incident(
        incident_id=incident_id,
        user_id=req.user_id,
        actor=req.user_id,
        resolution=req.resolution,
    )
    if not updated:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)

    # If the operator supplied a manual closure summary it is now stored
    # on ``incident_events.summary``. We deliberately skip the AI summary
    # generation so we don't clobber the human-authored text.
    manual_resolution = bool(updated.pop("manual_resolution", False)) if updated else False
    if not manual_resolution:
        db = get_db()
        try:
            api_key = get_user_api_key(db, req.user_id)
        finally:
            db.close()

        incident_service.schedule_summary(
            incident_id=incident_id,
            user_id=req.user_id,
            api_key=api_key,
            locale="he",
        )
    return ok_response(updated)


@router.get("/incidents/{incident_id}/timeline")
async def get_incident_timeline_endpoint(
    incident_id: str,
    user_id: str = Query(..., min_length=1),
):
    items = incident_service.fetch_timeline(
        incident_id=incident_id, user_id=user_id
    )
    if items is None:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
    return ok_response(items)


@router.get("/incidents/{incident_id}/evidence")
async def get_incident_evidence_endpoint(
    incident_id: str,
    user_id: str = Query(..., min_length=1),
):
    items = incident_service.fetch_evidence(
        incident_id=incident_id, user_id=user_id
    )
    if items is None:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
    return ok_response(items)


@router.get("/incidents/{incident_id}/correlated")
async def get_incident_correlated_endpoint(
    incident_id: str,
    user_id: str = Query(..., min_length=1),
):
    result = incident_service.correlate_entities(
        incident_id=incident_id, user_id=user_id
    )
    if result is None:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
    return ok_response(result)


@router.post("/incidents/{incident_id}/investigate")
async def investigate_incident_endpoint(
    incident_id: str, req: InvestigateIncidentRequest
):
    result = incident_service.ensure_investigation_conversation(
        incident_id=incident_id,
        user_id=req.user_id,
        locale=req.locale or "he",
    )
    if not result:
        error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
    return ok_response(result)


@router.post("/incidents/{incident_id}/summary")
async def regenerate_summary_endpoint(
    incident_id: str, req: InvestigateIncidentRequest
):
    """Force a fresh AI summary on demand (e.g. operator clicks 'Refresh
    summary'). Idempotent: subsequent calls overwrite ``summary``."""

    db = get_db()
    try:
        if not get_incident(db, incident_id, user_id=req.user_id):
            error_response("INCIDENT_NOT_FOUND", "Incident not found", 404)
        api_key = get_user_api_key(db, req.user_id)
    finally:
        db.close()

    if not api_key:
        error_response(
            "API_KEY_MISSING",
            "No API key configured for this user",
            400,
        )

    result = await incident_service.generate_incident_summary(
        incident_id=incident_id,
        user_id=req.user_id,
        api_key=api_key,
        locale=req.locale or "he",
    )
    return ok_response(result or {})
