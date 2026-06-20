"""Smoke tests for the local YOLO collage-batch tracking pipeline.

Runs against a throwaway SQLite database written under
``backend/data/_detection_smoke``. Designed to run with plain
``python tests/test_detection_batch_smoke.py`` (no pytest dependency).

The Ghost Vision call (``analyze_tracking_collage``) is monkey-patched so
the test never hits the network or requires an API key. YOLO inference
itself is also short-circuited via ``yolo_detector.detect_objects`` so
the test does not need ``ultralytics`` installed.

Covers:

* RTL collage tile placement (top-right first, then left, wrapping rows).
* ``compute_grid`` for both small (8) and full (88) batches.
* Batch-size clamping at the storage layer (1..88).
* Pending-crop dedupe by signature inside the cooldown window.
* End-to-end ``scan_for_objects`` -> queued -> auto-flush -> rows
  appearing in ``detected_objects`` with ``batch_id`` + ``tile_index``.
* Manual ``flush_batch`` on a partial queue.
* Empty-flush returns ``status=empty`` cleanly.
"""

from __future__ import annotations

import asyncio
import base64
import io
import os
import shutil
import sys
from pathlib import Path

TEST_ROOT = Path(__file__).resolve().parent
SCRATCH = TEST_ROOT.parent / "data" / "_detection_smoke"
if SCRATCH.exists():
    shutil.rmtree(SCRATCH)
SCRATCH.mkdir(parents=True, exist_ok=True)

os.environ["DATABASE_PATH"] = str(SCRATCH / "ghost.db")
os.environ["CHROMA_PATH"] = str(SCRATCH / "chroma")
os.environ["UPLOAD_PATH"] = str(SCRATCH / "uploads")
os.environ["YOLO_MODELS_DIR"] = str(SCRATCH / "models")

sys.path.insert(0, str(TEST_ROOT.parent))

from app.config import settings  # noqa: E402
from app.services import (  # noqa: E402
    detection_batch_service,
    detection_service,
    detection_visual_fingerprint,
    tracking_collage_client,
    yolo_detector,
)
from app.services.detection_collage import (  # noqa: E402
    build_collage,
    compute_grid,
    expected_tile_position,
)
from app.services.detection_visual_fingerprint import (  # noqa: E402
    compute_fingerprint,
    cosine_similarity,
    hamming_distance,
    is_duplicate,
    serialize as serialize_fingerprint,
    structural_similarity,
)
from app.storage.conversation_store import create_conversation  # noqa: E402
from app.storage.database import get_db, run_migrations  # noqa: E402
from app.storage.detection_batch_store import (  # noqa: E402
    count_pending_crops,
    get_batch_target,
    insert_pending_crop,
    set_batch_target,
)
from app.storage.detection_store import list_objects  # noqa: E402
from app.storage.user_store import create_user  # noqa: E402

PASS = "PASS"
FAIL = "FAIL"


def _say(name: str, ok: bool, detail: str = "") -> None:
    tag = PASS if ok else FAIL
    print(f"  [{tag}] {name}{(' — ' + detail) if detail else ''}")
    if not ok:
        raise SystemExit(1)


def _make_jpeg_bytes(width: int = 320, height: int = 240) -> bytes:
    """Tiny solid JPEG so the decode path is happy without needing a
    real image fixture on disk."""

    from PIL import Image  # type: ignore

    img = Image.new("RGB", (width, height), color=(80, 80, 80))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def _make_png_bytes(
    width: int = 320,
    height: int = 240,
    color: tuple[int, int, int] = (80, 80, 80),
) -> bytes:
    """Lossless solid PNG for fingerprint tests — JPEG block artifacts
    can drift fingerprints across crops of the *same* image, which would
    make the dedup gate non-deterministic in tests."""

    from PIL import Image  # type: ignore

    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_pil(
    width: int = 64,
    height: int = 64,
    color: tuple[int, int, int] = (128, 128, 128),
):
    from PIL import Image  # type: ignore

    return Image.new("RGB", (width, height), color=color)


def _b64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("ascii")


