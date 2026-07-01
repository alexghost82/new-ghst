"""Local / fallback vision analysis for standalone frame inspection."""

from __future__ import annotations

import logging
import time
from typing import Any, Literal

from app.config import settings
from app.storage.conversation_store import get_conversation

logger = logging.getLogger("ghost.vision_analyze")

VisionProviderChoice = Literal["openai", "local_vlm", "auto"]

_DEFAULT_SCENE_PROMPT = (
    "You are Ghost, an AI security analyst reviewing a live camera frame. "
    "Describe the scene factually for site awareness: people, vehicles, "
    "activities, and anything unusual. Do not identify individuals."
)


def _effective_provider(
    provider_override: VisionProviderChoice | None,
) -> VisionProviderChoice:
    from app.services.vision_provider import resolve_effective_provider

    resolved = resolve_effective_provider(provider_override)
    return resolved  # type: ignore[return-value]


def _local_vlm_settings() -> dict[str, Any]:
    return {
        "model": (settings.local_vlm_model or "llava").strip(),
        "base_url": (settings.local_vlm_base_url or "http://127.0.0.1:11434").strip(),
        "api_key": (settings.local_vlm_api_key or "").strip(),
        "timeout_seconds": float(settings.local_vlm_timeout_seconds or 60.0),
        "enabled": bool(settings.local_vlm_enabled),
    }


def _local_vlm_configured() -> bool:
    cfg = _local_vlm_settings()
    return bool(cfg["enabled"] and cfg["base_url"])


def _provider_result(
    *,
    provider: str,
    model: str,
    analysis: dict[str, Any],
    latency_ms: int | None = None,
    fallback_status: str = "none",
    fallback_reason: str | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "provider": provider,
        "model": model,
        "summary": analysis.get("summary") or "",
        "risk_level": analysis.get("risk_level") or "unknown",
        "objects": analysis.get("objects") or [],
        "actions": analysis.get("actions") or [],
        "recommended_alert": analysis.get("recommended_alert", False),
        **({"raw_text": analysis["raw_text"]} if analysis.get("raw_text") else {}),
        **({"error": analysis["error"]} if analysis.get("error") else {}),
    }
    if latency_ms is not None:
        result["latency_ms"] = latency_ms
    if fallback_status != "none":
        result["fallback_status"] = fallback_status
    if fallback_reason:
        result["fallback_reason"] = fallback_reason
    return result


async def _analyze_with_local_vlm(
    image_base64: str,
    prompt: str,
) -> dict[str, Any]:
    from app.services import local_vlm

    cfg = _local_vlm_settings()
    analysis = await local_vlm.analyze_scene_structured(
        image_base64,
        prompt,
        model=cfg["model"],
        base_url=cfg["base_url"],
        api_key=cfg["api_key"],
        timeout_seconds=cfg["timeout_seconds"],
    )
    return _provider_result(
        provider="local_vlm",
        model=cfg["model"],
        analysis=analysis,
    )


def _map_openai_scene_to_analysis(parsed: dict[str, Any]) -> dict[str, Any]:
    """Map :data:`VISION_ANALYSIS_SCHEMA` output to the local-analyze shape."""
    from app.schemas.vision import LocalVlmObject

    summary = (parsed.get("scene_overview") or parsed.get("summary") or "").strip()

    objects: list[dict[str, Any]] = []
    for person in parsed.get("people") or []:
        if not isinstance(person, dict):
            continue
        desc = (person.get("description") or person.get("action") or "").strip()
        if desc:
            objects.append(
                LocalVlmObject(
                    name="person",
                    object_type="person",
                    description=desc,
                    position=(person.get("position_in_frame") or "").strip(),
                ).model_dump()
            )
    for vehicle in parsed.get("vehicles") or []:
        if not isinstance(vehicle, dict):
            continue
        desc = (vehicle.get("description") or "").strip()
        if desc:
            objects.append(
                LocalVlmObject(
                    name="vehicle",
                    object_type=(vehicle.get("type") or "vehicle"),
                    description=desc,
                    position=(vehicle.get("position") or "").strip(),
                ).model_dump()
            )

    actions: list[str] = []
    for person in parsed.get("people") or []:
        if isinstance(person, dict):
            action = (person.get("action") or "").strip()
            if action:
                actions.append(action)

    env = parsed.get("environment") if isinstance(parsed.get("environment"), dict) else {}
    anomalies = [
        str(a).strip()
        for a in (env.get("anomalies") or [])
        if isinstance(a, str) and a.strip()
    ]
    notes = [
        str(n).strip()
        for n in (parsed.get("notes") or [])
        if isinstance(n, str) and n.strip()
    ]
    risk_level = "low"
    if anomalies or any("critical" in n.lower() for n in notes):
        risk_level = "high"
    elif notes:
        risk_level = "medium"

    return {
        "summary": summary,
        "risk_level": risk_level,
        "objects": objects,
        "actions": actions,
        "recommended_alert": bool(anomalies),
    }


