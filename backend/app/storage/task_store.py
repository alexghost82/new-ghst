"""Storage layer for scheduled tasks (משימות), their trigger phrases and the
report records produced when a 'report' trigger matches Ghost's reply.

Follows the same conventions as :mod:`alert_store` — plain functions over a
caller-supplied ``sqlite3.Connection``, short transactions, dict rows.
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

logger = logging.getLogger("ghost.store.task")

_ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")

_TASK_COLUMNS = (
    "id, conversation_id, name, prompt_text, schedule_type, run_at, "
    "interval_seconds, daily_time, include_camera, is_active, last_run_at, "
    "next_run_at, created_at, updated_at"
)

_TRIGGER_COLUMNS = (
    "id, task_id, phrase, alert_kind, is_active, alert_rule_id, "
    "created_at, updated_at"
)

_REPORT_COLUMNS = (
    "id, task_id, trigger_id, conversation_id, message_id, task_name, "
    "prompt_text, matched_phrase, summary, reply_text, frame_path, "
    "camera_label, created_at"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_task(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["is_active"] = bool(data.get("is_active", 0))
    data["include_camera"] = bool(data.get("include_camera", 0))
    return data


def _row_to_trigger(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["is_active"] = bool(data.get("is_active", 0))
    return data


def normalize_utc_iso(value: str) -> str | None:
    """Parse a client-supplied ISO timestamp and re-serialise it as a UTC
    ISO string so lexicographic comparisons against ``_now_iso()`` are
    always valid. Returns ``None`` when unparseable."""
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    if parsed.tzinfo is None:
        # Naive timestamps are interpreted as Israel wall-clock time — the
        # operator console runs in Asia/Jerusalem.
        parsed = parsed.replace(tzinfo=_ISRAEL_TZ)
    return parsed.astimezone(timezone.utc).isoformat()


def compute_next_run(
    schedule_type: str,
    run_at: str | None,
    interval_seconds: int | None,
    daily_time: str | None,
    *,
    from_dt: datetime | None = None,
) -> str | None:
    """Compute the next UTC ISO run timestamp for a task, or ``None`` when
    the schedule cannot produce another run."""
    base = from_dt or datetime.now(timezone.utc)

    if schedule_type == "once":
        return normalize_utc_iso(run_at) if run_at else None

    if schedule_type == "interval":
        if not interval_seconds or interval_seconds <= 0:
            return None
        return (base + timedelta(seconds=interval_seconds)).isoformat()

    if schedule_type == "daily":
        if not daily_time:
            return None
        try:
            hour, minute = (int(p) for p in daily_time.split(":", 1))
        except (ValueError, AttributeError):
            return None
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return None
        local_now = base.astimezone(_ISRAEL_TZ)
        candidate = local_now.replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        if candidate <= local_now:
            candidate += timedelta(days=1)
        return candidate.astimezone(timezone.utc).isoformat()

    return None


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


def list_tasks(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    rows = db.execute(
        f"SELECT {_TASK_COLUMNS} FROM scheduled_tasks "
        "WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    return [_row_to_task(r) for r in rows]


def count_active_tasks(db: sqlite3.Connection, conversation_id: str) -> int:
    row = db.execute(
        "SELECT COUNT(*) AS n FROM scheduled_tasks "
        "WHERE conversation_id = ? AND is_active = 1",
        (conversation_id,),
    ).fetchone()
    return int(row["n"]) if row else 0


def get_task(db: sqlite3.Connection, task_id: str) -> dict | None:
    row = db.execute(
        f"SELECT {_TASK_COLUMNS} FROM scheduled_tasks WHERE id = ?",
        (task_id,),
    ).fetchone()
    return _row_to_task(row) if row else None


def create_task(
    db: sqlite3.Connection,
    conversation_id: str,
    name: str,
    prompt_text: str,
    schedule_type: str,
    run_at: str | None = None,
    interval_seconds: int | None = None,
    daily_time: str | None = None,
    include_camera: bool = True,
) -> dict:
    task_id = uuid4().hex
    now = _now_iso()
    normalized_run_at = normalize_utc_iso(run_at) if run_at else None
    next_run = compute_next_run(
        schedule_type, normalized_run_at, interval_seconds, daily_time
    )
    db.execute(
        "INSERT INTO scheduled_tasks "
        "(id, conversation_id, name, prompt_text, schedule_type, run_at, "
        " interval_seconds, daily_time, include_camera, is_active, "
        " last_run_at, next_run_at, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?)",
        (
            task_id,
            conversation_id,
            name,
            prompt_text,
            schedule_type,
            normalized_run_at,
            interval_seconds,
            daily_time,
            1 if include_camera else 0,
            next_run,
            now,
            now,
        ),
    )
    db.commit()
    logger.info(
        "Created scheduled task %s for conversation %s (type=%s next=%s)",
        task_id,
        conversation_id,
        schedule_type,
        next_run,
    )
    return get_task(db, task_id)  # type: ignore[return-value]


def update_task(
    db: sqlite3.Connection,
    task_id: str,
    *,
    name: str | None = None,
    prompt_text: str | None = None,
    schedule_type: str | None = None,
    run_at: str | None = None,
    interval_seconds: int | None = None,
    daily_time: str | None = None,
    include_camera: bool | None = None,
    is_active: bool | None = None,
) -> dict | None:
    existing = get_task(db, task_id)
    if not existing:
        return None

    updates: list[str] = []
    params: list = []
    schedule_changed = False

    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if prompt_text is not None:
        updates.append("prompt_text = ?")
        params.append(prompt_text)
    if schedule_type is not None:
        updates.append("schedule_type = ?")
        params.append(schedule_type)
        schedule_changed = True
    if run_at is not None:
        normalized = normalize_utc_iso(run_at)
        updates.append("run_at = ?")
        params.append(normalized)
        schedule_changed = True
    if interval_seconds is not None:
        updates.append("interval_seconds = ?")
        params.append(interval_seconds)
        schedule_changed = True
    if daily_time is not None:
        updates.append("daily_time = ?")
        params.append(daily_time)
        schedule_changed = True
    if include_camera is not None:
        updates.append("include_camera = ?")
        params.append(1 if include_camera else 0)
    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)
        # Re-arming a task must also revive its schedule.
        if is_active and not existing["is_active"]:
            schedule_changed = True

    if not updates:
        return existing

    now = _now_iso()
    updates.append("updated_at = ?")
    params.append(now)
    params.append(task_id)
    db.execute(
        f"UPDATE scheduled_tasks SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    db.commit()

    if schedule_changed:
        merged = get_task(db, task_id)
        if merged:
            next_run = compute_next_run(
                merged["schedule_type"],
                merged["run_at"],
                merged["interval_seconds"],
                merged["daily_time"],
            )
            # A 'once' task whose moment already passed and that has already
            # run stays exhausted; otherwise refresh the schedule.
            db.execute(
                "UPDATE scheduled_tasks SET next_run_at = ? WHERE id = ?",
                (next_run, task_id),
            )
            db.commit()

    return get_task(db, task_id)


def delete_task(db: sqlite3.Connection, task_id: str) -> bool:
    # Remove shadow alert rules backing this task's triggers first (the
    # trigger rows themselves cascade with the task).
    shadow_ids = [
        r["alert_rule_id"]
        for r in db.execute(
            "SELECT alert_rule_id FROM task_triggers "
            "WHERE task_id = ? AND alert_rule_id IS NOT NULL",
            (task_id,),
        ).fetchall()
    ]
    cursor = db.execute("DELETE FROM scheduled_tasks WHERE id = ?", (task_id,))
    for rule_id in shadow_ids:
        db.execute(
            "DELETE FROM alert_rules WHERE id = ? AND source = 'task'",
            (rule_id,),
        )
    db.commit()
    return cursor.rowcount > 0


def claim_task(db: sqlite3.Connection, task_id: str) -> dict | None:
    """Atomically claim a due task run.

    A single conditional UPDATE guarantees that out of any number of
    concurrent claimers (multiple tabs / devices) exactly one wins: the
    losers' UPDATE matches zero rows because ``next_run_at`` has already
    been pushed into the future (or NULLed for one-time tasks).

    Returns the updated task row when the claim succeeded, ``None`` when
    the task is not due / already claimed / inactive.
    """
    task = get_task(db, task_id)
    if not task or not task["is_active"] or not task["next_run_at"]:
        return None

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    if task["next_run_at"] > now_iso:
        return None

    if task["schedule_type"] == "once":
        cursor = db.execute(
            "UPDATE scheduled_tasks "
            "SET last_run_at = ?, next_run_at = NULL, is_active = 0, updated_at = ? "
            "WHERE id = ? AND is_active = 1 "
            "  AND next_run_at IS NOT NULL AND next_run_at <= ?",
            (now_iso, now_iso, task_id, now_iso),
        )
    else:
        next_run = compute_next_run(
            task["schedule_type"],
            task["run_at"],
            task["interval_seconds"],
            task["daily_time"],
            from_dt=now,
        )
        cursor = db.execute(
            "UPDATE scheduled_tasks "
            "SET last_run_at = ?, next_run_at = ?, updated_at = ? "
            "WHERE id = ? AND is_active = 1 "
            "  AND next_run_at IS NOT NULL AND next_run_at <= ?",
            (now_iso, next_run, now_iso, task_id, now_iso),
        )
    db.commit()
    if cursor.rowcount == 0:
        return None
    logger.info("Task %s claimed for run at %s", task_id, now_iso)
    return get_task(db, task_id)


# ---------------------------------------------------------------------------
# Triggers
# ---------------------------------------------------------------------------


def list_triggers(db: sqlite3.Connection, task_id: str) -> list[dict]:
    rows = db.execute(
        f"SELECT {_TRIGGER_COLUMNS} FROM task_triggers "
        "WHERE task_id = ? ORDER BY created_at ASC",
        (task_id,),
    ).fetchall()
    return [_row_to_trigger(r) for r in rows]


def list_active_triggers(db: sqlite3.Connection, task_id: str) -> list[dict]:
    rows = db.execute(
        f"SELECT {_TRIGGER_COLUMNS} FROM task_triggers "
        "WHERE task_id = ? AND is_active = 1 ORDER BY created_at ASC",
        (task_id,),
    ).fetchall()
    return [_row_to_trigger(r) for r in rows]


def count_triggers(db: sqlite3.Connection, task_id: str) -> int:
    row = db.execute(
        "SELECT COUNT(*) AS n FROM task_triggers WHERE task_id = ?",
        (task_id,),
    ).fetchone()
    return int(row["n"]) if row else 0


def get_trigger(db: sqlite3.Connection, trigger_id: str) -> dict | None:
    row = db.execute(
        f"SELECT {_TRIGGER_COLUMNS} FROM task_triggers WHERE id = ?",
        (trigger_id,),
    ).fetchone()
    return _row_to_trigger(row) if row else None


def create_trigger(
    db: sqlite3.Connection,
    task_id: str,
    phrase: str,
    alert_kind: str = "critical",
) -> dict:
    trigger_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO task_triggers "
        "(id, task_id, phrase, alert_kind, is_active, alert_rule_id, "
        " created_at, updated_at) "
        "VALUES (?, ?, ?, ?, 1, NULL, ?, ?)",
        (trigger_id, task_id, phrase, alert_kind, now, now),
    )
    db.commit()
    logger.info("Created task trigger %s for task %s", trigger_id, task_id)
    return get_trigger(db, trigger_id)  # type: ignore[return-value]


def update_trigger(
    db: sqlite3.Connection,
    trigger_id: str,
    *,
    phrase: str | None = None,
    alert_kind: str | None = None,
    is_active: bool | None = None,
) -> dict | None:
    updates: list[str] = []
    params: list = []
    if phrase is not None:
        updates.append("phrase = ?")
        params.append(phrase)
    if alert_kind is not None:
        updates.append("alert_kind = ?")
        params.append(alert_kind)
    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)
    if not updates:
        return get_trigger(db, trigger_id)

    updates.append("updated_at = ?")
    params.append(_now_iso())
    params.append(trigger_id)
    db.execute(
        f"UPDATE task_triggers SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    db.commit()
    return get_trigger(db, trigger_id)


def delete_trigger(db: sqlite3.Connection, trigger_id: str) -> bool:
    existing = get_trigger(db, trigger_id)
    cursor = db.execute(
        "DELETE FROM task_triggers WHERE id = ?", (trigger_id,)
    )
    if existing and existing.get("alert_rule_id"):
        # Drop the hidden shadow rule too (cascades its task alert events,
        # matching how deleting a regular alert rule behaves).
        db.execute(
            "DELETE FROM alert_rules WHERE id = ? AND source = 'task'",
            (existing["alert_rule_id"],),
        )
    db.commit()
    return cursor.rowcount > 0


def ensure_shadow_rule(
    db: sqlite3.Connection, trigger: dict, conversation_id: str
) -> str:
    """Get-or-create the hidden alert_rules row backing this trigger so that
    task alert events satisfy the ``alert_events.rule_id`` FK and ride the
    existing alert pipeline unchanged. Shadow rules are always inactive and
    tagged ``source='task'`` so the camera scan loop and the alerts panel
    never see them."""
    rule_id = trigger.get("alert_rule_id")
    if rule_id:
        row = db.execute(
            "SELECT id FROM alert_rules WHERE id = ?", (rule_id,)
        ).fetchone()
        if row:
            return rule_id

    new_rule_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO alert_rules "
        "(id, conversation_id, description, is_active, created_at, "
        " updated_at, source) "
        "VALUES (?, ?, ?, 0, ?, ?, 'task')",
        (new_rule_id, conversation_id, trigger["phrase"], now, now),
    )
    db.execute(
        "UPDATE task_triggers SET alert_rule_id = ?, updated_at = ? "
        "WHERE id = ?",
        (new_rule_id, now, trigger["id"]),
    )
    db.commit()
    return new_rule_id


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


def create_report(
    db: sqlite3.Connection,
    *,
    task_id: str,
    trigger_id: str | None,
    conversation_id: str,
    message_id: str | None,
    task_name: str,
    prompt_text: str,
    matched_phrase: str,
    summary: str,
    reply_text: str,
    frame_path: str | None = None,
    camera_label: str | None = None,
) -> dict:
    report_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO task_reports "
        "(id, task_id, trigger_id, conversation_id, message_id, task_name, "
        " prompt_text, matched_phrase, summary, reply_text, frame_path, "
        " camera_label, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            report_id,
            task_id,
            trigger_id,
            conversation_id,
            message_id,
            task_name,
            prompt_text,
            matched_phrase,
            summary,
            reply_text,
            frame_path,
            camera_label,
            now,
        ),
    )
    db.commit()
    logger.info(
        "Created task report %s (task=%s conversation=%s)",
        report_id,
        task_id,
        conversation_id,
    )
    return get_report(db, report_id)  # type: ignore[return-value]


def list_reports(
    db: sqlite3.Connection, conversation_id: str, limit: int = 100
) -> list[dict]:
    rows = db.execute(
        f"SELECT {_REPORT_COLUMNS} FROM task_reports "
        "WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
        (conversation_id, max(1, min(limit, 500))),
    ).fetchall()
    return [dict(r) for r in rows]


def get_report(db: sqlite3.Connection, report_id: str) -> dict | None:
    row = db.execute(
        f"SELECT {_REPORT_COLUMNS} FROM task_reports WHERE id = ?",
        (report_id,),
    ).fetchone()
    return dict(row) if row else None
