"""RTL collage builder for the local YOLO tracking pipeline.

Given a list of pending crop file paths, generates a single white-canvas
PNG collage. Layout rules (per the plan):

- Background: pure white.
- Each tile is a fixed square size (``settings.detection_collage_tile_px``),
  with ``settings.detection_collage_tile_padding_px`` of padding between
  tiles.
- RTL placement: the first tile sits in the **top-right** corner, the
  next tile is placed to its **left**, then we wrap to the next row when
  the row is full.
- Each tile gets an ``HH:mm`` timestamp overlay in the top-left of the
  tile (which is the tile's "trailing" edge in RTL terms — the model
  doesn't care about the visual reading order, it just needs every tile
  legibly indexed).
- The function returns the PNG bytes plus a list of placement metadata
  (``tile_index``, ``row``, ``col``, ``crop_path``) so callers can map
  Ghost Vision's per-tile JSON back to the source crop / row id.
"""

from __future__ import annotations

import io
import logging
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("ghost.detection.collage")


@dataclass(frozen=True)
class CollageTilePlacement:
    """Where a single crop landed on the collage canvas."""

    tile_index: int
    row: int
    col: int
    crop_path: str
    captured_at: str | None
    crop_id: str | None = None
    label: str | None = None


@dataclass(frozen=True)
class CollageResult:
    png_bytes: bytes
    width: int
    height: int
    cols: int
    rows: int
    placements: tuple[CollageTilePlacement, ...]


def compute_grid(count: int) -> tuple[int, int]:
    """Pick a grid that fits ``count`` tiles tightly.

    Returns ``(cols, rows)``. We use ``cols = ceil(sqrt(count))`` capped
    at 11 so the collage never gets wider than ~11 tiles (max batch size
    is 88). ``rows`` is then ``ceil(count / cols)``.
    """

    if count <= 0:
        return (1, 1)
    cols = max(1, min(11, math.ceil(math.sqrt(count))))
    rows = max(1, math.ceil(count / cols))
    return (cols, rows)


def _format_hhmm(captured_at: str | None) -> str:
    if not captured_at:
        return ""
    try:
        # ``fromisoformat`` accepts ``2024-...+00:00`` as well as the
        # JS-style ``...Z`` we still need to coerce.
        cleaned = captured_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
    except Exception:
        return ""
    return dt.strftime("%H:%M")