async def _analyze_with_openai(
    image_base64: str,
    prompt: str,
    *,
    api_key: str | None,
) -> dict[str, Any]:
    if not api_key:
        return _provider_result(
            provider="openai",
            model=settings.vision_model,
            analysis={
                "summary": "",
                "risk_level": "unknown",
                "objects": [],
                "actions": [],
                "recommended_alert": False,
                "error": "API key required for OpenAI vision analysis",
            },
        )

    from app.services.openai_client import structured_vision_analysis

    detail = settings.vision_image_detail or "high"
    if detail not in ("low", "high", "auto"):
        detail = "high"

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}",
                        "detail": detail,
                    },
                },
            ],
        }
    ]

    try:
        parsed = await structured_vision_analysis(messages, api_key=api_key)
    except Exception:
        logger.exception("OpenAI structured vision analysis failed")
        return _provider_result(
            provider="openai",
            model=settings.vision_model,
            analysis={
                "summary": "",
                "risk_level": "unknown",
                "objects": [],
                "actions": [],
                "recommended_alert": False,
                "error": "OpenAI vision analysis failed",
            },
        )

    if not parsed:
        return _provider_result(
            provider="openai",
            model=settings.vision_model,
            analysis={
                "summary": "",
                "risk_level": "unknown",
                "objects": [],
                "actions": [],
                "recommended_alert": False,
                "error": "OpenAI returned empty analysis",
            },
        )

    return _provider_result(
        provider="openai",
        model=settings.vision_model,
        analysis=_map_openai_scene_to_analysis(parsed),
    )


async def _analyze_direct_fallback(
    image_base64: str,
    prompt: str,
    *,
    api_key: str | None,
    provider_override: VisionProviderChoice | None,
) -> dict[str, Any]:
    """Route scene analysis to local VLM and/or OpenAI with optional fallback."""
    provider = _effective_provider(provider_override)
    requested = (provider_override or settings.vision_provider or "openai").strip().lower()

    if provider == "openai":
        return await _analyze_with_openai(image_base64, prompt, api_key=api_key)

    if provider == "local_vlm":
        if not _local_vlm_configured():
            return _provider_result(
                provider="local_vlm",
                model=_local_vlm_settings()["model"],
                analysis={
                    "summary": "",
                    "risk_level": "unknown",
                    "objects": [],
                    "actions": [],
                    "recommended_alert": False,
                    "error": "local_vlm_unavailable",
                },
            )
        return await _analyze_with_local_vlm(image_base64, prompt)

    # auto
    if _local_vlm_configured():
        local_result = await _analyze_with_local_vlm(image_base64, prompt)
        if not local_result.get("error"):
            local_result["fallback_status"] = "none"
            return local_result
        logger.info(
            "Local VLM failed (%s); falling back to OpenAI",
            local_result.get("error"),
        )
        openai_result = await _analyze_with_openai(
            image_base64, prompt, api_key=api_key
        )
        openai_result["fallback_status"] = "openai_after_local_failure"
        openai_result["fallback_reason"] = local_result.get("error") or local_result.get(
            "fallback_reason"
        )
        return openai_result

    logger.debug("Local VLM not configured; using OpenAI for auto provider")
    openai_result = await _analyze_with_openai(image_base64, prompt, api_key=api_key)
    if requested == "auto":
        openai_result["fallback_status"] = "openai_local_unconfigured"
    return openai_result


async def analyze_local_vision(
    db,
    user_id: str,
    image_base64: str,
    prompt: str | None,
    conversation_id: str | None,
    camera_id: str | None,
    provider_override: VisionProviderChoice | None,
    *,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Analyze one camera frame via local VLM with optional OpenAI fallback.

    When ``conversation_id`` is set, ownership is enforced via
    :func:`get_conversation`. ``camera_id`` is accepted for forward-compatible
    metadata but is not persisted in this pass.
    """
    if conversation_id:
        conv = get_conversation(db, conversation_id, user_id=user_id)
        if not conv:
            from app.schemas.responses import error_response

            error_response(
                "CONVERSATION_NOT_FOUND",
                "Conversation not found or access denied",
                404,
            )

    effective_prompt = (prompt or "").strip() or _DEFAULT_SCENE_PROMPT
    if camera_id:
        effective_prompt = (
            f"{effective_prompt}\n\nCamera identifier: {camera_id.strip()}"
        )

    started = time.perf_counter()
    result = await _analyze_direct_fallback(
        image_base64,
        effective_prompt,
        api_key=api_key,
        provider_override=provider_override,
    )
    result["latency_ms"] = int((time.perf_counter() - started) * 1000)
    result.setdefault("fallback_status", "none")
    return result
