"""Local visual fingerprint for the tracking dedup gate.

Each YOLO crop receives a tiny fingerprint derived from the cropped image
itself, with **no API call**:

- ``hist`` — HSV color histogram normalised to a unit-L1 distribution
  with 24 bins per channel (72 floats total). Captures the dominant
  colour distribution of the subject (clothing/vehicle paint).
- ``dhash`` — 64-bit perceptual difference hash. Captures coarse
  structural layout (silhouette, light/dark transitions). Tolerates
  small position shifts but breaks on a different subject.
- ``thumb`` — a tiny normalised grayscale thumbnail (``STRUCT_SIDE`` x
  ``STRUCT_SIDE`` = 256 bytes) used for a direct **pixel-structure**
  comparison. Compared via zero-mean normalised cross-correlation
  (NCC), which is invariant to linear brightness/contrast shifts — so a
  subject that stays put while the lighting drifts still scores high.

A crop is flagged as the **same** subject when EITHER:

1. Pixel-structure NCC over ``thumb`` ``>= structure_threshold``
   (default 0.80). This is the primary gate: it catches a static
   subject (e.g. a person sitting still in front of the camera) even
   when small lighting/JPEG changes nudge the colour histogram around,
   which previously let the same person through repeatedly.
2. HSV histogram cosine ``>= hist_threshold`` (default 0.92) **AND**
   dHash Hamming distance ``<= hash_threshold`` (default 12 / 64 bits).
   The combined colour+layout condition stays as a secondary catch for
   subjects whose fine structure shifted but whose colour and coarse
   silhouette are clearly identical.

The structural NCC gate is what makes the local pre-send filter strong
enough to collapse a stationary subject down to a single queued crop
inside the dedup window.
"""

from __future__ import annotations

import json
import logging
from typing import Iterable

logger = logging.getLogger("ghost.detection.fingerprint")

# Public knobs for the math; the wire-up reads runtime values from
# ``settings.detection_visual_dedupe_*`` so production can tune without
# editing this module.
HIST_BINS_PER_CHANNEL = 24
HIST_TOTAL_BINS = HIST_BINS_PER_CHANNEL * 3
DHASH_SIDE = 8  # 8x8 difference -> 64 bits
RESIZE_FOR_HIST = 64  # square downscale before histogram
DHASH_RESIZE = (DHASH_SIDE + 1, DHASH_SIDE)  # 9x8 grayscale
# Side of the grayscale structural thumbnail. 16x16 = 256 samples keeps
# storage tiny while retaining enough spatial detail for an NCC compare
# that distinguishes "same static subject" from a genuinely new one.
STRUCT_SIDE = 16
STRUCT_LEN = STRUCT_SIDE * STRUCT_SIDE
# Below this standard deviation a thumbnail is treated as flat (e.g. a
# solid crop) — NCC is undefined on a constant signal, so we report no
# structural match rather than dividing by zero.
_STRUCT_MIN_STD = 1e-6


def _ensure_pil(image):

    if image.mode != "RGB":
        image = image.convert("RGB")
    return image


def _hsv_histogram(pil_image) -> list[float]:
    """Return a normalised HSV histogram (24+24+24 bins).

    Empty / black crops collapse to a uniform distribution so the cosine
    similarity stays well-defined.
    """

    import numpy as np  # type: ignore
    from PIL import Image  # type: ignore

    img = _ensure_pil(pil_image)
    img = img.resize((RESIZE_FOR_HIST, RESIZE_FOR_HIST), Image.BILINEAR)
    hsv = np.asarray(img.convert("HSV"), dtype=np.float32)
    h_channel = hsv[..., 0].ravel()
    s_channel = hsv[..., 1].ravel()
    v_channel = hsv[..., 2].ravel()

    hist = []
    for channel in (h_channel, s_channel, v_channel):
        # Pillow HSV channels are 0..255; bins are evenly spaced.
        counts, _ = np.histogram(
            channel,
            bins=HIST_BINS_PER_CHANNEL,
            range=(0, 256),
        )
        total = counts.sum()
        if total <= 0:
            normalised = np.full(HIST_BINS_PER_CHANNEL, 1.0 / HIST_BINS_PER_CHANNEL)
        else:
            normalised = counts.astype(np.float64) / float(total)
        hist.extend(float(v) for v in normalised)
    return hist


