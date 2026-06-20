"""Detection batch flush service.

Bridges the local YOLO crop queue (``detection_pending_crops``) with the
Ghost Vision deep-analysis call. Owns:

- Building the RTL collage from pending crops via :mod:`detection_collage`.
- Persisting the collage PNG to disk under the upload tree.
- Sending the collage + tile metadata to Ghost Vision.
- Mapping per-tile JSON into ``detected_objects`` rows linked back to the
  collage via the new ``batch_id`` / ``tile_index`` columns.
- Cleaning up pending crops (and their crop files) once the batch is
  persisted, regardless of whether the analysis succeeded — leaving them
  pending forever after a failed flush would silently freeze the queue.

Never raises into the route layer. All paths return a structured dict the
route can hand straight back to the frontend.
"""

from __future__ import annotations

import asyncio
import logging
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from app.config import settings
from app.services.detection_collage import build_collage
from app.services.tracking_collage_client import analyze_tracking_collage
from app.storage.detection_batch_store import (
    create_batch,
    delete_pending_crops,
    insert_detected_object_with_batch,
    list_pending_crops,
    update_batch,
)
from app.storage.detection_store import (
    find_recent_object_by_signature,
    get_object,
    insert_detection_event,
    mark_enrichment_failed,
    prune_detected_objects_older_than,
    update_object_enrichment,
)

logger = logging.getLogger("ghost.detection.batch")

_TOKEN_NORMALIZE_RE = re.compile(r"[^\w]+", re.UNICODE)

# Per-conversation flush locks. Bounded so a long-lived process tracking many
# conversations cannot grow the table without limit — when over the cap we drop
# locks that are not currently held (a free lock is safe to recreate on demand).
_FLUSH_LOCKS: dict[str, asyncio.Lock] = {}
_FLUSH_LOCKS_MAX = 2048

# How long to back off before a failed Vision enrichment is eligible for a
# retry. Recorded on the card (``next_retry_at``) so the detection stays
# visible and is not lost — see migration 026.
_ENRICHMENT_RETRY_BACKOFF_MINUTES = 5


def _normalize_signature(value: str | None) -> str:
    if not value:
        return ""
    token = value.strip().lower()
    token = _TOKEN_NORMALIZE_RE.sub("_", token).strip("_")
    return token[:64]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _flush_lock(conversation_id: str) -> asyncio.Lock:
    lock = _FLUSH_LOCKS.get(conversation_id)
    if lock is None:
        if len(_FLUSH_LOCKS) >= _FLUSH_LOCKS_MAX:
            for cid, existing in list(_FLUSH_LOCKS.items()):
                if not existing.locked():
                    del _FLUSH_LOCKS[cid]
        lock = asyncio.Lock()
        _FLUSH_LOCKS[conversation_id] = lock
    return lock


def _collage_dir(conversation_id: str) -> Path:
    root = Path(settings.upload_path) / "frames" / conversation_id
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_unlink(path: str | None) -> None:
    if not path:
        return
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        logger.exception("Failed to unlink %s", path)


def _crop_path_to_public_url(crop_path: str | None, conversation_id: str) -> str | None:
    """Convert an absolute crop FS path to a URL the browser can load.

    Crops live under ``data/uploads/frames/{conv}/track-crops/...``. The
    ``/api/frames`` static mount in :mod:`app.main` serves the
    conversation directory (and any subdirectories) directly, so we just
    need to strip everything up to ``frames/{conv}/`` and prepend the
    mount path.
    """

    if not crop_path:
        return None

    try:
        path = Path(crop_path).resolve()
    except Exception:
        return None

    marker = f"/frames/{conversation_id}/"
    text = str(path)
    idx = text.find(marker)
    if idx == -1:
        return None
    relative = text[idx + len(f"/frames/{conversation_id}/"):]
    if not relative:
        return None
    return f"/api/frames/{conversation_id}/{relative}"


def _public_url_to_fs_path(url: str | None) -> str | None:
    """Inverse of :func:`_crop_path_to_public_url` — turn a stored
    ``frame_path`` URL back into the absolute file path on disk so it can
    be unlinked during retention pruning."""

    if not url or not url.startswith("/api/frames/"):
        return None
    relative = url[len("/api/frames/"):]
    if not relative:
        return None
    candidate = Path(settings.upload_path) / "frames" / relative
    return str(candidate)


def _person_fields(profile: dict | None) -> dict:
    profile = profile or {}

    def _opt(key: str) -> str | None:
        value = profile.get(key)
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    carried = profile.get("carried_items")
    if not isinstance(carried, list):
        carried = []

    return {
        "gender_estimation": _opt("gender_estimation"),
        "age_range": _opt("approximate_age_range"),
        "clothing_summary": _opt("clothing_summary"),
        "color_primary": _opt("upper_body_color"),
        "color_secondary": _opt("lower_body_color"),
        "carried_items": [str(item) for item in carried if item],
    }