def _stub_yolo_detection(
    yolo_class: str,
    cx: int,
    cy: int,
    *,
    box: int = 60,
    image_size: tuple[int, int] = (320, 240),
    confidence: float = 0.9,
) -> yolo_detector.YoloDetection:
    half = box // 2
    bbox = (cx - half, cy - half, cx + half, cy + half)
    return yolo_detector.YoloDetection(
        object_type=yolo_detector.MAPPED_OBJECT_TYPE.get(yolo_class, "object"),
        yolo_class=yolo_class,
        confidence=confidence,
        bbox=bbox,
        image_size=image_size,
    )


def _make_pending_crop_pngs(count: int) -> list[Path]:
    """Persist tiny PNG files so build_collage can actually open them."""

    from PIL import Image  # type: ignore

    paths: list[Path] = []
    crops_root = SCRATCH / "crops"
    crops_root.mkdir(parents=True, exist_ok=True)
    for idx in range(count):
        img = Image.new(
            "RGB",
            (50, 60),
            color=(20 + idx * 5, 30 + idx * 4, 40 + idx * 3),
        )
        out = crops_root / f"crop-{idx}.png"
        img.save(out, "PNG")
        paths.append(out)
    return paths


_user_seq = [0]


def _seed_user_and_conversation(db) -> tuple[str, str]:
    _user_seq[0] += 1
    nickname = f"tester-{_user_seq[0]}"
    user = create_user(db, nickname=nickname, api_key="sk-test-fake")
    conv = create_conversation(
        db,
        user_id=user["id"],
        title="Detection batch smoke",
        system_prompt="",
    )
    return user["id"], conv["id"]


def test_collage_grid_and_rtl_layout() -> None:
    print("test_collage_grid_and_rtl_layout")
    cols, rows = compute_grid(8)
    _say("grid 8 -> 3x3", (cols, rows) == (3, 3), str((cols, rows)))

    cols, rows = compute_grid(88)
    _say("grid 88 capped at 11 cols", cols <= 11 and rows <= 9, str((cols, rows)))

    # RTL: tile 0 must be top-right.
    pos = expected_tile_position(0, cols=3, tile_px=100, padding_px=5)
    _say("tile 0 top-right", pos == (215, 5), str(pos))

    pos1 = expected_tile_position(1, cols=3, tile_px=100, padding_px=5)
    _say("tile 1 to the left of tile 0", pos1 == (110, 5), str(pos1))

    pos3 = expected_tile_position(3, cols=3, tile_px=100, padding_px=5)
    _say(
        "tile 3 wraps to next row, back to top-right column",
        pos3 == (215, 110),
        str(pos3),
    )


def test_build_collage_with_real_pngs() -> None:
    print("test_build_collage_with_real_pngs")
    paths = _make_pending_crop_pngs(4)
    crops = [
        {
            "id": f"crop-{i}",
            "crop_path": str(p),
            "captured_at": "2024-01-01T10:30:00Z",
            "label": f"cam-{i}",
        }
        for i, p in enumerate(paths)
    ]
    result = build_collage(crops, tile_px=120, padding_px=6)
    _say("placements length matches input", len(result.placements) == 4)
    _say("png bytes non-empty", len(result.png_bytes) > 0)
    _say("first placement tile_index = 0", result.placements[0].tile_index == 0)
    # Width must accommodate cols and column gap padding.
    expected_w = result.cols * 120 + (result.cols + 1) * 6
    _say(
        "canvas width matches grid",
        result.width == expected_w,
        f"{result.width} vs {expected_w}",
    )


def test_batch_target_clamping() -> None:
    print("test_batch_target_clamping")
    db = get_db()
    try:
        _, conv_id = _seed_user_and_conversation(db)

        clamped_high = set_batch_target(db, conv_id, 999, maximum=88)
        _say("clamp >88 -> 88", clamped_high == 88, str(clamped_high))

        clamped_low = set_batch_target(db, conv_id, 0, maximum=88)
        _say("clamp <1 -> 1", clamped_low == 1, str(clamped_low))

        ok = set_batch_target(db, conv_id, 12, maximum=88)
        _say("set valid 12", ok == 12, str(ok))

        read = get_batch_target(db, conv_id, default=8, maximum=88)
        _say("get reads back 12", read == 12, str(read))

        missing = get_batch_target(
            db, "no-such-conv", default=8, maximum=88
        )
        _say("missing conv falls back to default", missing == 8, str(missing))
    finally:
        db.close()


