from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger("ghost.store.visual_memory")


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


def insert_observation(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    message_id: str,
    entity_type: str,
    description: str,
    observed_at: str,
    entity_id: str | None = None,
    camera_label: str | None = None,
    camera_device_id: str | None = None,
    visual_attributes: dict | None = None,
    position_in_frame: str | None = None,
    direction: str | None = None,
    activity: str | None = None,
    confidence: float = 0.7,
    semantic_tags: list | None = None,
    image_path: str | None = None,
) -> dict:
    obs_id = uuid4().hex
    attrs_json = _dump_json(visual_attributes or {})
    tags_json = _dump_json(semantic_tags or [])
    db.execute(
        "INSERT INTO visual_observations ("
        " id, conversation_id, message_id, entity_id, entity_type,"
        " camera_label, camera_device_id, description, visual_attributes,"
        " position_in_frame, direction, activity, confidence,"
        " semantic_tags, image_path, observed_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            obs_id,
            conversation_id,
            message_id,
            entity_id,
            entity_type,
            camera_label,
            camera_device_id,
            description,
            attrs_json,
            position_in_frame,
            direction,
            activity,
            float(confidence),
            tags_json,
            image_path,
            observed_at,
        ),
    )
    db.commit()
    return {
        "id": obs_id,
        "conversation_id": conversation_id,
        "message_id": message_id,
        "entity_id": entity_id,
        "entity_type": entity_type,
        "camera_label": camera_label,
        "camera_device_id": camera_device_id,
        "description": description,
        "visual_attributes": visual_attributes or {},
        "position_in_frame": position_in_frame,
        "direction": direction,
        "activity": activity,
        "confidence": float(confidence),
        "semantic_tags": semantic_tags or [],
        "image_path": image_path,
        "observed_at": observed_at,
    }


