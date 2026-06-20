"""Object Tracking Engine — local YOLO + collage batch pipeline.

Per-frame flow (replaces the old quick/deep external-vision flow):

1. Decode the JPEG frame the frontend uploaded.
2. Run local YOLO inference (CPU/MPS, lazy-loaded).
3. For each surviving detection (person + common vehicles), compute a
   ``camera + class + centroid bucket`` dedupe signature. Skip the crop
   if the same signature was queued or persisted within the cooldown
   window — this stops a stationary subject from filling the collage.
4. Crop with small padding, save the crop PNG, and enqueue a
   ``detection_pending_crops`` row.
5. When the queue reaches ``detection_batch_target`` (per-conversation,
   1..88) the batch is auto-flushed: collage built, sent to Ghost Vision,
   per-tile JSON persisted into ``detected_objects``.

The route always gets a structured payload back, including the new
``queued`` / ``batch_ready`` / ``batch_sent`` statuses the frontend uses
to render progress.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.config import settings
from app.services.detection_batch_service import flush_batch
from app.services.detection_visual_fingerprint import (
    compute_fingerprint,
    is_duplicate,
    serialize as serialize_fingerprint,
)
from app.services.yolo_detector import (
    YoloDetection,
    crop_with_padding,
    detect_objects,
)
from app.storage.alert_store import get_alert_mode
from app.storage.detection_batch_store import (
    count_pending_crops,
    find_recent_object_dedupe,
    find_recent_pending_crop_signature,
    get_batch_target,
    get_pending_crop_object_id,
    insert_pending_crop,
    list_recent_batches,
    recent_visual_fingerprints,
)
from app.storage.detection_store import (
    bump_seen_count,
    count_pending_enrichment,
    insert_detection_event,
    insert_fast_object,
)

logger = logging.getLogger("ghost.detection")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _crops_dir(conversation_id: str) -> Path:
    root = Path(settings.upload_path) / "frames" / conversation_id / "track-crops"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _decode_image_bytes(image_base64: str) -> bytes | None:
    if not image_base64:
        return None
    try:
        return base64.b64decode(image_base64, validate=False)
    except Exception:
        logger.exception("Failed to decode tracking frame")
        return None


def _dedupe_signature(
    *,
    camera_device_id: str | None,
    yolo_class: str,
    detection: YoloDetection,
    bucket_px: int,
) -> str:
    """``camera + class + centroid bucket`` — keeps a stationary subject
    from being enqueued repeatedly while still allowing genuine motion
    (different bucket) to refill the collage."""

    bucket = max(1, int(bucket_px))
    cx, cy = detection.centroid
    bx = int(cx // bucket)
    by = int(cy // bucket)
    cam = camera_device_id or "no_cam"
    return f"{cam}::{yolo_class}::{bx}_{by}"


async def _compute_crop_in_memory(
    *,
    image_bytes: bytes,
    detection: YoloDetection,
) -> tuple[object | None, dict | None]:
    """Crop the frame around the YOLO bbox **without** touching disk.

    Returns ``(PIL.Image, expanded_bbox_dict)``. The visual dedup gate
    runs against the returned image; only on a miss do we persist it.
    """

    crop, expanded = await asyncio.to_thread(
        crop_with_padding,
        image_bytes,
        detection.bbox,
        padding_px=settings.yolo_crop_padding_px,
    )
    if crop is None or expanded is None:
        return None, None

    bbox_dict = {
        "x1": int(expanded[0]),
        "y1": int(expanded[1]),
        "x2": int(expanded[2]),
        "y2": int(expanded[3]),
        "image_width": int(detection.image_size[0]),
        "image_height": int(detection.image_size[1]),
    }
    return crop, bbox_dict


async def _persist_crop_to_disk(
    *,
    crop_image,
    conversation_id: str,
) -> str | None:
    """Save the in-memory crop as PNG and return the absolute path."""

    if crop_image is None:
        return None
    crops_root = _crops_dir(conversation_id)
    filename = f"crop-{uuid4().hex}.png"
    out_path = crops_root / filename
    try:
        await asyncio.to_thread(crop_image.save, str(out_path), "PNG")
    except OSError:
        logger.exception("Failed to write crop %s", out_path)
        return None
    return str(out_path)


def _crop_public_url(crop_path: str | None, conversation_id: str) -> str | None:
    """Map an absolute crop FS path to the ``/api/frames`` URL the browser
    loads as the card thumbnail. Crops live under
    ``data/uploads/frames/{conv}/track-crops/...`` and that whole
    conversation directory is served by the static mount in :mod:`app.main`."""

    if not crop_path:
        return None
    marker = f"/frames/{conversation_id}/"
    try:
        text = str(Path(crop_path).resolve())
    except Exception:
        return None
    idx = text.find(marker)
    if idx == -1:
        return None
    relative = text[idx + len(marker):]
    return f"/api/frames/{conversation_id}/{relative}" if relative else None


def _object_id_from_candidate(
    db: sqlite3.Connection,
    candidate: dict | None,
) -> str | None:
    """Resolve the Fast Path card id behind a visual-fingerprint match.

    ``recent_visual_fingerprints`` rows are either a persisted object
    (``source='object'`` -> its own id) or a still-queued crop
    (``source='pending'`` -> the card it created, via ``object_id``)."""

    if not candidate:
        return None
    cid = candidate.get("id")
    if not cid:
        return None
    source = candidate.get("source")
    if source == "object":
        return str(cid)
    if source == "pending":
        return get_pending_crop_object_id(db, str(cid))
    return None


async def scan_for_objects(
    *,
    db: sqlite3.Connection,
    conversation_id: str,
    image_base64: str,
    camera_device_id: str | None,
    camera_label: str | None,
    captured_at: str | None,
    api_key: str,
) -> dict:
    """Run YOLO locally on the frame, enqueue novel crops, optionally
    create immediate Fast Path cards, and optionally flush the batch.

    Return shape (always present):
        {
          "status": "no_motion" | "no_objects" | "queued" | "duplicate"
                    | "fast_objects_created" | "batch_ready" | "batch_sent"
                    | "paused_for_alert" | "error",
          "queued": int,                    # crops enqueued by THIS scan
          "pending_count": int,             # current crop queue size
          "target_count": int,              # configured batch target
          "objects": list[dict],            # rows from an auto-flush (enrichment)
          "batch": dict | None,             # batch metadata if flushed
          "fast_objects_created": list[dict],   # immediate cards (Fast Path)
          "duplicates_suppressed": list[dict],  # bumped existing cards
          "pending_enrichment_count": int,      # cards awaiting Vision
          "message": str (only on error),
          "trace_id": str (debug only),
          "timings": dict (debug only),
        }

    The Fast Path (immediate card creation) is gated behind
    ``settings.tracking_fast_cards_enabled``. With the flag OFF the
    behaviour is byte-for-byte the legacy "card only after Vision" flow,
    so the feature is a clean rollback target.
    """

    trace_id = uuid4().hex
    timings: dict[str, str] = {"scan_started_at": _now_iso()}
    fast_cards_on = settings.tracking_fast_cards_enabled

    def _finalize(result: dict) -> dict:
        result.setdefault("fast_objects_created", [])
        result.setdefault("duplicates_suppressed", [])
        result.setdefault(
            "pending_enrichment_count",
            count_pending_enrichment(db, conversation_id) if fast_cards_on else 0,
        )
        if settings.detection_trace_timings_enabled:
            timings["response_sent_at"] = _now_iso()
            result["trace_id"] = trace_id
            result["timings"] = timings
        return result

    # Alerts are always top priority: when this conversation is in alert
    # mode, the heavy tracking pipeline (YOLO + gpt-5 collage) must not
    # compete with the latency-critical alert vision call on the same
    # OpenAI account. The frontend already pauses its detection loop while
    # alert mode is on; this is a server-side safeguard for any in-flight
    # or misbehaving client.
    if get_alert_mode(db, conversation_id):
        return _finalize({
            "status": "paused_for_alert",
            "queued": 0,
            "pending_count": count_pending_crops(db, conversation_id),
            "target_count": get_batch_target(
                db,
                conversation_id,
                default=settings.detection_batch_target_default,
                maximum=settings.detection_batch_target_max,
            ),
            "objects": [],
            "batch": None,
        })

    image_bytes = _decode_image_bytes(image_base64)
    if not image_bytes:
        return _finalize({
            "status": "no_motion",
            "queued": 0,
            "pending_count": count_pending_crops(db, conversation_id),
            "target_count": get_batch_target(
                db,
                conversation_id,
                default=settings.detection_batch_target_default,
                maximum=settings.detection_batch_target_max,
            ),
            "objects": [],
            "batch": None,
        })

    target_count = get_batch_target(
        db,
        conversation_id,
        default=settings.detection_batch_target_default,
        maximum=settings.detection_batch_target_max,
    )

    timings["yolo_started_at"] = _now_iso()
    try:
        detections = await detect_objects(image_bytes)
    except Exception:
        logger.exception(
            "Local YOLO inference failed for conversation %s camera %s",
            conversation_id,
            camera_label,
        )
        return _finalize({
            "status": "error",
            "queued": 0,
            "pending_count": count_pending_crops(db, conversation_id),
            "target_count": target_count,
            "objects": [],
            "batch": None,
            "message": "yolo_inference_failed",
        })
    timings["yolo_done_at"] = _now_iso()

    if not detections:
        return _finalize({
            "status": "no_objects",
            "queued": 0,
            "pending_count": count_pending_crops(db, conversation_id),
            "target_count": target_count,
            "objects": [],
            "batch": None,
        })

    cooldown = settings.detection_dedupe_cooldown_seconds
    bucket_px = settings.detection_dedupe_centroid_bucket_px
    timestamp = captured_at or _now_iso()

    # Lazily create ONE detection_event per scan to satisfy the
    # detected_objects.event_id FK when Fast Path cards are created. A scan
    # that finds nothing novel never creates an event.
    fast_event_id: str | None = None

    def _ensure_event() -> str:
        nonlocal fast_event_id
        if fast_event_id is None:
            event = insert_detection_event(
                db,
                conversation_id=conversation_id,
                camera_device_id=camera_device_id,
                camera_label=camera_label,
                timestamp_utc=timestamp,
                captured_at=captured_at,
                frame_path=None,
                scene_context={"source": "fast_path", "trace_id": trace_id},
                object_count=0,
                quick_check_signature=None,
            )
            fast_event_id = event["id"]
        return fast_event_id

    queued = 0
    duplicates = 0
    fast_objects_created: list[dict] = []
    duplicates_suppressed: list[dict] = []

    def _suppress(object_id: str | None, reason: str) -> None:
        """On a dedupe hit, bump the existing card's seen_count so the UI
        can surface "seen again now" instead of dropping the signal."""
        if not (fast_cards_on and object_id):
            return
        row = bump_seen_count(db, object_id, last_seen_at=timestamp)
        if row:
            duplicates_suppressed.append({
                "matched_object_id": object_id,
                "reason": reason,
                "seen_count": int(row.get("seen_count") or 1),
                "last_seen_at": row.get("last_seen_at"),
            })

    for det in detections:
        signature = _dedupe_signature(
            camera_device_id=camera_device_id,
            yolo_class=det.yolo_class,
            detection=det,
            bucket_px=bucket_px,
        )

        pending_match = find_recent_pending_crop_signature(
            db,
            conversation_id=conversation_id,
            dedupe_signature=signature,
            seconds=cooldown,
        )
        if pending_match:
            duplicates += 1
            _suppress(pending_match.get("object_id"), "region")
            continue

        object_match = find_recent_object_dedupe(
            db,
            conversation_id=conversation_id,
            dedupe_signature=signature,
            seconds=cooldown,
        )
        if object_match:
            duplicates += 1
            _suppress(object_match.get("id"), "region")
            continue

        crop_image, bbox = await _compute_crop_in_memory(
            image_bytes=image_bytes,
            detection=det,
        )
        if crop_image is None or not bbox:
            continue

        fingerprint = await asyncio.to_thread(compute_fingerprint, crop_image)

        if settings.detection_visual_dedupe_enabled:
            candidates = recent_visual_fingerprints(
                db,
                conversation_id=conversation_id,
                camera_device_id=camera_device_id,
                object_type=det.object_type,
                seconds=settings.detection_visual_dedupe_window_seconds,
            )
            matched, candidate = is_duplicate(
                fingerprint,
                candidates,
                hist_threshold=settings.detection_visual_dedupe_hist_threshold,
                hash_threshold=settings.detection_visual_dedupe_hash_threshold,
                structure_threshold=settings.detection_visual_dedupe_structure_threshold,
            )
            if matched:
                duplicates += 1
                _suppress(_object_id_from_candidate(db, candidate), "visual")
                continue

        crop_path = await _persist_crop_to_disk(
            crop_image=crop_image,
            conversation_id=conversation_id,
        )
        if not crop_path:
            continue

        # Fast Path: create the immediate card BEFORE enqueueing the crop,
        # so the enrichment pass can later update this exact row by id.
        fast_obj: dict | None = None
        if fast_cards_on:
            try:
                fast_obj = insert_fast_object(
                    db,
                    event_id=_ensure_event(),
                    conversation_id=conversation_id,
                    object_type=det.object_type,
                    timestamp_utc=timestamp,
                    camera_device_id=camera_device_id,
                    camera_label=camera_label,
                    frame_path=_crop_public_url(crop_path, conversation_id),
                    confidence=det.confidence,
                    tracking_id=uuid4().hex,
                    dedupe_signature=signature,
                    fingerprint_json=serialize_fingerprint(fingerprint),
                )
                timings.setdefault("object_persisted_at", _now_iso())
                fast_objects_created.append(fast_obj)
            except sqlite3.Error:
                logger.exception(
                    "Failed to create fast object for %s",
                    conversation_id,
                )
                fast_obj = None

        try:
            insert_pending_crop(
                db,
                conversation_id=conversation_id,
                crop_path=crop_path,
                bbox=bbox,
                camera_device_id=camera_device_id,
                camera_label=camera_label,
                captured_at=timestamp,
                yolo_class=det.yolo_class,
                yolo_confidence=det.confidence,
                dedupe_signature=signature,
                fingerprint_json=serialize_fingerprint(fingerprint),
                object_type=det.object_type,
                object_id=fast_obj.get("id") if fast_obj else None,
            )
            queued += 1
        except sqlite3.Error:
            logger.exception(
                "Failed to enqueue pending crop for %s",
                conversation_id,
            )
            try:
                Path(crop_path).unlink(missing_ok=True)
            except Exception:
                pass

    timings["dedupe_done_at"] = _now_iso()
    pending_count = count_pending_crops(db, conversation_id)

    # Enrichment Path: when the queue is full, flush a collage to Vision.
    # This is the slow background lane — it MUST NOT gate the Fast Path
    # cards already created above, which are returned regardless.
    flush_objects: list[dict] = []
    flush_batch_meta: dict | None = None
    flush_status: str | None = None
    flush_error: str | None = None
    if pending_count >= target_count:
        flush_result = await flush_batch(
            db=db,
            conversation_id=conversation_id,
            api_key=api_key,
            triggered_by="auto",
        )
        flush_objects = flush_result.get("objects") or []
        flush_batch_meta = flush_result.get("batch")
        flush_status = flush_result.get("status")
        flush_error = flush_result.get("error")
        timings.setdefault("object_persisted_at", _now_iso())
        pending_count = count_pending_crops(db, conversation_id)

    if fast_objects_created:
        status = "fast_objects_created"
    elif flush_status is not None:
        status = "batch_sent" if flush_status == "sent" else "batch_ready"
    elif queued > 0:
        status = "queued"
    elif duplicates > 0:
        status = "duplicate"
    else:
        status = "no_objects"

    return _finalize({
        "status": status,
        "queued": queued,
        "pending_count": pending_count,
        "target_count": target_count,
        "objects": flush_objects,
        "batch": flush_batch_meta,
        "fast_objects_created": fast_objects_created,
        "duplicates_suppressed": duplicates_suppressed,
        "message": flush_error,
    })


def get_batch_status(
    *,
    db: sqlite3.Connection,
    conversation_id: str,
) -> dict:
    """Return the batch progress payload used by ``MemoryPanel`` to
    render ``N / X`` collected and "send now" availability."""

    pending = count_pending_crops(db, conversation_id)
    target = get_batch_target(
        db,
        conversation_id,
        default=settings.detection_batch_target_default,
        maximum=settings.detection_batch_target_max,
    )
    recent = list_recent_batches(db, conversation_id, limit=3)
    return {
        "pending_count": pending,
        "target_count": target,
        "max_target": settings.detection_batch_target_max,
        "default_target": settings.detection_batch_target_default,
        "recent_batches": recent,
    }