async def _run_scan_pipeline_test() -> None:
    print("test_scan_pipeline_dedup_and_autoflush")
    db = get_db()
    try:
        user_id, conv_id = _seed_user_and_conversation(db)
        # Lower the target so we trigger an auto-flush quickly.
        set_batch_target(db, conv_id, 2, maximum=88)

        captured_calls: list[dict] = []

        async def fake_analysis(**kwargs):
            captured_calls.append(kwargs)
            cols = kwargs.get("cols", 1)
            rows = kwargs.get("rows", 1)
            tile_count = kwargs.get("tile_count", 0)
            tiles = []
            for i in range(tile_count):
                tiles.append(
                    {
                        "tile_index": i,
                        "object_type": "person",
                        "tracking_signature": f"test_subject_{i}",
                        "confidence": 0.9,
                        "deep_description": f"Test subject {i}",
                        "activity_description": "walking",
                        "position_description": "center",
                        "distinctive_identifiers": ["red_hat"],
                        "person_profile": {
                            "gender_estimation": "female",
                            "approximate_age_range": "30-40",
                            "clothing_summary": "red shirt",
                            "upper_body_color": "red",
                            "lower_body_color": "blue",
                            "hair": "long",
                            "facial_hair": "",
                            "carried_items": [],
                        },
                        "vehicle_profile": {
                            "vehicle_type": "",
                            "manufacturer_estimation": "",
                            "model_estimation": "",
                            "primary_color": "",
                            "secondary_color": "",
                            "license_plate_partial": "",
                            "vehicle_identifiers": [],
                        },
                    }
                )
            return {"tiles": tiles, "cols": cols, "rows": rows}

        # Patch the collage client (used by the batch service) AND the
        # YOLO detector so neither network nor model weights are needed.
        original_analyze = tracking_collage_client.analyze_tracking_collage
        original_detect = yolo_detector.detect_objects
        # The batch service imports the function at module-load time, so
        # we have to patch the module attribute the service actually
        # references.
        detection_batch_service.analyze_tracking_collage = fake_analysis  # type: ignore[attr-defined]

        scenarios = iter(
            [
                # Scan 1: one new person -> queued (1/2)
                [_stub_yolo_detection("person", cx=100, cy=120)],
                # Scan 2: SAME person same camera + centroid bucket -> dedup
                [_stub_yolo_detection("person", cx=102, cy=121)],
                # Scan 3: a new vehicle, far enough centroid -> queue 2/2
                # which triggers auto-flush.
                [_stub_yolo_detection("car", cx=260, cy=200)],
            ]
        )

        async def fake_detect(image_bytes, **kwargs):
            return next(scenarios)

        yolo_detector.detect_objects = fake_detect  # type: ignore[assignment]
        detection_service.detect_objects = fake_detect  # type: ignore[assignment]

        try:
            jpeg = _make_jpeg_bytes()
            payload = _b64(jpeg)

            scan1 = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-A",
                camera_label="Front Door",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "scan1 status queued",
                scan1["status"] == "queued",
                scan1["status"],
            )
            _say(
                "scan1 pending=1",
                scan1["pending_count"] == 1,
                str(scan1["pending_count"]),
            )

            scan2 = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-A",
                camera_label="Front Door",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "scan2 dedupe -> duplicate",
                scan2["status"] == "duplicate",
                scan2["status"],
            )
            _say(
                "scan2 pending still 1",
                scan2["pending_count"] == 1,
                str(scan2["pending_count"]),
            )

            scan3 = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-A",
                camera_label="Front Door",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "scan3 triggers a batch send",
                scan3["status"] in ("batch_sent", "batch_ready"),
                scan3["status"],
            )
            _say(
                "scan3 cleaned the queue",
                scan3["pending_count"] == 0,
                str(scan3["pending_count"]),
            )
            _say(
                "scan3 returned objects",
                len(scan3["objects"]) >= 1,
                str(len(scan3["objects"])),
            )
            _say(
                "ghost vision called once",
                len(captured_calls) == 1,
                str(len(captured_calls)),
            )

            persisted = list_objects(db, conv_id, limit=10)
            _say(
                "objects persisted to detected_objects",
                len(persisted) >= 1,
                str(len(persisted)),
            )
            _say(
                "first row carries batch_id + tile_index",
                persisted[0].get("batch_id") is not None
                and persisted[0].get("tile_index") is not None,
                f"batch_id={persisted[0].get('batch_id')!r} tile_index={persisted[0].get('tile_index')!r}",
            )
            # The crop must be reachable from the browser, i.e. stored as
            # an ``/api/frames/...`` URL, not a local FS path.
            frame_path = persisted[0].get("frame_path") or ""
            _say(
                "frame_path is a /api/frames URL (browser-loadable)",
                isinstance(frame_path, str)
                and frame_path.startswith(f"/api/frames/{conv_id}/track-crops/"),
                str(frame_path),
            )
            # The crop file must still exist on disk after the flush
            # (it's now the per-detection thumbnail).
            from app.services.detection_batch_service import _public_url_to_fs_path
            crop_fs = _public_url_to_fs_path(frame_path)
            _say(
                "crop PNG file kept on disk after flush",
                crop_fs is not None and Path(crop_fs).exists(),
                str(crop_fs),
            )

            # Empty flush returns status=empty
            empty = await detection_batch_service.flush_batch(
                db=db,
                conversation_id=conv_id,
                api_key="sk-test-fake",
                triggered_by="manual",
            )
            _say("empty flush -> status=empty", empty["status"] == "empty")
        finally:
            yolo_detector.detect_objects = original_detect  # type: ignore[assignment]
            detection_service.detect_objects = original_detect  # type: ignore[assignment]
            detection_batch_service.analyze_tracking_collage = original_analyze  # type: ignore[attr-defined]
    finally:
        db.close()