def _vehicle_fields(profile: dict | None) -> dict:
    profile = profile or {}

    def _opt(key: str) -> str | None:
        value = profile.get(key)
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    identifiers = profile.get("vehicle_identifiers")
    if not isinstance(identifiers, list):
        identifiers = []

    return {
        "vehicle_type": _opt("vehicle_type"),
        "manufacturer": _opt("manufacturer_estimation"),
        "model_name": _opt("model_estimation"),
        "color_primary": _opt("primary_color"),
        "color_secondary": _opt("secondary_color"),
        "license_plate_partial": _opt("license_plate_partial"),
        "vehicle_identifiers": [str(item) for item in identifiers if item],
    }


def _persist_tile(
    db: sqlite3.Connection,
    *,
    tile: dict,
    placement: dict,
    batch_id: str,
    event_id: str,
    conversation_id: str,
    timestamp_utc: str,
) -> dict | None:
    """Persist one tile JSON into ``detected_objects``.

    When the originating crop is linked to a Fast Path card
    (``placement['object_id']``), the Vision profile UPDATES that exact
    card in place (``enrichment_status='enriched'``) instead of inserting
    a second row. Otherwise (legacy / flag off / card pruned) it inserts a
    fresh row exactly as before.

    Returns the persisted row dict or ``None`` if the tile was unusable.
    """

    if not isinstance(tile, dict):
        return None

    object_type = str(tile.get("object_type") or "").strip().lower()
    if not object_type:
        return None

    raw_signature = tile.get("tracking_signature") or ""
    signature = _normalize_signature(raw_signature)
    if not signature:
        signature = f"{object_type}_{uuid4().hex[:8]}"

    is_person = object_type == "person"
    is_vehicle = object_type in (
        "vehicle",
        "truck",
        "motorcycle",
        "bicycle",
    )

    person_fields = _person_fields(tile.get("person_profile")) if is_person else {}
    vehicle_fields = _vehicle_fields(tile.get("vehicle_profile")) if is_vehicle else {}

    distinctive = tile.get("distinctive_identifiers")
    if not isinstance(distinctive, list):
        distinctive = []
    distinctive = [str(item) for item in distinctive if item]

    deep_description = (
        tile.get("deep_description")
        or tile.get("activity_description")
        or ""
    )
    if not isinstance(deep_description, str):
        deep_description = str(deep_description)
    deep_description = deep_description.strip() or f"Detected {object_type}."

    try:
        confidence = float(tile.get("confidence") or 0.7)
    except (TypeError, ValueError):
        confidence = 0.7

    camera_device_id = placement.get("camera_device_id")
    camera_label = placement.get("camera_label")

    existing = find_recent_object_by_signature(
        db,
        conversation_id=conversation_id,
        camera_device_id=camera_device_id,
        signature=signature,
        seconds=settings.detection_dedupe_cooldown_seconds,
    )
    tracking_id = existing["tracking_id"] if existing else uuid4().hex

    crop_url = _crop_path_to_public_url(
        placement.get("crop_path"),
        conversation_id,
    )

    fingerprint_json = placement.get("fingerprint_json")
    dedupe_signature = placement.get("dedupe_signature")

    color_primary = (
        person_fields.get("color_primary")
        or vehicle_fields.get("color_primary")
    )
    color_secondary = (
        person_fields.get("color_secondary")
        or vehicle_fields.get("color_secondary")
    )
    position_description = (tile.get("position_description") or "") or None
    activity_description = (tile.get("activity_description") or "") or None
    tile_index = int(placement.get("tile_index") or 0)

    # Enrichment Path: if this crop created a Fast Path card, fill that same
    # row with the Vision profile instead of inserting a duplicate.
    object_id = placement.get("object_id")
    if object_id and settings.tracking_fast_cards_enabled and get_object(db, object_id):
        updated = update_object_enrichment(
            db,
            object_id,
            enrichment_status="enriched",
            signature=signature,
            tracking_id=tracking_id,
            object_type=object_type,
            deep_description=deep_description,
            confidence=confidence,
            position_description=position_description,
            activity_description=activity_description,
            gender_estimation=person_fields.get("gender_estimation"),
            age_range=person_fields.get("age_range"),
            clothing_summary=person_fields.get("clothing_summary"),
            carried_items=person_fields.get("carried_items", []),
            distinctive_identifiers=distinctive,
            vehicle_type=vehicle_fields.get("vehicle_type"),
            manufacturer=vehicle_fields.get("manufacturer"),
            model_name=vehicle_fields.get("model_name"),
            color_primary=color_primary,
            color_secondary=color_secondary,
            license_plate_partial=vehicle_fields.get("license_plate_partial"),
            vehicle_identifiers=vehicle_fields.get("vehicle_identifiers", []),
            full_profile=tile,
            batch_id=batch_id,
            tile_index=tile_index,
        )
        if updated:
            return updated
        # Card vanished (e.g. retention pruned it) — fall through to insert.

    return insert_detected_object_with_batch(
        db,
        event_id=event_id,
        conversation_id=conversation_id,
        tracking_id=tracking_id,
        signature=signature,
        object_type=object_type,
        timestamp_utc=timestamp_utc,
        camera_device_id=camera_device_id,
        camera_label=camera_label,
        frame_path=crop_url,
        deep_description=deep_description,
        confidence=confidence,
        position_description=position_description,
        activity_description=activity_description,
        gender_estimation=person_fields.get("gender_estimation"),
        age_range=person_fields.get("age_range"),
        clothing_summary=person_fields.get("clothing_summary"),
        carried_items=person_fields.get("carried_items", []),
        distinctive_identifiers=distinctive,
        vehicle_type=vehicle_fields.get("vehicle_type"),
        manufacturer=vehicle_fields.get("manufacturer"),
        model_name=vehicle_fields.get("model_name"),
        color_primary=color_primary,
        color_secondary=color_secondary,
        license_plate_partial=vehicle_fields.get("license_plate_partial"),
        vehicle_identifiers=vehicle_fields.get("vehicle_identifiers", []),
        full_profile=tile,
        batch_id=batch_id,
        tile_index=tile_index,
        fingerprint_json=fingerprint_json if isinstance(fingerprint_json, str) else None,
        dedupe_signature=dedupe_signature if isinstance(dedupe_signature, str) else None,
    )


