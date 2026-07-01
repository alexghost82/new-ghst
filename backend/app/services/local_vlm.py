"""OpenAI-compatible local VLM client for vLLM/Ollama.

Uses the ``/v1/chat/completions`` endpoint with multimodal message content.
All public functions return dicts and never raise to callers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

import httpx

from app.schemas.vision import LocalVlmObject, LocalVlmSceneAnalysis, RiskLevel

logger = logging.getLogger("ghost.local_vlm")

_RETRY_BACKOFF_SECONDS = 0.35
_VALID_RISK_LEVELS: frozenset[str] = frozenset(
    {"none", "low", "medium", "high", "critical", "unknown"}
)
_JSON_FENCE_RE = re.compile(
    r"```(?:json)?\s*\n?(.*?)\n?```",
    re.DOTALL | re.IGNORECASE,
)


def _normalize_base_url(base_url: str) -> str:
    return (base_url or "").strip().rstrip("/")


def _strip_data_url_prefix(base64_image: str) -> str:
    """Return raw base64 payload, stripping an optional data-URL prefix."""
    raw = (base64_image or "").strip()
    if raw.startswith("data:"):
        comma = raw.find(",")
        if comma >= 0:
            return raw[comma + 1 :].strip()
    return raw


def _build_image_url(base64_image: str) -> str:
    payload = _strip_data_url_prefix(base64_image)
    return f"data:image/jpeg;base64,{payload}"


def _build_messages(prompt: str, base64_image: str) -> list[dict[str, Any]]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": _build_image_url(base64_image)},
                },
            ],
        }
    ]


def _extract_json_text(raw_text: str) -> str:
    """Pull JSON from model output, tolerating markdown code fences."""
    text = (raw_text or "").strip()
    if not text:
        return text

    fence_match = _JSON_FENCE_RE.search(text)
    if fence_match:
        return fence_match.group(1).strip()

    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()

    return text


def _parse_json_content(raw_text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Parse JSON from model text. Returns ``(parsed, error_message)``."""
    candidate = _extract_json_text(raw_text)
    if not candidate:
        return None, "empty response content"

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return None, f"invalid JSON: {exc}"

    if not isinstance(parsed, dict):
        return None, "response JSON is not an object"

    return parsed, None


def _should_retry(exc: BaseException | None, status_code: int | None) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectTimeout, httpx.ReadTimeout)):
        return True
    if status_code is not None and status_code >= 500:
        return True
    return False


def _extract_response_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    if not isinstance(first, dict):
        return ""
    message = first.get("message")
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return ""


def _error_result(message: str, *, raw_text: str = "") -> dict[str, Any]:
    return {"error": message, "raw_text": raw_text}