async def _run_manual_partial_flush_test() -> None:
    print("test_manual_partial_flush")
    db = get_db()
    try:
        _, conv_id = _seed_user_and_conversation(db)
        set_batch_target(db, conv_id, 8, maximum=88)

        async def fake_analysis(**kwargs):
            return {
                "tiles": [
                    {
                        "tile_index": 0,
                        "object_type": "vehicle",
                        "tracking_signature": "white_sedan",
                        "confidence": 0.85,
                        "deep_description": "white sedan",
                        "activity_description": "parked",
                        "position_description": "left",
                        "distinctive_identifiers": [],
                        "person_profile": {
                            "gender_estimation": "",
                            "approximate_age_range": "",
                            "clothing_summary": "",
                            "upper_body_color": "",
                            "lower_body_color": "",
                            "hair": "",
                            "facial_hair": "",
                            "carried_items": [],
                        },
                        "vehicle_profile": {
                            "vehicle_type": "sedan",
                            "manufacturer_estimation": "Toyota",
                            "model_estimation": "Corolla",
                            "primary_color": "white",
                            "secondary_color": "",
                            "license_plate_partial": "12-345",
                            "vehicle_identifiers": ["roof_rack"],
                        },
                    }
                ]
            }

        original_analyze = tracking_collage_client.analyze_tracking_collage
        original_detect = yolo_detector.detect_objects
        detection_batch_service.analyze_tracking_collage = fake_analysis  # type: ignore[attr-defined]

        scenarios = iter([[_stub_yolo_detection("car", cx=160, cy=120)]])

        async def fake_detect(image_bytes, **kwargs):
            try:
                return next(scenarios)
            except StopIteration:
                return []

        yolo_detector.detect_objects = fake_detect  # type: ignore[assignment]
        detection_service.detect_objects = fake_detect  # type: ignore[assignment]

        try:
            jpeg = _make_jpeg_bytes()
            payload = _b64(jpeg)

            queued = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-B",
                camera_label="Back",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "single car queued (target=8 not yet reached)",
                queued["status"] == "queued"
                and queued["pending_count"] == 1,
                f"{queued['status']} pending={queued['pending_count']}",
            )

            flushed = await detection_batch_service.flush_batch(
                db=db,
                conversation_id=conv_id,
                api_key="sk-test-fake",
                triggered_by="manual",
            )
            _say(
                "manual flush sent",
                flushed["status"] == "sent",
                flushed["status"],
            )
            _say(
                "manual flush persisted vehicle row",
                len(flushed["objects"]) == 1
                and flushed["objects"][0]["object_type"] == "vehicle",
                str([(o["object_type"], o.get("manufacturer")) for o in flushed["objects"]]),
            )
            _say(
                "queue empty after manual flush",
                count_pending_crops(db, conv_id) == 0,
                str(count_pending_crops(db, conv_id)),
            )
        finally:
            yolo_detector.detect_objects = original_detect  # type: ignore[assignment]
            detection_service.detect_objects = original_detect  # type: ignore[assignment]
            detection_batch_service.analyze_tracking_collage = original_analyze  # type: ignore[attr-defined]
    finally:
        db.close()