def _dhash(pil_image) -> int:
    """8x8 difference hash packed into a 64-bit integer.

    Resize to 9x8 grayscale, then for each row XOR-encode whether the
    next pixel is brighter than the current one.
    """

    import numpy as np  # type: ignore
    from PIL import Image  # type: ignore

    img = _ensure_pil(pil_image)
    gray = img.convert("L").resize(DHASH_RESIZE, Image.BILINEAR)
    arr = np.asarray(gray, dtype=np.int32)
    diffs = arr[:, 1:] > arr[:, :-1]
    bits = diffs.flatten().astype(np.uint8)
    value = 0
    for bit in bits:
        value = (value << 1) | int(bit)
    return value


def _structure_thumb(pil_image) -> list[int]:
    """Return a ``STRUCT_SIDE`` x ``STRUCT_SIDE`` grayscale thumbnail as a
    flat list of 0..255 ints. Used for the pixel-structure NCC compare."""

    import numpy as np  # type: ignore
    from PIL import Image  # type: ignore

    img = _ensure_pil(pil_image)
    gray = img.convert("L").resize((STRUCT_SIDE, STRUCT_SIDE), Image.BILINEAR)
    arr = np.asarray(gray, dtype=np.uint8).ravel()
    return [int(v) for v in arr]


def compute_fingerprint(pil_image) -> dict:
    """Compute the fingerprint for a single crop.

    Returns ``{"hist": list[float], "dhash": int, "thumb": list[int]}``.
    Never raises — a decode failure produces a uniform histogram, a zero
    hash and an empty thumbnail so the caller can still proceed (and the
    resulting fingerprint will only match other broken crops).
    """

    if pil_image is None:
        return {
            "hist": [1.0 / HIST_TOTAL_BINS] * HIST_TOTAL_BINS,
            "dhash": 0,
            "thumb": [],
        }
    try:
        return {
            "hist": _hsv_histogram(pil_image),
            "dhash": _dhash(pil_image),
            "thumb": _structure_thumb(pil_image),
        }
    except Exception:
        logger.exception("compute_fingerprint failed; returning fallback")
        return {
            "hist": [1.0 / HIST_TOTAL_BINS] * HIST_TOTAL_BINS,
            "dhash": 0,
            "thumb": [],
        }


def serialize(fingerprint: dict | None) -> str | None:
    """JSON-encode for storage in ``fingerprint_json``."""

    if fingerprint is None:
        return None
    try:
        return json.dumps(
            {
                "hist": list(fingerprint.get("hist") or []),
                "dhash": int(fingerprint.get("dhash") or 0),
                "thumb": [int(v) for v in (fingerprint.get("thumb") or [])],
            },
            ensure_ascii=False,
        )
    except (TypeError, ValueError):
        logger.exception("serialize fingerprint failed")
        return None