def _row_to_observation(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["visual_attributes"] = _parse_json(item.get("visual_attributes"), {})
    item["semantic_tags"] = _parse_json(item.get("semantic_tags"), [])
    return item


def _row_to_entity(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["visual_attributes"] = _parse_json(item.get("visual_attributes"), {})
    item["cameras_seen"] = _parse_json(item.get("cameras_seen"), [])
    return item


def list_recent_observations(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int = 40,
) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, message_id, entity_id, entity_type,"
        " camera_label, camera_device_id, description, visual_attributes,"
        " position_in_frame, direction, activity, confidence,"
        " semantic_tags, image_path, observed_at "
        "FROM visual_observations WHERE conversation_id = ? "
        "ORDER BY observed_at DESC LIMIT ?",
        (conversation_id, int(limit)),
    ).fetchall()
    return [_row_to_observation(r) for r in rows]


def list_observations_since(
    db: sqlite3.Connection,
    conversation_id: str,
    since_iso: str,
    limit: int = 2000,
) -> list[dict]:
    """Return observations recorded at or after ``since_iso`` (UTC ISO),
    newest first. Used to build multi-day / period reports that must cover a
    whole window rather than just the latest handful of rows."""
    rows = db.execute(
        "SELECT id, conversation_id, message_id, entity_id, entity_type,"
        " camera_label, camera_device_id, description, visual_attributes,"
        " position_in_frame, direction, activity, confidence,"
        " semantic_tags, image_path, observed_at "
        "FROM visual_observations WHERE conversation_id = ? "
        "AND observed_at >= ? "
        "ORDER BY observed_at DESC LIMIT ?",
        (conversation_id, since_iso, int(limit)),
    ).fetchall()
    return [_row_to_observation(r) for r in rows]


def list_observations_by_camera(
    db: sqlite3.Connection,
    conversation_id: str,
) -> dict[str, list[dict]]:
    rows = db.execute(
        "SELECT id, conversation_id, message_id, entity_id, entity_type,"
        " camera_label, camera_device_id, description, visual_attributes,"
        " position_in_frame, direction, activity, confidence,"
        " semantic_tags, image_path, observed_at "
        "FROM visual_observations WHERE conversation_id = ? "
        "ORDER BY observed_at DESC",
        (conversation_id,),
    ).fetchall()
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        obs = _row_to_observation(row)
        key = obs.get("camera_label") or "_unattributed"
        grouped.setdefault(key, []).append(obs)
    return grouped


def get_entity_by_signature(
    db: sqlite3.Connection,
    conversation_id: str,
    signature: str,
) -> dict | None:
    row = db.execute(
        "SELECT id, conversation_id, entity_type, signature, canonical_description,"
        " visual_attributes, cameras_seen, first_seen, last_seen, times_seen,"
        " last_match_confidence "
        "FROM visual_entities WHERE conversation_id = ? AND signature = ?",
        (conversation_id, signature),
    ).fetchone()
    return _row_to_entity(row) if row else None


def upsert_entity(
    db: sqlite3.Connection,
    *,
    conversation_id: str,
    signature: str,
    entity_type: str,
    canonical_description: str,
    visual_attributes: dict | None,
    camera_label: str | None,
    observed_at: str,
    match_confidence: float | None = None,
) -> dict:
    """Insert a new visual entity or update an existing one matched by signature.

    Updates merge ``cameras_seen``, bump ``times_seen`` + ``last_seen``, and
    upgrade ``canonical_description`` only when the new description is more
    detailed (longer) than the stored one.
    """

    existing = get_entity_by_signature(db, conversation_id, signature)
    attrs = visual_attributes or {}

    if existing:
        cameras = list(existing.get("cameras_seen") or [])
        if camera_label and camera_label not in cameras:
            cameras.append(camera_label)

        merged_attrs = dict(existing.get("visual_attributes") or {})
        for k, v in attrs.items():
            if v in (None, "", [], {}):
                continue
            if k not in merged_attrs or not merged_attrs[k]:
                merged_attrs[k] = v
            elif isinstance(merged_attrs[k], list) and isinstance(v, list):
                merged_attrs[k] = sorted({*merged_attrs[k], *v})

        new_desc = existing.get("canonical_description") or ""
        if canonical_description and len(canonical_description) > len(new_desc):
            new_desc = canonical_description

        db.execute(
            "UPDATE visual_entities SET"
            " last_seen = ?,"
            " times_seen = times_seen + 1,"
            " cameras_seen = ?,"
            " visual_attributes = ?,"
            " canonical_description = ?,"
            " last_match_confidence = ? "
            "WHERE id = ?",
            (
                observed_at,
                _dump_json(cameras),
                _dump_json(merged_attrs),
                new_desc,
                match_confidence,
                existing["id"],
            ),
        )
        db.commit()
        return {
            **existing,
            "last_seen": observed_at,
            "times_seen": int(existing.get("times_seen", 0)) + 1,
            "cameras_seen": cameras,
            "visual_attributes": merged_attrs,
            "canonical_description": new_desc,
            "last_match_confidence": match_confidence,
        }

    entity_id = uuid4().hex
    cameras = [camera_label] if camera_label else []
    db.execute(
        "INSERT INTO visual_entities ("
        " id, conversation_id, entity_type, signature, canonical_description,"
        " visual_attributes, cameras_seen, first_seen, last_seen, times_seen,"
        " last_match_confidence"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
        (
            entity_id,
            conversation_id,
            entity_type,
            signature,
            canonical_description,
            _dump_json(attrs),
            _dump_json(cameras),
            observed_at,
            observed_at,
            match_confidence,
        ),
    )
    db.commit()
    return {
        "id": entity_id,
        "conversation_id": conversation_id,
        "entity_type": entity_type,
        "signature": signature,
        "canonical_description": canonical_description,
        "visual_attributes": attrs,
        "cameras_seen": cameras,
        "first_seen": observed_at,
        "last_seen": observed_at,
        "times_seen": 1,
        "last_match_confidence": match_confidence,
    }


def list_entities(
    db: sqlite3.Connection,
    conversation_id: str,
    limit: int = 30,
) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, entity_type, signature, canonical_description,"
        " visual_attributes, cameras_seen, first_seen, last_seen, times_seen,"
        " last_match_confidence "
        "FROM visual_entities WHERE conversation_id = ? "
        "ORDER BY last_seen DESC LIMIT ?",
        (conversation_id, int(limit)),
    ).fetchall()
    return [_row_to_entity(r) for r in rows]


def get_summary(db: sqlite3.Connection, conversation_id: str) -> dict:
    rows = db.execute(
        "SELECT entity_type, COUNT(*) as count "
        "FROM visual_entities WHERE conversation_id = ? "
        "GROUP BY entity_type",
        (conversation_id,),
    ).fetchall()
    summary = {row["entity_type"]: int(row["count"]) for row in rows}

    obs_row = db.execute(
        "SELECT COUNT(*) as count FROM visual_observations WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchone()
    total_observations = int(obs_row["count"]) if obs_row else 0

    return {
        "by_entity_type": summary,
        "total_entities": sum(summary.values()),
        "total_observations": total_observations,
    }