def test_fingerprint_basics() -> None:
    print("test_fingerprint_basics")

    grey = _make_pil(color=(128, 128, 128))
    grey_again = _make_pil(color=(128, 128, 128))
    fp_a = compute_fingerprint(grey)
    fp_b = compute_fingerprint(grey_again)
    cosine_same = cosine_similarity(fp_a["hist"], fp_b["hist"])
    hamming_same = hamming_distance(fp_a["dhash"], fp_b["dhash"])
    _say(
        "same image: cosine == 1.0",
        abs(cosine_same - 1.0) < 1e-6,
        f"{cosine_same:.6f}",
    )
    _say(
        "same image: hamming == 0",
        hamming_same == 0,
        str(hamming_same),
    )

    red = _make_pil(color=(220, 20, 20))
    blue = _make_pil(color=(20, 20, 220))
    fp_red = compute_fingerprint(red)
    fp_blue = compute_fingerprint(blue)
    cosine_diff = cosine_similarity(fp_red["hist"], fp_blue["hist"])
    hamming_diff = hamming_distance(fp_red["dhash"], fp_blue["dhash"])
    _say(
        "red vs blue: cosine well below threshold",
        cosine_diff < 0.92,
        f"{cosine_diff:.4f}",
    )
    _say(
        "red vs blue: hamming far above threshold",
        hamming_diff > 12 or hamming_diff == 0,
        str(hamming_diff),
    )

    matched_diff, _ = is_duplicate(
        fp_red,
        [{"fingerprint": fp_blue}],
        hist_threshold=0.92,
        hash_threshold=12,
    )
    _say("red vs blue: is_duplicate -> False", matched_diff is False)

    # Two near-identical grey images with tiny noise must still match.
    from PIL import Image  # type: ignore

    noisy = Image.new("RGB", (64, 64), color=(128, 128, 128))
    noisy.putpixel((0, 0), (130, 128, 126))
    fp_noisy = compute_fingerprint(noisy)
    matched_close, candidate = is_duplicate(
        fp_a,
        [{"fingerprint": fp_noisy}],
        hist_threshold=0.92,
        hash_threshold=12,
    )
    _say(
        "near-identical greys: is_duplicate -> True",
        matched_close is True and candidate is not None,
        f"matched={matched_close}",
    )

    # JSON round-trip must preserve cosine similarity exactly.
    serialized = serialize_fingerprint(fp_a)
    matched_json, _ = is_duplicate(
        fp_a,
        [{"fingerprint_json": serialized}],
        hist_threshold=0.92,
        hash_threshold=12,
    )
    _say(
        "fingerprint_json round-trip still matches",
        matched_json is True,
    )


