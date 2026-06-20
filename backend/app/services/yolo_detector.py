"""Local YOLO detector — lazy singleton.

Loads ``ultralytics`` on first use only, so the FastAPI startup path
stays fast and a missing model file (or a missing ``ultralytics``
install) does not break the rest of the API.

The detector is intentionally minimal: it accepts a JPEG-encoded
``bytes`` blob (the same payload the frontend already POSTs) and
returns a list of ``YoloDetection`` dataclasses for the classes we
care about (person + common vehicles).

CPU inference is fine on Apple Silicon for the small ``yolov8n.pt``
model — Ultralytics defaults to MPS / CPU automatically.
"""

from __future__ import annotations

import asyncio
import io
import logging
import threading
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

logger = logging.getLogger("ghost.yolo")

# COCO class names we accept. The ultralytics model speaks the
# COCO label set, and these are the only classes useful for the
# tracking pipeline. Mapping into the existing ``detected_objects``
# ``object_type`` enum lives in ``MAPPED_OBJECT_TYPE`` below.
ACCEPTED_CLASSES: tuple[str, ...] = (
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "bus",
    "truck",
)

# Map COCO class name -> the existing ``detected_objects.object_type``
# enum used by MemoryPanel / chat_service / prompt_builder.
MAPPED_OBJECT_TYPE: dict[str, str] = {
    "person": "person",
    "bicycle": "bicycle",
    "car": "vehicle",
    "motorcycle": "motorcycle",
    "bus": "vehicle",
    "truck": "truck",
}


@dataclass(frozen=True)
class YoloDetection:
    """One detected box that survived the class + confidence filter."""

    object_type: str  # mapped enum (person/vehicle/truck/...)
    yolo_class: str  # raw COCO label (person/car/...)
    confidence: float
    # bbox in pixels, ``(x1, y1, x2, y2)`` — already clamped to the
    # original frame dimensions.
    bbox: tuple[int, int, int, int]
    # original image size at the time of inference.
    image_size: tuple[int, int]  # (width, height)

    @property
    def centroid(self) -> tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    @property
    def width(self) -> int:
        return max(0, self.bbox[2] - self.bbox[0])

    @property
    def height(self) -> int:
        return max(0, self.bbox[3] - self.bbox[1])


_lock = threading.Lock()
_model = None  # type: ignore[var-annotated]
_load_error: Exception | None = None


def _resolve_model_path() -> str:
    """Return the path/identifier passed to ``ultralytics.YOLO()``.

    If the configured ``yolo_model_name`` exists under
    ``yolo_models_dir`` we hand the absolute path to ultralytics so it
    doesn't try to download. Otherwise we hand the bare name and let
    ultralytics fetch it on first call (and place it in CWD).
    """

    name = settings.yolo_model_name or "yolov8n.pt"
    candidate = Path(settings.yolo_models_dir) / name
    if candidate.exists():
        return str(candidate)
    return name


def _load_model_blocking():
    """Synchronously import and instantiate the YOLO model.

    Runs under ``_lock`` to avoid double-loading if two requests race.
    """

    global _model, _load_error
    with _lock:
        if _model is not None:
            return _model
        if _load_error is not None:
            raise _load_error
        try:
            from ultralytics import YOLO  # type: ignore
        except Exception as err:  # ImportError or transitive failure
            _load_error = RuntimeError(
                "ultralytics is not installed or failed to import — install"
                " the ``ultralytics`` package to enable local tracking."
            )
            logger.exception("Failed to import ultralytics")
            raise _load_error from err

        model_id = _resolve_model_path()
        try:
            _model = YOLO(model_id)
            logger.info("YOLO model loaded: %s", model_id)
            return _model
        except Exception as err:
            _load_error = RuntimeError(
                f"Failed to load YOLO model '{model_id}': {err}"
            )
            logger.exception("Failed to load YOLO model %s", model_id)
            raise _load_error from err


async def ensure_model_loaded() -> None:
    """Awaitable wrapper that warms up the model in a worker thread."""

    await asyncio.to_thread(_load_model_blocking)


