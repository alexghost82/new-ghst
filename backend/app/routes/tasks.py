"""API routes for scheduled tasks (משימות).

Tasks are per-conversation automated messages executed by the browser task
engine. The server is the source of truth for the schedule: the engine asks
to *claim* a run before sending anything, and a single conditional UPDATE
guarantees one winner across tabs/devices.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query

from app.schemas.requests import (
    ClaimScheduledTaskRequest,
    CreateScheduledTaskRequest,
    CreateTaskTriggerRequest,
    UpdateScheduledTaskRequest,
    UpdateTaskTriggerRequest,
)
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.conversation_store import get_conversation
from app.storage.database import get_db
from app.storage.task_store import (
    claim_task,
    count_active_tasks,
    count_triggers,
    create_task,
    create_trigger,
    delete_task,
    delete_trigger,
    get_task,
    get_trigger,
    list_reports,
    list_tasks,
    list_triggers,
    update_task,
    update_trigger,
)

logger = logging.getLogger("ghost.routes.tasks")
router = APIRouter(tags=["tasks"])

_MAX_ACTIVE_TASKS_PER_CONVERSATION = 10
_MAX_TRIGGERS_PER_TASK = 10


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
    """Tasks are blocked for public-trial sessions — recurring automated
    model calls on the shared demo key are an easy cost/abuse vector."""
    row = db.execute(
        "SELECT origin FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not row:
        error_response("USER_NOT_FOUND", "User not found", 404)
    if (row["origin"] or "standard") == "trial":
        error_response(
            "TASKS_TRIAL_BLOCKED",
            "Scheduled tasks are not available in trial sessions",
            403,
        )


def _require_task_for_user(db, task_id: str, user_id: str) -> dict:
    task = get_task(db, task_id)
    if not task:
        error_response("TASK_NOT_FOUND", "Task not found", 404)
        raise AssertionError  # pragma: no cover
    _require_conversation(db, task["conversation_id"], user_id)
    return task


def _validate_schedule_fields(
    schedule_type: str,
    run_at: str | None,
    interval_seconds: int | None,
    daily_time: str | None,
) -> None:
    if schedule_type == "once" and not run_at:
        error_response(
            "TASK_SCHEDULE_INVALID", "run_at is required for a one-time task", 400
        )
    if schedule_type == "interval" and not interval_seconds:
        error_response(
            "TASK_SCHEDULE_INVALID",
            "interval_seconds is required for an interval task",
            400,
        )
    if schedule_type == "daily" and not daily_time:
        error_response(
            "TASK_SCHEDULE_INVALID",
            "daily_time is required for a daily task",
            400,
        )


def _task_with_triggers(db, task: dict) -> dict:
    return {**task, "triggers": list_triggers(db, task["id"])}


@router.get("/conversations/{conversation_id}/tasks")
async def list_tasks_endpoint(
    conversation_id: str, user_id: str = Query(...)
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        tasks = [
            _task_with_triggers(db, t) for t in list_tasks(db, conversation_id)
        ]
        return ok_response(tasks)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list tasks")
        error_response("TASKS_LIST_FAILED", "Failed to list tasks", 500)
    finally:
        db.close()


@router.post("/conversations/{conversation_id}/tasks")
async def create_task_endpoint(
    conversation_id: str, req: CreateScheduledTaskRequest
):
    db = get_db()
    try:
        _require_standard_user(db, req.user_id)
        _require_conversation(db, conversation_id, req.user_id)
        _validate_schedule_fields(
            req.schedule_type, req.run_at, req.interval_seconds, req.daily_time
        )
        if (
            count_active_tasks(db, conversation_id)
            >= _MAX_ACTIVE_TASKS_PER_CONVERSATION
        ):
            error_response(
                "TASKS_LIMIT_REACHED",
                "Active task limit reached for this conversation",
                400,
            )
        task = create_task(
            db,
            conversation_id=conversation_id,
            name=req.name.strip(),
            prompt_text=req.prompt_text.strip(),
            schedule_type=req.schedule_type,
            run_at=req.run_at,
            interval_seconds=req.interval_seconds,
            daily_time=req.daily_time,
            include_camera=req.include_camera,
        )
        if req.schedule_type == "once" and not task.get("next_run_at"):
            # The supplied timestamp was unparseable — surface it instead of
            # silently creating a task that will never run.
            delete_task(db, task["id"])
            error_response(
                "TASK_SCHEDULE_INVALID", "run_at timestamp is invalid", 400
            )
        return ok_response(_task_with_triggers(db, task), status_code=201)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to create task")
        error_response("TASK_CREATE_FAILED", "Failed to create task", 500)
    finally:
        db.close()


@router.patch("/tasks/{task_id}")
async def update_task_endpoint(task_id: str, req: UpdateScheduledTaskRequest):
    db = get_db()
    try:
        _require_standard_user(db, req.user_id)
        existing = _require_task_for_user(db, task_id, req.user_id)

        effective_type = req.schedule_type or existing["schedule_type"]
        _validate_schedule_fields(
            effective_type,
            req.run_at or existing.get("run_at"),
            req.interval_seconds or existing.get("interval_seconds"),
            req.daily_time or existing.get("daily_time"),
        )
        if req.is_active and not existing["is_active"]:
            if (
                count_active_tasks(db, existing["conversation_id"])
                >= _MAX_ACTIVE_TASKS_PER_CONVERSATION
            ):
                error_response(
                    "TASKS_LIMIT_REACHED",
                    "Active task limit reached for this conversation",
                    400,
                )

        updated = update_task(
            db,
            task_id,
            name=req.name.strip() if req.name else None,
            prompt_text=req.prompt_text.strip() if req.prompt_text else None,
            schedule_type=req.schedule_type,
            run_at=req.run_at,
            interval_seconds=req.interval_seconds,
            daily_time=req.daily_time,
            include_camera=req.include_camera,
            is_active=req.is_active,
        )
        if not updated:
            error_response("TASK_NOT_FOUND", "Task not found", 404)
        return ok_response(_task_with_triggers(db, updated))
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update task")
        error_response("TASK_UPDATE_FAILED", "Failed to update task", 500)
    finally:
        db.close()


@router.delete("/tasks/{task_id}")
async def delete_task_endpoint(task_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        _require_task_for_user(db, task_id, user_id)
        deleted = delete_task(db, task_id)
        return ok_response({"deleted": deleted})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to delete task")
        error_response("TASK_DELETE_FAILED", "Failed to delete task", 500)
    finally:
        db.close()


@router.post("/tasks/{task_id}/claim")
async def claim_task_endpoint(task_id: str, req: ClaimScheduledTaskRequest):
    """Atomically claim a due run. 200 = this caller runs the task now;
    409 = not due / already claimed by another tab or device."""
    db = get_db()
    try:
        _require_standard_user(db, req.user_id)
        _require_task_for_user(db, task_id, req.user_id)
        claimed = claim_task(db, task_id)
        if not claimed:
            error_response(
                "TASK_NOT_DUE",
                "Task is not due or was already claimed",
                409,
            )
        return ok_response(claimed)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to claim task")
        error_response("TASK_CLAIM_FAILED", "Failed to claim task", 500)
    finally:
        db.close()


@router.post("/tasks/{task_id}/triggers")
async def create_trigger_endpoint(task_id: str, req: CreateTaskTriggerRequest):
    db = get_db()
    try:
        _require_standard_user(db, req.user_id)
        _require_task_for_user(db, task_id, req.user_id)
        if count_triggers(db, task_id) >= _MAX_TRIGGERS_PER_TASK:
            error_response(
                "TASK_TRIGGERS_LIMIT_REACHED",
                "Trigger limit reached for this task",
                400,
            )
        trigger = create_trigger(
            db, task_id, req.phrase.strip(), alert_kind=req.alert_kind
        )
        return ok_response(trigger, status_code=201)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to create task trigger")
        error_response(
            "TASK_TRIGGER_CREATE_FAILED", "Failed to create task trigger", 500
        )
    finally:
        db.close()


@router.patch("/tasks/triggers/{trigger_id}")
async def update_trigger_endpoint(
    trigger_id: str, req: UpdateTaskTriggerRequest
):
    db = get_db()
    try:
        trigger = get_trigger(db, trigger_id)
        if not trigger:
            error_response(
                "TASK_TRIGGER_NOT_FOUND", "Task trigger not found", 404
            )
        _require_task_for_user(db, trigger["task_id"], req.user_id)
        updated = update_trigger(
            db,
            trigger_id,
            phrase=req.phrase.strip() if req.phrase else None,
            alert_kind=req.alert_kind,
            is_active=req.is_active,
        )
        return ok_response(updated)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to update task trigger")
        error_response(
            "TASK_TRIGGER_UPDATE_FAILED", "Failed to update task trigger", 500
        )
    finally:
        db.close()


@router.delete("/tasks/triggers/{trigger_id}")
async def delete_trigger_endpoint(trigger_id: str, user_id: str = Query(...)):
    db = get_db()
    try:
        trigger = get_trigger(db, trigger_id)
        if not trigger:
            error_response(
                "TASK_TRIGGER_NOT_FOUND", "Task trigger not found", 404
            )
        _require_task_for_user(db, trigger["task_id"], user_id)
        deleted = delete_trigger(db, trigger_id)
        return ok_response({"deleted": deleted})
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to delete task trigger")
        error_response(
            "TASK_TRIGGER_DELETE_FAILED", "Failed to delete task trigger", 500
        )
    finally:
        db.close()


@router.get("/conversations/{conversation_id}/tasks/reports")
async def list_reports_endpoint(
    conversation_id: str,
    user_id: str = Query(...),
    limit: int = Query(100, ge=1, le=500),
):
    db = get_db()
    try:
        _require_conversation(db, conversation_id, user_id)
        return ok_response(list_reports(db, conversation_id, limit=limit))
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to list task reports")
        error_response(
            "TASK_REPORTS_LIST_FAILED", "Failed to list task reports", 500
        )
    finally:
        db.close()