def _load_default_font():
    """Return a small font usable for the ``HH:mm`` overlay.

    Tries a couple of system fonts; falls back to Pillow's bitmap font
    so the collage renders even on a clean machine.
    """

    from PIL import ImageFont  # type: ignore

    candidates = [
        "/System/Library/Fonts/SFNSMono.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=16)
        except Exception:
            continue
    return ImageFont.load_default()


def _open_crop_image(crop_path: str):
    from PIL import Image  # type: ignore

    img = Image.open(crop_path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def _resize_keep_aspect(image, target_size: int):
    """Letterbox the crop into a ``target_size``×``target_size`` square
    on a white background so aspect ratio is preserved."""

    from PIL import Image  # type: ignore

    canvas = Image.new("RGB", (target_size, target_size), color=(255, 255, 255))
    src_w, src_h = image.size
    if src_w == 0 or src_h == 0:
        return canvas
    scale = min(target_size / src_w, target_size / src_h)
    dst_w = max(1, int(round(src_w * scale)))
    dst_h = max(1, int(round(src_h * scale)))
    resized = image.resize((dst_w, dst_h), Image.LANCZOS)
    paste_x = (target_size - dst_w) // 2
    paste_y = (target_size - dst_h) // 2
    canvas.paste(resized, (paste_x, paste_y))
    return canvas


def build_collage(
    crops: list[dict],
    *,
    tile_px: int,
    padding_px: int,
) -> CollageResult:
    """Build the white-canvas RTL collage from ``crops``.

    Each item in ``crops`` is a dict with at least:
        - ``crop_path``: filesystem path to the crop PNG/JPEG.
        - ``captured_at``: ISO timestamp (optional, used for overlay).
        - ``id``: pending crop row id (optional, propagated to placement).
        - ``label``: optional short label (e.g. camera label).

    Missing crop files are skipped silently — they cannot be sent to
    Ghost Vision anyway, and this keeps a partially-corrupt queue from
    blowing up the whole flush.
    """

    from PIL import Image, ImageDraw  # type: ignore

    valid_crops: list[dict] = []
    for item in crops:
        path = (item or {}).get("crop_path")
        if not path:
            continue
        if not Path(path).exists():
            logger.warning("Skipping missing crop %s", path)
            continue
        valid_crops.append(item)

    count = len(valid_crops)
    cols, rows = compute_grid(count if count > 0 else 1)
    tile = max(1, int(tile_px))
    pad = max(0, int(padding_px))

    canvas_w = cols * tile + (cols + 1) * pad
    canvas_h = rows * tile + (rows + 1) * pad
    canvas = Image.new("RGB", (canvas_w, canvas_h), color=(255, 255, 255))

    placements: list[CollageTilePlacement] = []

    if count == 0:
        # Empty canvas — return a 1×1 blank tile so callers don't crash.
        buf = io.BytesIO()
        canvas.save(buf, format="PNG")
        return CollageResult(
            png_bytes=buf.getvalue(),
            width=canvas_w,
            height=canvas_h,
            cols=cols,
            rows=rows,
            placements=tuple(),
        )

    draw = ImageDraw.Draw(canvas)
    font = _load_default_font()

    for tile_index, item in enumerate(valid_crops):
        row = tile_index // cols
        col_in_row = tile_index % cols
        # RTL placement: visually first tile (index 0) goes top-right, so
        # the column is mirrored.
        visual_col = cols - 1 - col_in_row
        x = pad + visual_col * (tile + pad)
        y = pad + row * (tile + pad)
        try:
            crop_img = _open_crop_image(str(item["crop_path"]))
        except Exception:
            logger.exception(
                "Failed to load crop image %s — skipping",
                item.get("crop_path"),
            )
            continue
        boxed = _resize_keep_aspect(crop_img, tile)
        canvas.paste(boxed, (x, y))

        # Index badge — top-right corner of the tile (helps Ghost Vision
        # report tile_index unambiguously).
        index_text = str(tile_index)
        idx_w = _text_width(draw, index_text, font)
        idx_h = _text_height(draw, index_text, font)
        idx_x = x + tile - idx_w - 6
        idx_y = y + 4
        draw.rectangle(
            [idx_x - 3, idx_y - 2, idx_x + idx_w + 3, idx_y + idx_h + 2],
            fill=(0, 0, 0),
        )
        draw.text((idx_x, idx_y), index_text, fill=(255, 255, 255), font=font)

        # Timestamp — top-left of tile.
        hhmm = _format_hhmm(item.get("captured_at"))
        if hhmm:
            ts_w = _text_width(draw, hhmm, font)
            ts_h = _text_height(draw, hhmm, font)
            draw.rectangle(
                [x + 2, y + 2, x + ts_w + 8, y + ts_h + 6],
                fill=(0, 0, 0),
            )
            draw.text((x + 5, y + 4), hhmm, fill=(255, 255, 255), font=font)

        placements.append(
            CollageTilePlacement(
                tile_index=tile_index,
                row=row,
                col=col_in_row,
                crop_path=str(item["crop_path"]),
                captured_at=item.get("captured_at"),
                crop_id=item.get("id"),
                label=item.get("label"),
            )
        )

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return CollageResult(
        png_bytes=buf.getvalue(),
        width=canvas_w,
        height=canvas_h,
        cols=cols,
        rows=rows,
        placements=tuple(placements),
    )


def _text_width(draw, text: str, font) -> int:
    try:
        # Pillow >= 10 uses textbbox; textsize is deprecated/removed.
        bbox = draw.textbbox((0, 0), text, font=font)
        return int(bbox[2] - bbox[0])
    except Exception:
        return 8 * len(text)


def _text_height(draw, text: str, font) -> int:
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        return int(bbox[3] - bbox[1])
    except Exception:
        return 12


def expected_tile_position(
    tile_index: int,
    cols: int,
    *,
    tile_px: int,
    padding_px: int,
) -> tuple[int, int]:
    """Helper used by tests to assert RTL placement is correct.

    Returns the ``(x, y)`` pixel position of the **top-left** corner of
    the requested tile on the canvas.
    """

    row = tile_index // cols
    col_in_row = tile_index % cols
    visual_col = cols - 1 - col_in_row
    x = padding_px + visual_col * (tile_px + padding_px)
    y = padding_px + row * (tile_px + padding_px)
    return (x, y)