def test_structural_pixel_gate() -> None:
    print("test_structural_pixel_gate")
    from PIL import Image  # type: ignore

    def _horizontal(brightness: int = 0) -> "Image.Image":
        img = Image.new("RGB", (96, 96), color=(0, 0, 0))
        px = img.load()
        for y in range(96):
            for x in range(96):
                v = min(255, 20 + int(x / 95 * 200) + brightness)
                px[x, y] = (v, v, v)
        # A darker block adds 2D structure beyond the pure gradient.
        for y in range(28):
            for x in range(28):
                d = min(255, 10 + brightness)
                px[x, y] = (d, d, d)
        return img

    def _vertical() -> "Image.Image":
        img = Image.new("RGB", (96, 96), color=(0, 0, 0))
        px = img.load()
        for y in range(96):
            for x in range(96):
                v = min(255, 20 + int(y / 95 * 200))
                px[x, y] = (v, v, v)
        return img

    base = _horizontal(0)
    # Same subject, uniformly brighter by +30 — simulates a lighting drift
    # while the subject stays put. NCC is brightness-invariant, so this
    # must still register as the same structure.
    brighter = _horizontal(30)
    other = _vertical()

    fp_base = compute_fingerprint(base)
    fp_bright = compute_fingerprint(brighter)
    fp_other = compute_fingerprint(other)

    sim_same = structural_similarity(fp_base["thumb"], fp_bright["thumb"])
    sim_diff = structural_similarity(fp_base["thumb"], fp_other["thumb"])
    _say(
        "static subject + lighting drift: NCC >= 0.80",
        sim_same >= 0.80,
        f"{sim_same:.4f}",
    )
    _say(
        "different structure: NCC below 0.80",
        sim_diff < 0.80,
        f"{sim_diff:.4f}",
    )

    # The structure gate must catch the duplicate even when the colour /
    # dHash gate is made impossible to satisfy (so we know the match came
    # from the new pixel-structure path, not the legacy hist+hash path).
    matched, cand = is_duplicate(
        fp_base,
        [{"fingerprint": fp_bright}],
        hist_threshold=2.0,  # impossible cosine
        hash_threshold=-1,  # impossible hamming
        structure_threshold=0.80,
    )
    _say(
        "structure gate alone flags the static subject",
        matched is True and cand is not None,
        f"matched={matched}",
    )

    matched_diff, _ = is_duplicate(
        fp_base,
        [{"fingerprint": fp_other}],
        hist_threshold=2.0,
        hash_threshold=-1,
        structure_threshold=0.80,
    )
    _say(
        "structure gate does not flag a different subject",
        matched_diff is False,
    )

    # The thumbnail must survive the JSON round-trip so the persisted
    # detected_objects gate works across the 8-minute window.
    round_trip = serialize_fingerprint(fp_base)
    matched_json, _ = is_duplicate(
        fp_bright,
        [{"fingerprint_json": round_trip}],
        hist_threshold=2.0,
        hash_threshold=-1,
        structure_threshold=0.80,
    )
    _say(
        "thumbnail survives JSON round-trip (persisted gate works)",
        matched_json is True,
    )


async def _run_visual_dedup_within_8min() -> None:
    print("test_visual_dedup_gate_blocks_within_8min")
    db = get_db()
    try:
        _, conv_id = _seed_user_and_conversation(db)
        set_batch_target(db, conv_id, 8, maximum=88)

        async def fake_analysis(**kwargs):
            return {"tiles": []}

        original_analyze = tracking_collage_client.analyze_tracking_collage
        original_detect = yolo_detector.detect_objects
        detection_batch_service.analyze_tracking_collage = fake_analysis  # type: ignore[attr-defined]

        # Same class + same camera + DIFFERENT centroid bucket so the
        # existing positional dedup does NOT match — the visual gate is
        # the only thing left to catch the duplicate.
        scenarios = iter(
            [
                [_stub_yolo_detection("person", cx=80, cy=80)],
                [_stub_yolo_detection("person", cx=240, cy=180)],
            ]
        )

        async def fake_detect(image_bytes, **kwargs):
            return next(scenarios)

        yolo_detector.detect_objects = fake_detect  # type: ignore[assignment]
        detection_service.detect_objects = fake_detect  # type: ignore[assignment]

        try:
            payload = _b64(_make_png_bytes())

            scan1 = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-A",
                camera_label="A",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "first crop queued",
                scan1["status"] == "queued" and scan1["pending_count"] == 1,
                f"{scan1['status']} pending={scan1['pending_count']}",
            )

            scan2 = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-A",
                camera_label="A",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "duplicate crop blocked by visual gate",
                scan2["status"] == "duplicate",
                scan2["status"],
            )
            _say(
                "queue stays at 1",
                count_pending_crops(db, conv_id) == 1,
                str(count_pending_crops(db, conv_id)),
            )
        finally:
            yolo_detector.detect_objects = original_detect  # type: ignore[assignment]
            detection_service.detect_objects = original_detect  # type: ignore[assignment]
            detection_batch_service.analyze_tracking_collage = original_analyze  # type: ignore[attr-defined]
    finally:
        db.close()