async def flush_batch(
    *,
    db: sqlite3.Connection,
    conversation_id: str,
    api_key: str,
    triggered_by: str,
    locale: str = "he",
) -> dict:
    """Flush every pending crop in the queue as a single Ghost Vision call.

    Returns ``{status, batch, objects, error?}`` where ``status`` is one of:
      - ``"empty"`` — nothing pending, nothing flushed.
      - ``"sent"`` — collage built + analyzed; ``objects`` lists what we
        persisted into ``detected_objects``.
      - ``"failed"`` — collage built + sent but the analysis failed; the
        batch row is preserved with the error so the operator can see
        the cadence in admin tools, but pending crops ARE deleted to keep
        the queue moving.
    """

    lock = _flush_lock(conversation_id)
    async with lock:
        pending = list_pending_crops(
            db,
            conversation_id,
            limit=settings.detection_batch_target_max,
        )
        if not pending:
            return {"status": "empty", "batch": None, "objects": []}

        target = max(
            1,
            min(
                settings.detection_batch_target_max,
                len(pending),
            ),
        )

        collage = await asyncio.to_thread(
            build_collage,
            [
                {
                    "id": item["id"],
                    "crop_path": item["crop_path"],
                    "captured_at": item.get("captured_at"),
                    "label": item.get("camera_label"),
                }
                for item in pending
            ],
            tile_px=settings.detection_collage_tile_px,
            padding_px=settings.detection_collage_tile_padding_px,
        )

        collage_dir = _collage_dir(conversation_id)
        collage_filename = f"track-collage-{uuid4().hex}.png"
        collage_path = collage_dir / collage_filename
        try:
            collage_path.write_bytes(collage.png_bytes)
        except OSError:
            logger.exception("Failed to write collage %s", collage_path)
            return {
                "status": "failed",
                "batch": None,
                "objects": [],
                "error": "collage_write_failed",
            }

        camera_label = next(
            (
                item.get("camera_label")
                for item in pending
                if item.get("camera_label")
            ),
            None,
        )

        batch = create_batch(
            db,
            conversation_id=conversation_id,
            target_count=target,
            crop_count=len(pending),
            triggered_by=triggered_by,
            collage_path=str(collage_path),
            status="sending",
        )

        update_batch(
            db,
            batch["id"],
            sent_at=_now_iso(),
        )

        analysis = await analyze_tracking_collage(
            image_bytes=collage.png_bytes,
            api_key=api_key,
            tile_count=len(collage.placements),
            cols=collage.cols,
            rows=collage.rows,
            camera_label=camera_label,
            locale=locale,
        )

        timestamp_utc = _now_iso()
        event = insert_detection_event(
            db,
            conversation_id=conversation_id,
            camera_device_id=None,
            camera_label=camera_label,
            timestamp_utc=timestamp_utc,
            captured_at=None,
            frame_path=f"/api/frames/{conversation_id}/{collage_filename}",
            scene_context={"batch_id": batch["id"], "triggered_by": triggered_by},
            object_count=len(collage.placements),
            quick_check_signature=None,
        )

        # Map placement crop_path -> the original pending row so we can
        # propagate camera metadata and clean up the queue afterward.
        pending_by_path = {item["crop_path"]: item for item in pending}
        placements_by_index = {p.tile_index: p for p in collage.placements}

        saved_objects: list[dict] = []
        enriched_object_ids: set[str] = set()
        if isinstance(analysis, dict):
            tiles = analysis.get("tiles") or []
        else:
            tiles = []

        for tile in tiles:
            try:
                tile_index = int(tile.get("tile_index"))
            except (TypeError, ValueError):
                continue
            placement = placements_by_index.get(tile_index)
            if placement is None:
                continue
            pending_row = pending_by_path.get(placement.crop_path) or {}
            persist_payload = {
                "tile_index": placement.tile_index,
                "crop_path": placement.crop_path,
                "camera_device_id": pending_row.get("camera_device_id"),
                "camera_label": pending_row.get("camera_label"),
                "fingerprint_json": pending_row.get("fingerprint_json"),
                "dedupe_signature": pending_row.get("dedupe_signature"),
                "object_id": pending_row.get("object_id"),
            }
            try:
                row = _persist_tile(
                    db,
                    tile=tile,
                    placement=persist_payload,
                    batch_id=batch["id"],
                    event_id=event["id"],
                    conversation_id=conversation_id,
                    timestamp_utc=timestamp_utc,
                )
            except sqlite3.Error:
                logger.exception(
                    "Failed to persist tile %s for batch %s",
                    tile_index,
                    batch["id"],
                )
                continue
            if row:
                saved_objects.append(row)
                linked_id = persist_payload.get("object_id")
                if linked_id and row.get("id") == linked_id:
                    enriched_object_ids.add(linked_id)

        error_message = analysis.get("error") if isinstance(analysis, dict) else None
        final_status = "completed" if saved_objects else (
            "failed" if error_message else "empty_response"
        )
        update_batch(
            db,
            batch["id"],
            status=final_status,
            completed_at=_now_iso(),
            response={"tiles": tiles, "object_count": len(saved_objects)},
            error_message=error_message,
        )

        # Vision enrichment that did NOT land on a linked Fast Path card
        # (total failure, empty response, or fewer tiles than crops) must
        # not leave the card stuck on "pending_enrichment" forever. Flag
        # those cards ``enrichment_failed`` with a retry window — the card
        # AND its crop thumbnail stay; only the queue row is dropped below.
        failed_objects: list[dict] = []
        if settings.tracking_fast_cards_enabled:
            stuck_ids = [
                item.get("object_id")
                for item in pending
                if item.get("object_id")
                and item.get("object_id") not in enriched_object_ids
            ]
            if stuck_ids:
                next_retry_at = (
                    datetime.now(timezone.utc)
                    + timedelta(minutes=_ENRICHMENT_RETRY_BACKOFF_MINUTES)
                ).isoformat()
                mark_enrichment_failed(
                    db,
                    stuck_ids,
                    error=error_message or "vision_enrichment_incomplete",
                    next_retry_at=next_retry_at,
                )
                for oid in stuck_ids:
                    failed_row = get_object(db, oid)
                    if failed_row:
                        failed_objects.append(failed_row)

        # Drop the pending-queue rows but KEEP the crop PNGs on disk —
        # they're now the per-detection thumbnails rendered by the UI.
        crop_ids = [item["id"] for item in pending]
        delete_pending_crops(db, crop_ids)

        # Retention: time-based, not count-based. Keep every detected_objects
        # row observed within ``detection_retention_days`` (default 30) and
        # drop only rows older than that window, together with their crop
        # files. This is what gives Ghost a multi-day/week tracking memory it
        # can recall and report from — instead of capping to the latest 88.
        try:
            cutoff_iso = (
                datetime.now(timezone.utc)
                - timedelta(days=settings.detection_retention_days)
            ).isoformat()
            stale_paths = prune_detected_objects_older_than(
                db,
                conversation_id,
                cutoff_iso=cutoff_iso,
            )
            for url in stale_paths:
                fs_path = _public_url_to_fs_path(url)
                _safe_unlink(fs_path)
        except sqlite3.Error:
            logger.exception(
                "Detected-objects retention pruning failed for %s",
                conversation_id,
            )

        return {
            "status": "sent" if saved_objects else "failed",
            "batch": {
                **batch,
                "status": final_status,
                "completed_at": _now_iso(),
                "error_message": error_message,
            },
            # Enriched rows first, then any cards flagged failed this flush,
            # so the frontend upsert refreshes both badges in one response.
            "objects": saved_objects + failed_objects,
            "error": error_message,
        }