def _decode_image(image_bytes: bytes):
    """Decode JPEG/PNG bytes to a Pillow ``Image`` in RGB mode.

    Pillow is already a transitive dep of chromadb / ultralytics, but
    we declare it explicitly in ``requirements.txt``.
    """

    from PIL import Image  # type: ignore

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def _run_inference_blocking(
    image_bytes: bytes,
    *,
    confidence_threshold: float,
) -> list[YoloDetection]:
    model = _load_model_blocking()
    img = _decode_image(image_bytes)
    width, height = img.size

    try:
        results = model.predict(
            img,
            imgsz=settings.yolo_inference_imgsz,
            conf=confidence_threshold,
            verbose=False,
        )
    except Exception:
        logger.exception("YOLO inference raised")
        return []

    detections: list[YoloDetection] = []
    if not results:
        return detections

    result = results[0]
    boxes = getattr(result, "boxes", None)
    if boxes is None or boxes.cls is None:
        return detections

    names = getattr(result, "names", {}) or {}

    try:
        cls_array = boxes.cls.cpu().numpy().astype(int)
        conf_array = boxes.conf.cpu().numpy().astype(float)
        xyxy_array = boxes.xyxy.cpu().numpy().astype(float)
    except Exception:
        logger.exception("Failed to extract YOLO boxes")
        return detections

    for cls_idx, conf, xyxy in zip(cls_array, conf_array, xyxy_array):
        if conf < confidence_threshold:
            continue
        name = names.get(int(cls_idx)) if isinstance(names, dict) else None
        if name is None:
            continue
        if name not in ACCEPTED_CLASSES:
            continue
        x1, y1, x2, y2 = xyxy.tolist()
        bbox = _clamp_bbox(int(x1), int(y1), int(x2), int(y2), width, height)
        if bbox is None:
            continue
        detections.append(
            YoloDetection(
                object_type=MAPPED_OBJECT_TYPE.get(name, "object"),
                yolo_class=name,
                confidence=float(conf),
                bbox=bbox,
                image_size=(width, height),
            )
        )
    return detections


def _clamp_bbox(
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    width: int,
    height: int,
) -> tuple[int, int, int, int] | None:
    """Clamp a bbox to image bounds; drop boxes that collapse to 0."""

    x1c = max(0, min(width, x1))
    y1c = max(0, min(height, y1))
    x2c = max(0, min(width, x2))
    y2c = max(0, min(height, y2))
    if x2c <= x1c or y2c <= y1c:
        return None
    return (x1c, y1c, x2c, y2c)


def crop_with_padding(
    image_bytes: bytes,
    bbox: tuple[int, int, int, int],
    *,
    padding_px: int,
):
    """Decode image, expand bbox by ``padding_px`` (clamped to bounds),
    and return ``(crop_image, expanded_bbox)``.

    Returns ``(None, None)`` if the resulting box is empty.
    """

    img = _decode_image(image_bytes)
    width, height = img.size
    x1, y1, x2, y2 = bbox
    pad = max(0, int(padding_px))
    expanded = _clamp_bbox(
        x1 - pad,
        y1 - pad,
        x2 + pad,
        y2 + pad,
        width,
        height,
    )
    if expanded is None:
        return None, None
    crop = img.crop(expanded)
    return crop, expanded


async def detect_objects(
    image_bytes: bytes,
    *,
    confidence_threshold: float | None = None,
) -> list[YoloDetection]:
    """Run YOLO inference on a single frame and return filtered detections.

    Inference runs in a worker thread so the FastAPI event loop is not
    blocked by the (~50-200ms CPU) model call.
    """

    if not image_bytes:
        return []

    threshold = (
        float(confidence_threshold)
        if confidence_threshold is not None
        else settings.yolo_confidence_threshold
    )
    return await asyncio.to_thread(
        _run_inference_blocking,
        image_bytes,
        confidence_threshold=threshold,
    )


def reset_for_tests() -> None:
    """Forget the cached model + load error — used by unit tests that
    monkey-patch the loader."""

    global _model, _load_error
    with _lock:
        _model = None
        _load_error = None
