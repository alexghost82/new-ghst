"""Storage layer for the Object Tracking Engine.

Persists ``detection_events`` (one row per scan that found something) and
``detected_objects`` (one row per profiled subject inside the event). The
service layer drives dedup via ``recent_signatures()`` so a stationary
person/vehicle is profiled only once per camera within a short window.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.detection")


def _dump_json(value) -> str:
    if value is None:
        return "{}"
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return "{}"


def _dump_array_json(value) -> str:
    if value is None:
        return "[]"
    if isinstance(value, str):
        return value
    try:
        return json.dumps(list(value), ensure_ascii=False)
    except (TypeError, ValueError):
        return "[]"


def _parse_json(raw, default):
    if raw is None:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return default


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_event(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["scene_context"] = _parse_json(item.get("scene_context"), {})
    return item


def _row_to_object(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["carried_items"] = _parse_json(item.get("carried_items"), [])
    item["distinctive_identifiers"] = _parse_json(
        item.get("distinctive_identifiers"), []
    )
    item["vehicle_identifiers"] = _parse_json(
        item.get("vehicle_identifiers"), []
    )
    item["full_profile"] = _parse_json(item.get("full_profile"), {})
    return item


def insert_detection_event(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    camera_device_id: str | None,
    camera_label: str | None,
    timestamp_utc: str,
    captured_at: str | None,
    frame_path: str | None,
    scene_context: dict | None,
    object_count: int,
    quick_check_signature: str | None,
) -> dict:
    event_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO detection_events ("
        " id, conversation_id, camera_device_id, camera_label,"
        " timestamp_utc, captured_at, frame_path, scene_context,"
        " object_count, quick_check_signature, created_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            conversation_id,
            camera_device_id,
            camera_label,
            timestamp_utc,
            captured_at,
            frame_path,
            _dump_json(scene_context or {}),
            int(object_count),
            quick_check_signature,
            now,
        ),
    )
    db.commit()
    return {
        "id": event_id,
        "conversation_id": conversation_id,
        "camera_device_id": camera_device_id,
        "camera_label": camera_label,
        "timestamp_utc": timestamp_utc,
        "captured_at": captured_at,
        "frame_path": frame_path,
        "scene_context": scene_context or {},
        "object_count": int(object_count),
        "quick_check_signature": quick_check_signature,
        "created_at": now,
    }


def insert_detected_object(
    db: sqlite3.Connection,
    *,
    event_id: str,
    conversation_id: str,
    entity_id: str | None,
    tracking_id: str,
    signature: str,
    object_type: str,
    timestamp_utc: str,
    camera_device_id: str | None,
    camera_label: str | None,
    frame_path: str | None,
    deep_description: str,
    confidence: float,
    security_relevance_score: float | None = None,
    position_description: str | None = None,
    activity_description: str | None = None,
    gender_estimation: str | None = None,
    age_range: str | None = None,
    clothing_summary: str | None = None,
    carried_items: list | None = None,
    distinctive_identifiers: list | None = None,
    vehicle_type: str | None = None,
    manufacturer: str | None = None,
    model_name: str | None = None,
    color_primary: str | None = None,
    color_secondary: str | None = None,
    license_plate_partial: str | None = None,
    vehicle_identifiers: list | None = None,
    full_profile: dict | None = None,
) -> dict:
    obj_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO detected_objects ("
        " id, event_id, conversation_id, entity_id, tracking_id, signature,"
        " object_type, gender_estimation, age_range, clothing_summary,"
        " carried_items, distinctive_identifiers, vehicle_type, manufacturer,"
        " model_name, color_primary, color_secondary, license_plate_partial,"
        " vehicle_identifiers, position_description, activity_description,"
        " deep_description, confidence, security_relevance_score, full_profile,"
        " camera_device_id, camera_label, frame_path, timestamp_utc, created_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
        " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            obj_id,
            event_id,
            conversation_id,
            entity_id,
            tracking_id,
            signature,
            object_type,
            gender_estimation,
            age_range,
            clothing_summary,
            _dump_array_json(carried_items or []),
            _dump_array_json(distinctive_identifiers or []),
            vehicle_type,
            manufacturer,
            model_name,
            color_primary,
            color_secondary,
            license_plate_partial,
            _dump_array_json(vehicle_identifiers or []),
            position_description,
            activity_description,
            deep_description,
            float(confidence),
            (
                float(security_relevance_score)
                if security_relevance_score is not None
                else None
            ),
            _dump_json(full_profile or {}),
            camera_device_id,
            camera_label,
            frame_path,
            timestamp_utc,
            now,
        ),
    )
    db.commit()
    return {
        "id": obj_id,
        "event_id": event_id,
        "conversation_id": conversation_id,
        "entity_id": entity_id,
        "tracking_id": tracking_id,
        "signature": signature,
        "object_type": object_type,
        "gender_estimation": gender_estimation,
        "age_range": age_range,
        "clothing_summary": clothing_summary,
        "carried_items": carried_items or [],
        "distinctive_identifiers": distinctive_identifiers or [],
        "vehicle_type": vehicle_type,
        "manufacturer": manufacturer,
        "model_name": model_name,
        "color_primary": color_primary,
        "color_secondary": color_secondary,
        "license_plate_partial": license_plate_partial,
        "vehicle_identifiers": vehicle_identifiers or [],
        "position_description": position_description,
        "activity_description": activity_description,
        "deep_description": deep_description,
        "confidence": float(confidence),
        "security_relevance_score": security_relevance_score,
        "full_profile": full_profile or {},
        "camera_device_id": camera_device_id,
        "camera_label": camera_label,
        "frame_path": frame_path,
        "timestamp_utc": timestamp_utc,
        "created_at": now,
    }


def get_object(db: sqlite3.Connection, object_id: str) -> dict | None:
    """Fetch a single ``detected_objects`` row (parsed) by id."""

    row = db.execute(
        "SELECT * FROM detected_objects WHERE id = ?",
        (object_id,),
    ).fetchone()
    return _row_to_object(row) if row else None


def insert_fast_object(
    db: sqlite3.Connection,
    *,
    event_id: str,
    conversation_id: str,
    object_type: str,
    timestamp_utc: str,
    camera_device_id: str | None,
    camera_label: str | None,
    frame_path: str | None,
    confidence: float,
    tracking_id: str,
    dedupe_signature: str | None,
    fingerprint_json: str | None = None,
    deep_description: str = "",
) -> dict:
    """Create the immediate Fast Path card from a local YOLO detection.

    The row is minimal on purpose: it carries the thumbnail crop, basic
    type, camera, time, confidence and ``enrichment_status =
    'pending_enrichment'``. The Vision pass later fills the deep profile
    via :func:`update_object_enrichment` on the SAME ``id``.
    """

    obj_id = uuid4().hex
    now = _now_iso()
    # Until Vision returns a tracking_signature, the card reuses its local
    # dedupe signature so cross-flush region suppression still has a value.
    signature = dedupe_signature or f"{object_type}_{obj_id[:8]}"
    db.execute(
        "INSERT INTO detected_objects ("
        " id, event_id, conversation_id, entity_id, tracking_id, signature,"
        " object_type, carried_items, distinctive_identifiers,"
        " vehicle_identifiers, deep_description, confidence, full_profile,"
        " camera_device_id, camera_label, frame_path, timestamp_utc,"
        " created_at, source, enrichment_status, seen_count, last_seen_at,"
        " dedupe_signature, fingerprint_json"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
        " ?, ?, ?, ?, ?)",
        (
            obj_id,
            event_id,
            conversation_id,
            None,
            tracking_id,
            signature,
            object_type,
            "[]",
            "[]",
            "[]",
            deep_description or "",
            float(confidence),
            "{}",
            camera_device_id,
            camera_label,
            frame_path,
            timestamp_utc,
            now,
            "fast_yolo",
            "pending_enrichment",
            1,
            timestamp_utc,
            dedupe_signature,
            fingerprint_json,
        ),
    )
    db.commit()
    return get_object(db, obj_id) or {"id": obj_id}


def bump_seen_count(
    db: sqlite3.Connection,
    object_id: str,
    *,
    last_seen_at: str,
) -> dict | None:
    """Increment ``seen_count`` and refresh ``last_seen_at`` for a card the
    dedupe gate just matched again. Returns the updated row or ``None``."""

    cursor = db.execute(
        "UPDATE detected_objects "
        "   SET seen_count = COALESCE(seen_count, 1) + 1, last_seen_at = ? "
        " WHERE id = ?",
        (last_seen_at, object_id),
    )
    db.commit()
    if cursor.rowcount == 0:
        return None
    return get_object(db, object_id)


def count_pending_enrichment(
    db: sqlite3.Connection,
    conversation_id: str,
) -> int:
    """Number of cards still awaiting (or mid-) Vision enrichment."""

    row = db.execute(
        "SELECT COUNT(*) AS c FROM detected_objects "
        "WHERE conversation_id = ? "
        "  AND enrichment_status IN ('pending_enrichment', 'enriching')",
        (conversation_id,),
    ).fetchone()
    return int(row["c"]) if row else 0


def update_object_enrichment(
    db: sqlite3.Connection,
    object_id: str,
    *,
    enrichment_status: str = "enriched",
    signature: str | None = None,
    tracking_id: str | None = None,
    object_type: str | None = None,
    deep_description: str | None = None,
    confidence: float | None = None,
    position_description: str | None = None,
    activity_description: str | None = None,
    gender_estimation: str | None = None,
    age_range: str | None = None,
    clothing_summary: str | None = None,
    carried_items: list | None = None,
    distinctive_identifiers: list | None = None,
    vehicle_type: str | None = None,
    manufacturer: str | None = None,
    model_name: str | None = None,
    color_primary: str | None = None,
    color_secondary: str | None = None,
    license_plate_partial: str | None = None,
    vehicle_identifiers: list | None = None,
    full_profile: dict | None = None,
    batch_id: str | None = None,
    tile_index: int | None = None,
) -> dict | None:
    """Apply the Vision deep-profile onto an existing Fast Path card.

    Only non-``None`` fields are written, so the card's existing crop /
    camera / timestamp survive. Always sets ``enrichment_status`` and
    clears any prior retry error.
    """

    sets: list[str] = ["enrichment_status = ?", "last_error = NULL"]
    params: list = [enrichment_status]

    def _add(col: str, value) -> None:
        sets.append(f"{col} = ?")
        params.append(value)

    if signature is not None:
        _add("signature", signature)
    if tracking_id is not None:
        _add("tracking_id", tracking_id)
    if object_type is not None:
        _add("object_type", object_type)
    if deep_description is not None:
        _add("deep_description", deep_description)
    if confidence is not None:
        _add("confidence", float(confidence))
    if position_description is not None:
        _add("position_description", position_description)
    if activity_description is not None:
        _add("activity_description", activity_description)
    if gender_estimation is not None:
        _add("gender_estimation", gender_estimation)
    if age_range is not None:
        _add("age_range", age_range)
    if clothing_summary is not None:
        _add("clothing_summary", clothing_summary)
    if carried_items is not None:
        _add("carried_items", _dump_array_json(carried_items))
    if distinctive_identifiers is not None:
        _add("distinctive_identifiers", _dump_array_json(distinctive_identifiers))
    if vehicle_type is not None:
        _add("vehicle_type", vehicle_type)
    if manufacturer is not None:
        _add("manufacturer", manufacturer)
    if model_name is not None:
        _add("model_name", model_name)
    if color_primary is not None:
        _add("color_primary", color_primary)
    if color_secondary is not None:
        _add("color_secondary", color_secondary)
    if license_plate_partial is not None:
        _add("license_plate_partial", license_plate_partial)
    if vehicle_identifiers is not None:
        _add("vehicle_identifiers", _dump_array_json(vehicle_identifiers))
    if full_profile is not None:
        _add("full_profile", _dump_json(full_profile))
    if batch_id is not None:
        _add("batch_id", batch_id)
    if tile_index is not None:
        _add("tile_index", tile_index)

    params.append(object_id)
    cursor = db.execute(
        f"UPDATE detected_objects SET {', '.join(sets)} WHERE id = ?",
        tuple(params),
    )
    db.commit()
    if cursor.rowcount == 0:
        return None
    return get_object(db, object_id)


def mark_enrichment_failed(
    db: sqlite3.Connection,
    object_ids: list[str],
    *,
    error: str | None,
    next_retry_at: str | None,
) -> int:
    """Flag cards whose Vision enrichment failed. Keeps the card (and its
    crop thumbnail) visible, bumps ``retry_count`` and records the error so
    a later pass can retry instead of losing the detection."""

    if not object_ids:
        return 0
    placeholders = ",".join("?" * len(object_ids))
    cursor = db.execute(
        "UPDATE detected_objects "
        "   SET enrichment_status = 'enrichment_failed',"
        "       retry_count = COALESCE(retry_count, 0) + 1,"
        "       next_retry_at = ?, last_error = ? "
        f" WHERE id IN ({placeholders})",
        (next_retry_at, error, *object_ids),
    )
    db.commit()
    return cursor.rowcount or 0


def recent_signatures(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    camera_device_id: str | None,
    seconds: int = 30,
) -> set[str]:
    """Return signatures observed on the same camera within the dedup window.

    The detection service uses this to skip the (expensive) deep-profile call
    for subjects that are still standing where we already saw them. We do
    NOT scope by ``camera_device_id`` when it's None — a missing device id
    means the loop couldn't identify the camera; play it safe and dedup
    against the whole conversation.
    """

    cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=int(seconds))
    ).isoformat()

    if camera_device_id:
        rows = db.execute(
            "SELECT signature FROM detected_objects "
            "WHERE conversation_id = ? AND camera_device_id = ? "
            "  AND timestamp_utc >= ?",
            (conversation_id, camera_device_id, cutoff),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT signature FROM detected_objects "
            "WHERE conversation_id = ? AND timestamp_utc >= ?",
            (conversation_id, cutoff),
        ).fetchall()

    return {r["signature"] for r in rows if r["signature"]}


def find_recent_object_by_signature(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    camera_device_id: str | None,
    signature: str,
    seconds: int = 30,
) -> dict | None:
    """Return the newest matching object inside the dedup window — used to
    reuse its ``tracking_id`` when the same subject reappears later."""

    cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=int(seconds))
    ).isoformat()

    if camera_device_id:
        row = db.execute(
            "SELECT * FROM detected_objects "
            "WHERE conversation_id = ? AND camera_device_id = ? "
            "  AND signature = ? AND timestamp_utc >= ? "
            "ORDER BY timestamp_utc DESC LIMIT 1",
            (conversation_id, camera_device_id, signature, cutoff),
        ).fetchone()
    else:
        row = db.execute(
            "SELECT * FROM detected_objects "
            "WHERE conversation_id = ? AND signature = ? "
            "  AND timestamp_utc >= ? "
            "ORDER BY timestamp_utc DESC LIMIT 1",
            (conversation_id, signature, cutoff),
        ).fetchone()

    return _row_to_object(row) if row else None


def list_events(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int = 100,
) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, camera_device_id, camera_label,"
        " timestamp_utc, captured_at, frame_path, scene_context,"
        " object_count, quick_check_signature, created_at "
        "FROM detection_events WHERE conversation_id = ? "
        "ORDER BY timestamp_utc DESC LIMIT ?",
        (conversation_id, int(limit)),
    ).fetchall()
    return [_row_to_event(r) for r in rows]


def list_objects(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int = 200,
) -> list[dict]:
    rows = db.execute(
        "SELECT * FROM detected_objects WHERE conversation_id = ? "
        "ORDER BY timestamp_utc DESC LIMIT ?",
        (conversation_id, int(limit)),
    ).fetchall()
    return [_row_to_object(r) for r in rows]


def list_objects_since(
    db: sqlite3.Connection,
    conversation_id: str,
    since_iso: str,
    limit: int = 2000,
) -> list[dict]:
    """Return detected_objects observed at or after ``since_iso`` (UTC ISO),
    newest first. Used to build multi-day / period reports that must cover a
    whole window rather than just the latest handful of rows."""
    rows = db.execute(
        "SELECT * FROM detected_objects "
        "WHERE conversation_id = ? AND timestamp_utc >= ? "
        "ORDER BY timestamp_utc DESC LIMIT ?",
        (conversation_id, since_iso, int(limit)),
    ).fetchall()
    return [_row_to_object(r) for r in rows]


def list_objects_for_event(
    db: sqlite3.Connection, event_id: str
) -> list[dict]:
    rows = db.execute(
        "SELECT * FROM detected_objects WHERE event_id = ? "
        "ORDER BY timestamp_utc ASC",
        (event_id,),
    ).fetchall()
    return [_row_to_object(r) for r in rows]


def get_summary(db: sqlite3.Connection, conversation_id: str) -> dict:
    rows = db.execute(
        "SELECT object_type, COUNT(*) AS count "
        "FROM detected_objects WHERE conversation_id = ? "
        "GROUP BY object_type",
        (conversation_id,),
    ).fetchall()
    by_type = {row["object_type"]: int(row["count"]) for row in rows}

    ev_row = db.execute(
        "SELECT COUNT(*) AS count FROM detection_events WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchone()
    total_events = int(ev_row["count"]) if ev_row else 0

    return {
        "by_object_type": by_type,
        "total_objects": sum(by_type.values()),
        "total_events": total_events,
    }


def prune_detected_objects_to_limit(
    db: sqlite3.Connection,
    conversation_id: str,
    *,
    limit: int,
) -> list[str]:
    """Keep only the most recent ``limit`` detected_objects rows for the
    conversation. Returns the ``frame_path`` values of the deleted rows
    so the caller can unlink the underlying crop files.

    Implementation: pick out the IDs of all rows older than position
    ``limit`` (ordered by ``timestamp_utc DESC``) and delete them in one
    statement. Cheap on the index — ``detected_objects`` already has
    ``conversation_id`` and ``timestamp_utc`` available.
    """

    if limit <= 0:
        return []

    rows = db.execute(
        "SELECT id, frame_path FROM detected_objects "
        "WHERE conversation_id = ? "
        "ORDER BY timestamp_utc DESC LIMIT -1 OFFSET ?",
        (conversation_id, int(limit)),
    ).fetchall()

    if not rows:
        return []

    ids = [r["id"] for r in rows]
    paths = [r["frame_path"] for r in rows if r["frame_path"]]
    placeholders = ",".join("?" * len(ids))
    db.execute(
        f"DELETE FROM detected_objects WHERE id IN ({placeholders})",
        tuple(ids),
    )
    db.commit()
    return paths


def prune_detected_objects_older_than(
    db: sqlite3.Connection,
    conversation_id: str,
    *,
    cutoff_iso: str,
) -> list[str]:
    """Delete detected_objects rows older than ``cutoff_iso`` (UTC ISO) for the
    conversation. Returns the ``frame_path`` values of the deleted rows so the
    caller can unlink the underlying crop files.

    This is time-based retention: everything *within* the window is kept,
    regardless of count, so Ghost's tracking memory spans days/weeks instead
    of being capped to the latest handful of detections.
    """

    rows = db.execute(
        "SELECT id, frame_path FROM detected_objects "
        "WHERE conversation_id = ? AND timestamp_utc < ?",
        (conversation_id, cutoff_iso),
    ).fetchall()

    if not rows:
        return []

    ids = [r["id"] for r in rows]
    paths = [r["frame_path"] for r in rows if r["frame_path"]]
    placeholders = ",".join("?" * len(ids))
    db.execute(
        f"DELETE FROM detected_objects WHERE id IN ({placeholders})",
        tuple(ids),
    )
    db.commit()
    return paths


def set_tracking_enabled(
    db: sqlite3.Connection,
    conversation_id: str,
    enabled: bool,
) -> bool:
    cursor = db.execute(
        "UPDATE conversations SET tracking_enabled = ? WHERE id = ?",
        (1 if enabled else 0, conversation_id),
    )
    db.commit()
    return cursor.rowcount > 0


def get_tracking_enabled(
    db: sqlite3.Connection,
    conversation_id: str,
) -> bool:
    row = db.execute(
        "SELECT tracking_enabled FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    if not row:
        return False
    return bool(row["tracking_enabled"])