def deserialize(text: str | None) -> dict | None:
    """Decode a stored fingerprint. Returns ``None`` for unusable
    payloads so the caller can skip them safely."""

    if not text:
        return None
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(parsed, dict):
        return None
    hist = parsed.get("hist")
    dhash = parsed.get("dhash")
    if not isinstance(hist, list) or len(hist) != HIST_TOTAL_BINS:
        return None
    try:
        hist_floats = [float(v) for v in hist]
    except (TypeError, ValueError):
        return None
    try:
        dhash_int = int(dhash) if dhash is not None else 0
    except (TypeError, ValueError):
        return None
    # ``thumb`` is optional — fingerprints written before the structural
    # gate existed simply won't carry one, and fall back to hist+hash.
    thumb_raw = parsed.get("thumb")
    thumb: list[int] = []
    if isinstance(thumb_raw, list) and len(thumb_raw) == STRUCT_LEN:
        try:
            thumb = [int(v) for v in thumb_raw]
        except (TypeError, ValueError):
            thumb = []
    return {"hist": hist_floats, "dhash": dhash_int, "thumb": thumb}


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity over two equal-length float vectors. Returns
    ``0.0`` for degenerate inputs."""

    import numpy as np  # type: ignore

    if not a or not b or len(a) != len(b):
        return 0.0
    va = np.asarray(a, dtype=np.float64)
    vb = np.asarray(b, dtype=np.float64)
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def structural_similarity(a: Iterable[int], b: Iterable[int]) -> float:
    """Zero-mean normalised cross-correlation between two grayscale
    thumbnails, mapped to ``[0.0, 1.0]``.

    Returns ``1.0`` for an identical pixel structure and degrades toward
    ``0.0`` as the layout diverges. By subtracting the per-thumbnail mean
    and dividing by the norm, the score is invariant to uniform
    brightness/contrast shifts — a person who stays still under slowly
    changing light still scores near ``1.0``.

    Degenerate inputs (mismatched length, empty, or a flat/constant
    thumbnail with no structure to correlate) return ``0.0`` so they
    never trip the duplicate gate by accident.
    """

    import numpy as np  # type: ignore

    va_list = list(a) if a is not None else []
    vb_list = list(b) if b is not None else []
    if not va_list or not vb_list or len(va_list) != len(vb_list):
        return 0.0

    va = np.asarray(va_list, dtype=np.float64)
    vb = np.asarray(vb_list, dtype=np.float64)
    va = va - va.mean()
    vb = vb - vb.mean()
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na <= _STRUCT_MIN_STD or nb <= _STRUCT_MIN_STD:
        return 0.0
    ncc = float(np.dot(va, vb) / (na * nb))
    if ncc < 0.0:
        return 0.0
    if ncc > 1.0:
        return 1.0
    return ncc


def hamming_distance(a: int, b: int, *, bits: int = 64) -> int:
    """Hamming distance between two integers (number of differing bits).

    Uses ``int.bit_count`` which is O(1) for fixed-size hashes on Python
    3.10+; falls back to ``bin(...).count('1')`` for older runtimes
    (Python 3.9 ships in this project's venv).
    """

    diff = (int(a) ^ int(b)) & ((1 << bits) - 1)
    try:
        return int(diff.bit_count())  # type: ignore[attr-defined]
    except AttributeError:
        return bin(diff).count("1")


def is_duplicate(
    new_fp: dict | None,
    candidates: Iterable[dict | None],
    *,
    hist_threshold: float,
    hash_threshold: int,
    structure_threshold: float = 0.80,
) -> tuple[bool, dict | None]:
    """Check whether ``new_fp`` matches any candidate. ``candidates`` may
    be raw stored dicts (they will be deserialised on the fly when they
    look like JSON-encoded text via a ``"fingerprint_json"`` field).

    A candidate matches when EITHER:

    - the pixel-structure NCC over ``thumb`` is
      ``>= structure_threshold`` (the primary gate — catches a static
      subject across small lighting changes), OR
    - the HSV histogram cosine is ``>= hist_threshold`` AND the dHash
      Hamming distance is ``<= hash_threshold`` (the colour+layout
      fallback).

    Returns ``(matched, best_candidate)``. ``best_candidate`` is the
    original candidate dict (unmodified) so callers can log which row
    triggered the match.
    """

    if new_fp is None:
        return False, None

    new_thumb = new_fp.get("thumb") or []

    best_score = -1.0
    best_candidate: dict | None = None

    for candidate in candidates:
        if candidate is None:
            continue
        fp = candidate.get("fingerprint")
        if fp is None and "fingerprint_json" in candidate:
            fp = deserialize(candidate.get("fingerprint_json"))
        if fp is None:
            continue

        matched = False
        # Score is only used to pick the *best* match for diagnostics;
        # the gate decision is the boolean OR below. Structural matches
        # outrank colour-only matches so the returned candidate reflects
        # the strongest signal.
        score = -1.0

        cand_thumb = fp.get("thumb") or []
        if new_thumb and cand_thumb:
            structure = structural_similarity(new_thumb, cand_thumb)
            if structure >= structure_threshold:
                matched = True
                score = 1.0 + structure

        if not matched:
            cosine = cosine_similarity(
                new_fp.get("hist") or [], fp.get("hist") or []
            )
            hamming = hamming_distance(
                int(new_fp.get("dhash") or 0),
                int(fp.get("dhash") or 0),
            )
            if cosine >= hist_threshold and hamming <= hash_threshold:
                matched = True
                score = cosine - (hamming / 64.0)

        if matched and score > best_score:
            best_score = score
            best_candidate = candidate

    return best_candidate is not None, best_candidate