async def analyze_image(
    base64_image: str,
    prompt: str,
    *,
    model: str,
    base_url: str,
    api_key: str,
    timeout_seconds: float,
    response_format: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Send a single image + prompt to a local OpenAI-compatible VLM.

  Returns the parsed JSON object from the model on success. On any failure
  returns ``{"error": "...", "raw_text": "..."}`` and never raises.
    """
    normalized_url = _normalize_base_url(base_url)
    if not normalized_url:
        return _error_result("base_url is required")
    if not (model or "").strip():
        return _error_result("model is required")

    endpoint = f"{normalized_url}/v1/chat/completions"
    body: dict[str, Any] = {
        "model": model.strip(),
        "messages": _build_messages(prompt, base64_image),
        "temperature": 0.0,
    }
    if response_format is not None:
        body["response_format"] = response_format

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if (api_key or "").strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"

    timeout = httpx.Timeout(timeout_seconds)
    last_error = "request failed"
    last_raw = ""

    for attempt in range(2):
        status_code: int | None = None
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(endpoint, json=body, headers=headers)
            status_code = response.status_code
            last_raw = response.text

            if response.status_code >= 400:
                last_error = f"HTTP {response.status_code}: {response.text[:500]}"
                if _should_retry(None, response.status_code) and attempt == 0:
                    await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
                    continue
                return _error_result(last_error, raw_text=last_raw)

            try:
                payload = response.json()
            except json.JSONDecodeError as exc:
                return _error_result(
                    f"invalid response JSON: {exc}",
                    raw_text=last_raw,
                )

            if not isinstance(payload, dict):
                return _error_result("response payload is not an object", raw_text=last_raw)

            raw_content = _extract_response_text(payload)
            parsed, parse_error = _parse_json_content(raw_content)
            if parse_error:
                return _error_result(parse_error, raw_text=raw_content or last_raw)

            return parsed

        except httpx.TimeoutException as exc:
            last_error = f"request timed out after {timeout_seconds}s: {exc}"
            if attempt == 0:
                await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
                continue
            return _error_result(last_error, raw_text=last_raw)

        except httpx.HTTPError as exc:
            last_error = f"HTTP error: {exc}"
            if attempt == 0 and _should_retry(exc, status_code):
                await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
                continue
            return _error_result(last_error, raw_text=last_raw)

        except Exception as exc:
            logger.exception("local_vlm analyze_image unexpected failure")
            return _error_result(f"unexpected error: {exc}", raw_text=last_raw)

    return _error_result(last_error, raw_text=last_raw)


def _coerce_risk_level(value: Any) -> RiskLevel:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in _VALID_RISK_LEVELS:
            return normalized  # type: ignore[return-value]
    return "unknown"


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "yes", "1"}:
            return True
        if lowered in {"false", "no", "0"}:
            return False
    return False


def _coerce_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            result.append(item.strip())
    return result


def _coerce_objects(value: Any) -> list[LocalVlmObject]:
    if not isinstance(value, list):
        return []

    objects: list[LocalVlmObject] = []
    for item in value:
        if isinstance(item, str):
            text = item.strip()
            if text:
                objects.append(LocalVlmObject(name=text, description=text))
            continue
        if not isinstance(item, dict):
            continue

        name = str(
            item.get("name")
            or item.get("label")
            or item.get("object")
            or item.get("type")
            or ""
        ).strip()
        object_type = str(item.get("object_type") or item.get("type") or "").strip()
        description = str(
            item.get("description") or item.get("details") or name
        ).strip()
        position = str(item.get("position") or item.get("location") or "").strip()

        confidence_raw = item.get("confidence")
        confidence: float | None
        try:
            confidence = float(confidence_raw) if confidence_raw is not None else None
        except (TypeError, ValueError):
            confidence = None

        objects.append(
            LocalVlmObject(
                name=name,
                object_type=object_type,
                description=description,
                confidence=confidence,
                position=position,
            )
        )
    return objects


def _normalize_scene_analysis(
    parsed: dict[str, Any] | None,
    *,
    raw_text: str = "",
    error: str | None = None,
) -> dict[str, Any]:
    if error or not isinstance(parsed, dict):
        result = LocalVlmSceneAnalysis.empty(raw_text=raw_text or None)
        payload = result.to_dict()
        if error:
            payload["error"] = error
        if raw_text:
            payload["raw_text"] = raw_text
        return payload

    summary = str(
        parsed.get("summary")
        or parsed.get("scene_summary")
        or parsed.get("scene_overview")
        or parsed.get("description")
        or ""
    ).strip()

    analysis = LocalVlmSceneAnalysis(
        summary=summary,
        risk_level=_coerce_risk_level(parsed.get("risk_level")),
        objects=_coerce_objects(parsed.get("objects")),
        actions=_coerce_string_list(parsed.get("actions")),
        recommended_alert=_coerce_bool(
            parsed.get("recommended_alert", parsed.get("alert_recommended"))
        ),
        raw_text=raw_text or None,
    )
    return analysis.to_dict()


_SCENE_PROMPT_SUFFIX = """

Respond with a single JSON object only (no markdown) using these keys:
- summary (string): brief scene overview
- risk_level (string): one of none, low, medium, high, critical, unknown
- objects (array): items with name, object_type, description, confidence (0-1), position
- actions (array of strings): notable activities observed
- recommended_alert (boolean): whether an operator alert is warranted
"""


async def analyze_scene_structured(
    base64_image: str,
    prompt: str,
    *,
    model: str,
    base_url: str,
    api_key: str,
    timeout_seconds: float,
    response_format: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Analyze a scene and return a normalized structured dict.

    Keys: ``summary``, ``risk_level``, ``objects``, ``actions``,
    ``recommended_alert``, and optionally ``raw_text`` / ``error``.
    Never raises.
    """
    structured_prompt = f"{prompt.rstrip()}{_SCENE_PROMPT_SUFFIX}"
    default_format: dict[str, Any] = {"type": "json_object"}
    chosen_format = response_format if response_format is not None else default_format

    result = await analyze_image(
        base64_image,
        structured_prompt,
        model=model,
        base_url=base_url,
        api_key=api_key,
        timeout_seconds=timeout_seconds,
        response_format=chosen_format,
    )

    if "error" in result:
        raw_text = str(result.get("raw_text") or "")
        return _normalize_scene_analysis(
            None,
            raw_text=raw_text,
            error=str(result.get("error") or "analysis failed"),
        )

    raw_text = ""
    if isinstance(result, dict):
        raw_text = str(result.get("raw_text") or "")

    return _normalize_scene_analysis(result, raw_text=raw_text)