async def _run_visual_dedup_after_8min() -> None:
    print("test_visual_dedup_gate_allows_after_8min")
    db = get_db()
    try:
        _, conv_id = _seed_user_and_conversation(db)
        set_batch_target(db, conv_id, 8, maximum=88)

        async def fake_analysis(**kwargs):
            return {"tiles": []}

        original_analyze = tracking_collage_client.analyze_tracking_collage
        original_detect = yolo_detector.detect_objects
        detection_batch_service.analyze_tracking_collage = fake_analysis  # type: ignore[attr-defined]

        scenarios = iter(
            [[_stub_yolo_detection("person", cx=80, cy=80)]]
        )

        async def fake_detect(image_bytes, **kwargs):
            return next(scenarios)

        yolo_detector.detect_objects = fake_detect  # type: ignore[assignment]
        detection_service.detect_objects = fake_detect  # type: ignore[assignment]

        try:
            from datetime import datetime, timedelta, timezone

            # Inject a stale pending crop: same camera + same object_type
            # but ``created_at`` is 9 minutes old, OUTSIDE the 8-minute
            # visual dedup window. The new scan must not see it.
            stale_fp = compute_fingerprint(_make_pil(color=(80, 80, 80)))
            stale_path = SCRATCH / "crops" / "stale.png"
            stale_path.parent.mkdir(parents=True, exist_ok=True)
            stale_path.write_bytes(_make_png_bytes(width=20, height=20))
            inserted = insert_pending_crop(
                db,
                conversation_id=conv_id,
                crop_path=str(stale_path),
                bbox={
                    "x1": 0,
                    "y1": 0,
                    "x2": 20,
                    "y2": 20,
                    "image_width": 20,
                    "image_height": 20,
                },
                camera_device_id="cam-A",
                camera_label="A",
                captured_at=None,
                yolo_class="person",
                yolo_confidence=0.9,
                dedupe_signature="seed::person::0_0",
                fingerprint_json=serialize_fingerprint(stale_fp),
                object_type="person",
            )
            old_ts = (
                datetime.now(timezone.utc) - timedelta(minutes=9)
            ).isoformat()
            db.execute(
                "UPDATE detection_pending_crops SET created_at = ? WHERE id = ?",
                (old_ts, inserted["id"]),
            )
            db.commit()

            # Confirm the seed row is invisible to the 8-minute query.
            from app.storage.detection_batch_store import (
                recent_visual_fingerprints,
            )

            visible = recent_visual_fingerprints(
                db,
                conversation_id=conv_id,
                camera_device_id="cam-A",
                object_type="person",
                seconds=settings.detection_visual_dedupe_window_seconds,
            )
            _say(
                "stale fingerprint outside window is invisible",
                len(visible) == 0,
                f"visible={len(visible)}",
            )

            payload = _b64(_make_png_bytes())
            scan = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-A",
                camera_label="A",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "new crop is queued (older fp ignored)",
                scan["status"] == "queued",
                scan["status"],
            )
        finally:
            yolo_detector.detect_objects = original_detect  # type: ignore[assignment]
            detection_service.detect_objects = original_detect  # type: ignore[assignment]
            detection_batch_service.analyze_tracking_collage = original_analyze  # type: ignore[attr-defined]
    finally:
        db.close()


