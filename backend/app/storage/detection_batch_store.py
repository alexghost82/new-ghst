"""Storage helpers for the local YOLO collage-batch pipeline.

Lives next to ``detection_store.py`` so the existing
``detected_objects`` / ``detection_events`` schema stays untouched in
that file. The new tables are defined in
``migrations/010_detection_batches.sql``.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.storage.detection_store import insert_detected_object

logger = logging.getLogger("ghost.store.detection_batch")


def _dump_json(value) -> str:
    if value is None:
        return "{}"
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return "{}"


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


def _row_to_pending_crop(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["bbox"] = _parse_json(item.get("bbox_json"), {})
    return item


def _row_to_batch(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["response"] = _parse_json(item.get("response_json"), {})
    return item


def get_batch_target(
    db: sqlite3.Connection,
    conversation_id: str,
    *,
    default: int,
    maximum: int,
) -> int:
    """Return the operator-configured batch target, clamped to bounds."""

    row = db.execute(
        "SELECT detection_batch_target FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    if not row:
        return max(1, min(maximum, int(default)))
    raw = (
        row["detection_batch_target"]
        if "detection_batch_target" in row.keys()
        else None
    )
    try:
        value = int(raw) if raw is not None else int(default)
    except (TypeError, ValueError):
        value = int(default)
    return max(1, min(maximum, value))


def set_batch_target(
    db: sqlite3.Connection,
    conversation_id: str,
    target: int,
    *,
    maximum: int,
) -> int:
    """Persist a clamped batch target. Raises on missing conversation."""

    clamped = max(1, min(int(maximum), int(target)))
    cursor = db.execute(
        "UPDATE conversations SET detection_batch_target = ? WHERE id = ?",
        (clamped, conversation_id),
    )
    if cursor.rowcount == 0:
        raise ValueError("conversation not found")
    db.commit()
    return clamped


def insert_pending_crop(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    crop_path: str,
    bbox: dict,
    camera_device_id: str | None,
    camera_label: str | None,
    captured_at: str | None,
    yolo_class: str,
    yolo_confidence: float,
    dedupe_signature: str,
    frame_path: str | None = None,
    fingerprint_json: str | None = None,
    object_type: str | None = None,
    object_id: str | None = None,
) -> dict:
    crop_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO detection_pending_crops ("
        " id, conversation_id, crop_path, bbox_json, camera_device_id,"
        " camera_label, captured_at, yolo_class, yolo_confidence,"
        " dedupe_signature, frame_path, fingerprint_json, object_type,"
        " object_id, created_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            crop_id,
            conversation_id,
            crop_path,
            _dump_json(bbox or {}),
            camera_device_id,
            camera_label,
            captured_at,
            yolo_class,
            float(yolo_confidence),
            dedupe_signature,
            frame_path,
            fingerprint_json,
            object_type,
            object_id,
            now,
        ),
    )
    db.commit()
    return {
        "id": crop_id,
        "conversation_id": conversation_id,
        "crop_path": crop_path,
        "bbox": bbox or {},
        "camera_device_id": camera_device_id,
        "camera_label": camera_label,
        "captured_at": captured_at,
        "yolo_class": yolo_class,
        "yolo_confidence": float(yolo_confidence),
        "dedupe_signature": dedupe_signature,
        "frame_path": frame_path,
        "fingerprint_json": fingerprint_json,
        "object_type": object_type,
        "object_id": object_id,
        "created_at": now,
    }


def get_pending_crop_object_id(
    db: sqlite3.Connection,
    crop_id: str,
) -> str | None:
    """Return the Fast Path card id linked to a pending crop, if any.

    Used by the dedupe path to bump ``seen_count`` on the right card when a
    visual-fingerprint match lands on a still-queued crop rather than a
    persisted object."""

    row = db.execute(
        "SELECT object_id FROM detection_pending_crops WHERE id = ?",
        (crop_id,),
    ).fetchone()
    if not row:
        return None
    keys = row.keys()
    return row["object_id"] if "object_id" in keys else None


def list_pending_crops(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int | None = None,
) -> list[dict]:
    sql = (
        "SELECT * FROM detection_pending_crops WHERE conversation_id = ? "
        "ORDER BY created_at ASC"
    )
    params: tuple = (conversation_id,)
    if limit is not None:
        sql += " LIMIT ?"
        params = (conversation_id, int(limit))
    rows = db.execute(sql, params).fetchall()
    return [_row_to_pending_crop(r) for r in rows]


def count_pending_crops(
    db: sqlite3.Connection,
    conversation_id: str,
) -> int:
    row = db.execute(
        "SELECT COUNT(*) AS count FROM detection_pending_crops "
        "WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchone()
    return int(row["count"]) if row else 0


def find_recent_pending_crop_signature(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    dedupe_signature: str,
    seconds: int,
) -> dict | None:
    cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=int(seconds))
    ).isoformat()
    row = db.execute(
        "SELECT * FROM detection_pending_crops "
        "WHERE conversation_id = ? AND dedupe_signature = ? "
        "  AND created_at >= ? "
        "ORDER BY created_at DESC LIMIT 1",
        (conversation_id, dedupe_signature, cutoff),
    ).fetchone()
    return _row_to_pending_crop(row) if row else None


def recent_visual_fingerprints(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    camera_device_id: str | None,
    object_type: str | None,
    seconds: int,
) -> list[dict]:
    """Return recent fingerprint payloads for the visual dedup gate.

    Pulls every row from ``detection_pending_crops`` and
    ``detected_objects`` for this conversation/camera/object_type whose
    ``created_at`` (pending) or ``timestamp_utc`` (object) lies inside
    the cooldown window. Each result has ``fingerprint_json`` (raw
    string) so callers can deserialize lazily.

    NULL ``object_type`` rows are excluded — they predate this gate and
    can't be safely compared against typed candidates.
    """

    if not object_type:
        return []
    cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=int(seconds))
    ).isoformat()

    if camera_device_id is None:
        camera_clause_pending = "camera_device_id IS NULL"
        camera_clause_object = "camera_device_id IS NULL"
        camera_params: tuple = ()
    else:
        camera_clause_pending = "camera_device_id = ?"
        camera_clause_object = "camera_device_id = ?"
        camera_params = (camera_device_id,)

    sql = (
        "SELECT 'pending' AS source, id, fingerprint_json, object_type,"
        "       camera_device_id, created_at AS ts"
        f"  FROM detection_pending_crops"
        f" WHERE conversation_id = ?"
        f"   AND {camera_clause_pending}"
        f"   AND object_type = ?"
        f"   AND fingerprint_json IS NOT NULL"
        f"   AND created_at >= ?"
        " UNION ALL "
        "SELECT 'object' AS source, id, fingerprint_json, object_type,"
        "       camera_device_id, timestamp_utc AS ts"
        f"  FROM detected_objects"
        f" WHERE conversation_id = ?"
        f"   AND {camera_clause_object}"
        f"   AND object_type = ?"
        f"   AND fingerprint_json IS NOT NULL"
        f"   AND timestamp_utc >= ?"
        " ORDER BY ts DESC"
    )
    params = (
        (conversation_id,)
        + camera_params
        + (object_type, cutoff)
        + (conversation_id,)
        + camera_params
        + (object_type, cutoff)
    )
    rows = db.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def find_recent_object_dedupe(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    dedupe_signature: str,
    seconds: int,
) -> dict | None:
    """Lookup the newest detected_objects row sharing the dedupe sig.

    Matches on the dedicated ``dedupe_signature`` column (the original
    YOLO ``camera::class::centroid`` signature), which survives a batch
    flush. The legacy ``signature`` column is overwritten with the Vision
    ``tracking_signature`` during persistence, so it could never match the
    local signature here — this is the "same region" arm of the dedupe.
    """

    cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=int(seconds))
    ).isoformat()
    row = db.execute(
        "SELECT * FROM detected_objects WHERE conversation_id = ? "
        "  AND dedupe_signature = ? AND timestamp_utc >= ? "
        "ORDER BY timestamp_utc DESC LIMIT 1",
        (conversation_id, dedupe_signature, cutoff),
    ).fetchone()
    if not row:
        return None
    item = dict(row)
    return item


def delete_pending_crops(
    db: sqlite3.Connection,
    crop_ids: list[str],
) -> int:
    if not crop_ids:
        return 0
    placeholders = ",".join("?" * len(crop_ids))
    cursor = db.execute(
        f"DELETE FROM detection_pending_crops WHERE id IN ({placeholders})",
        tuple(crop_ids),
    )
    db.commit()
    return cursor.rowcount or 0


def create_batch(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    target_count: int,
    crop_count: int,
    triggered_by: str,
    collage_path: str | None = None,
    status: str = "pending",
) -> dict:
    batch_id = uuid4().hex
    now = _now_iso()
    db.execute(
        "INSERT INTO detection_batches ("
        " id, conversation_id, collage_path, target_count, crop_count,"
        " triggered_by, status, created_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            batch_id,
            conversation_id,
            collage_path,
            int(target_count),
            int(crop_count),
            triggered_by,
            status,
            now,
        ),
    )
    db.commit()
    return {
        "id": batch_id,
        "conversation_id": conversation_id,
        "collage_path": collage_path,
        "target_count": int(target_count),
        "crop_count": int(crop_count),
        "triggered_by": triggered_by,
        "status": status,
        "sent_at": None,
        "completed_at": None,
        "response": {},
        "error_message": None,
        "created_at": now,
    }


def update_batch(
    db: sqlite3.Connection,
    batch_id: str,
    *,
    status: str | None = None,
    sent_at: str | None = None,
    completed_at: str | None = None,
    response: dict | None = None,
    error_message: str | None = None,
    collage_path: str | None = None,
    crop_count: int | None = None,
) -> dict | None:
    fields: list[str] = []
    params: list = []
    if status is not None:
        fields.append("status = ?")
        params.append(status)
    if sent_at is not None:
        fields.append("sent_at = ?")
        params.append(sent_at)
    if completed_at is not None:
        fields.append("completed_at = ?")
        params.append(completed_at)
    if response is not None:
        fields.append("response_json = ?")
        params.append(_dump_json(response))
    if error_message is not None:
        fields.append("error_message = ?")
        params.append(error_message)
    if collage_path is not None:
        fields.append("collage_path = ?")
        params.append(collage_path)
    if crop_count is not None:
        fields.append("crop_count = ?")
        params.append(int(crop_count))

    if not fields:
        return get_batch(db, batch_id)

    params.append(batch_id)
    db.execute(
        f"UPDATE detection_batches SET {', '.join(fields)} WHERE id = ?",
        tuple(params),
    )
    db.commit()
    return get_batch(db, batch_id)


def get_batch(db: sqlite3.Connection, batch_id: str) -> dict | None:
    row = db.execute(
        "SELECT * FROM detection_batches WHERE id = ?",
        (batch_id,),
    ).fetchone()
    return _row_to_batch(row) if row else None


def list_recent_batches(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int = 5,
) -> list[dict]:
    rows = db.execute(
        "SELECT * FROM detection_batches WHERE conversation_id = ? "
        "ORDER BY created_at DESC LIMIT ?",
        (conversation_id, int(limit)),
    ).fetchall()
    return [_row_to_batch(r) for r in rows]


def insert_detected_object_with_batch(
    db: sqlite3.Connection,
    *,
    event_id: str,
    conversation_id: str,
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
    batch_id: str | None = None,
    tile_index: int | None = None,
    fingerprint_json: str | None = None,
    dedupe_signature: str | None = None,
) -> dict:
    """Insert a detected_objects row + write batch metadata.

    Wrapper around the legacy ``insert_detected_object`` so the existing
    contract (and all current call sites) stay unchanged. Adds the
    nullable ``batch_id`` / ``tile_index`` columns introduced by
    migration 010, the ``fingerprint_json`` column introduced by
    migration 011 (visual dedup gate), and the ``dedupe_signature``
    column introduced by migration 014 (cross-flush "same region"
    suppression).
    """

    record = insert_detected_object(
        db,
        event_id=event_id,
        conversation_id=conversation_id,
        entity_id=None,
        tracking_id=tracking_id,
        signature=signature,
        object_type=object_type,
        timestamp_utc=timestamp_utc,
        camera_device_id=camera_device_id,
        camera_label=camera_label,
        frame_path=frame_path,
        deep_description=deep_description,
        confidence=confidence,
        security_relevance_score=security_relevance_score,
        position_description=position_description,
        activity_description=activity_description,
        gender_estimation=gender_estimation,
        age_range=age_range,
        clothing_summary=clothing_summary,
        carried_items=carried_items,
        distinctive_identifiers=distinctive_identifiers,
        vehicle_type=vehicle_type,
        manufacturer=manufacturer,
        model_name=model_name,
        color_primary=color_primary,
        color_secondary=color_secondary,
        license_plate_partial=license_plate_partial,
        vehicle_identifiers=vehicle_identifiers,
        full_profile=full_profile,
    )
    if (
        batch_id is not None
        or tile_index is not None
        or fingerprint_json is not None
        or dedupe_signature is not None
    ):
        db.execute(
            "UPDATE detected_objects "
            "   SET batch_id = ?, tile_index = ?, fingerprint_json = ?,"
            "       dedupe_signature = ? "
            " WHERE id = ?",
            (batch_id, tile_index, fingerprint_json, dedupe_signature, record["id"]),
        )
        db.commit()
        record["batch_id"] = batch_id
        record["tile_index"] = tile_index
        record["fingerprint_json"] = fingerprint_json
        record["dedupe_signature"] = dedupe_signature
    return record
