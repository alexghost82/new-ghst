"""Visual Memory Engine — persists structured per-camera observations of
people, vehicles, and environmental conditions extracted from every assistant
reply, then correlates recurring entities so the conversation can later
answer "which camera saw the white sedan?" deterministically."""

from __future__ import annotations

import logging
import re
import sqlite3

from app.services.openai_client import extract_visual_observations
from app.storage.visual_memory_store import (
    insert_observation,
    upsert_entity,
)

logger = logging.getLogger("ghost.visual_memory")

# Skip extraction when the assistant message is literally the Ghost
# refusal-replacement template — there's nothing visual to extract.
_REFUSAL_REPLACEMENT_FRAGMENT = "Ghost \u05dc\u05d0 \u05d4\u05e6\u05dc\u05d9\u05d7"
_REFUSAL_REPLACEMENT_EN_FRAGMENT = "Ghost couldn't process"

_WORD_SPLIT_RE = re.compile(r"[^\w\u0590-\u05ff]+", re.UNICODE)


def _is_refusal_replacement(text: str) -> bool:
    if not text:
        return True
    snippet = text[:200]
    return (
        _REFUSAL_REPLACEMENT_FRAGMENT in snippet
        or _REFUSAL_REPLACEMENT_EN_FRAGMENT in snippet
    )


def _normalize_token(value: str | None) -> str:
    if not value:
        return ""
    token = value.strip().lower()
    token = _WORD_SPLIT_RE.sub("_", token).strip("_")
    return token


def _build_signature(entity_type: str, attrs: dict, description: str) -> str:
    """Compute a canonical signature so recurring entities map to one row.

    The signature intentionally favours visually persistent properties
    (color + subtype + facial hair) so the same person/vehicle observed
    across cameras collapses to a single ``visual_entities`` row.
    """

    attrs = attrs or {}
    parts: list[str] = [entity_type]

    if entity_type == "vehicle":
        color = _normalize_token(attrs.get("vehicle_color"))
        if not color:
            colors = attrs.get("colors") or []
            if isinstance(colors, list) and colors:
                color = _normalize_token(colors[0])
        parts.append(color or "any")
        parts.append(_normalize_token(attrs.get("vehicle_type")) or "any")

    elif entity_type == "person":
        clothing = _normalize_token(attrs.get("clothing"))
        facial_hair = _normalize_token(attrs.get("facial_hair"))
        colors = attrs.get("colors") or []
        primary_color = ""
        if isinstance(colors, list) and colors:
            primary_color = _normalize_token(colors[0])
        parts.append(primary_color or "any")
        parts.append(facial_hair or "noface")
        parts.append(clothing[:24] if clothing else "anywear")

    elif entity_type == "environment":
        tags = attrs.get("environmental_details") or []
        tag_token = ""
        if isinstance(tags, list) and tags:
            tag_token = _normalize_token(tags[0])
        if not tag_token:
            tag_token = _normalize_token(description.split(".", 1)[0])[:32]
        parts.append(tag_token or "scene")

    else:  # generic 'object'
        held = attrs.get("objects_held") or []
        obj_token = ""
        if isinstance(held, list) and held:
            obj_token = _normalize_token(held[0])
        if not obj_token:
            obj_token = _normalize_token(description.split(".", 1)[0])[:32]
        parts.append(obj_token or "item")

    return ":".join(p for p in parts if p)


def _attribute_overlap(a: dict, b: dict) -> float:
    """Lightweight Jaccard-style similarity over flat attribute values."""

    if not a or not b:
        return 0.0

    keys = set(a.keys()) | set(b.keys())
    if not keys:
        return 0.0

    overlap = 0
    total = 0
    for key in keys:
        av = a.get(key)
        bv = b.get(key)
        if not av and not bv:
            continue
        total += 1
        if isinstance(av, list) or isinstance(bv, list):
            av_set = {_normalize_token(x) for x in (av or []) if x}
            bv_set = {_normalize_token(x) for x in (bv or []) if x}
            if av_set & bv_set:
                overlap += 1
        else:
            if _normalize_token(str(av)) == _normalize_token(str(bv)) and av:
                overlap += 1

    if total == 0:
        return 0.0
    return overlap / total


async def extract_observations(
    *,
    conversation_id: str,
    message_id: str,
    assistant_text: str,
    camera_label: str | None,
    camera_device_id: str | None,
    image_path: str | None,
    observed_at: str,
    api_key: str,
    db: sqlite3.Connection,
) -> list[dict]:
    """Run LLM extraction on ``assistant_text``, persist each detected
    entity as a ``visual_observations`` row, and correlate to an existing
    ``visual_entities`` row by signature (creating one if missing).

    Always returns a list (possibly empty). Never raises — failures are
    logged so they cannot break the chat stream."""

    if _is_refusal_replacement(assistant_text):
        return []

    try:
        observations = await extract_visual_observations(
            assistant_message=assistant_text,
            camera_label=camera_label,
            api_key=api_key,
        )
    except Exception:
        logger.exception(
            "Visual extraction failed for message %s (camera=%s)",
            message_id,
            camera_label,
        )
        return []

    if not observations:
        return []

    saved: list[dict] = []
    for obs in observations:
        try:
            entity_type = obs["entity_type"]
            attrs = obs.get("visual_attributes") or {}
            description = obs["description"]
            signature = _build_signature(entity_type, attrs, description)

            entity = upsert_entity(
                db,
                conversation_id=conversation_id,
                signature=signature,
                entity_type=entity_type,
                canonical_description=description,
                visual_attributes=attrs,
                camera_label=camera_label,
                observed_at=observed_at,
                match_confidence=float(obs.get("confidence", 0.7)),
            )

            record = insert_observation(
                db,
                conversation_id=conversation_id,
                message_id=message_id,
                entity_id=entity["id"],
                entity_type=entity_type,
                camera_label=camera_label,
                camera_device_id=camera_device_id,
                description=description,
                visual_attributes=attrs,
                position_in_frame=obs.get("position_in_frame") or None,
                direction=obs.get("direction") or None,
                activity=obs.get("activity") or None,
                confidence=float(obs.get("confidence", 0.7)),
                semantic_tags=obs.get("semantic_tags") or [],
                image_path=image_path,
                observed_at=observed_at,
            )
            saved.append(record)
        except Exception:
            logger.exception(
                "Failed to persist visual observation for message %s",
                message_id,
            )

    if saved:
        logger.info(
            "Persisted %d visual observations for conversation %s (camera=%s, message=%s)",
            len(saved),
            conversation_id,
            camera_label,
            message_id,
        )
    return saved