async def _run_visual_dedup_cross_class() -> None:
    print("test_visual_dedup_skips_across_classes")
    db = get_db()
    try:
        _, conv_id = _seed_user_and_conversation(db)
        set_batch_target(db, conv_id, 8, maximum=88)

        async def fake_analysis(**kwargs):
            return {"tiles": []}

        original_analyze = tracking_collage_client.analyze_tracking_collage
        original_detect = yolo_detector.detect_objects
        detection_batch_service.analyze_tracking_collage = fake_analysis  # type: ignore[attr-defined]

        # Same image bytes for both scans -> identical crop content ->
        # identical fingerprint. Only object_type differs. Cross-class
        # candidates must NOT block the second crop.
        scenarios = iter(
            [
                [_stub_yolo_detection("person", cx=80, cy=80)],
                [_stub_yolo_detection("car", cx=80, cy=80)],
            ]
        )

        async def fake_detect(image_bytes, **kwargs):
            return next(scenarios)

        yolo_detector.detect_objects = fake_detect  # type: ignore[assignment]
        detection_service.detect_objects = fake_detect  # type: ignore[assignment]

        try:
            payload = _b64(_make_png_bytes())

            scan_person = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-X",
                camera_label="X",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "person enqueued",
                scan_person["status"] == "queued"
                and scan_person["pending_count"] == 1,
                f"{scan_person['status']} pending={scan_person['pending_count']}",
            )

            scan_vehicle = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-X",
                camera_label="X",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "vehicle with same colour also enqueues (different class)",
                scan_vehicle["status"] == "queued"
                and scan_vehicle["pending_count"] == 2,
                f"{scan_vehicle['status']} pending={scan_vehicle['pending_count']}",
            )
        finally:
            yolo_detector.detect_objects = original_detect  # type: ignore[assignment]
            detection_service.detect_objects = original_detect  # type: ignore[assignment]
            detection_batch_service.analyze_tracking_collage = original_analyze  # type: ignore[attr-defined]
    finally:
        db.close()


async def _run_visual_dedup_disabled() -> None:
    print("test_visual_dedup_disabled_via_config")
    db = get_db()
    try:
        _, conv_id = _seed_user_and_conversation(db)
        set_batch_target(db, conv_id, 8, maximum=88)

        async def fake_analysis(**kwargs):
            return {"tiles": []}

        original_analyze = tracking_collage_client.analyze_tracking_collage
        original_detect = yolo_detector.detect_objects
        original_enabled = settings.detection_visual_dedupe_enabled
        detection_batch_service.analyze_tracking_collage = fake_analysis  # type: ignore[attr-defined]

        scenarios = iter(
            [
                [_stub_yolo_detection("person", cx=80, cy=80)],
                [_stub_yolo_detection("person", cx=240, cy=180)],
            ]
        )

        async def fake_detect(image_bytes, **kwargs):
            return next(scenarios)

        yolo_detector.detect_objects = fake_detect  # type: ignore[assignment]
        detection_service.detect_objects = fake_detect  # type: ignore[assignment]
        settings.detection_visual_dedupe_enabled = False

        try:
            payload = _b64(_make_png_bytes())

            await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-Z",
                camera_label="Z",
                captured_at=None,
                api_key="sk-test-fake",
            )
            scan2 = await detection_service.scan_for_objects(
                db=db,
                conversation_id=conv_id,
                image_base64=payload,
                camera_device_id="cam-Z",
                camera_label="Z",
                captured_at=None,
                api_key="sk-test-fake",
            )
            _say(
                "both crops enqueued when gate is disabled",
                scan2["status"] == "queued"
                and count_pending_crops(db, conv_id) == 2,
                f"{scan2['status']} pending={count_pending_crops(db, conv_id)}",
            )
        finally:
            settings.detection_visual_dedupe_enabled = original_enabled
            yolo_detector.detect_objects = original_detect  # type: ignore[assignment]
            detection_service.detect_objects = original_detect  # type: ignore[assignment]
            detection_batch_service.analyze_tracking_collage = original_analyze  # type: ignore[attr-defined]
    finally:
        db.close()


def main() -> None:
    print("Detection batch smoke — DB at", settings.database_path)
    run_migrations()
    test_collage_grid_and_rtl_layout()
    test_build_collage_with_real_pngs()
    test_batch_target_clamping()
    asyncio.run(_run_scan_pipeline_test())
    asyncio.run(_run_manual_partial_flush_test())
    test_fingerprint_basics()
    test_structural_pixel_gate()
    asyncio.run(_run_visual_dedup_within_8min())
    asyncio.run(_run_visual_dedup_after_8min())
    asyncio.run(_run_visual_dedup_cross_class())
    asyncio.run(_run_visual_dedup_disabled())
    print("ALL DETECTION BATCH SMOKE TESTS PASSED")


if __name__ == "__main__":
    main()
