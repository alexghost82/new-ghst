"""Vision provider abstraction for Ghost tracking collage analysis.

Routes collage inference to OpenAI or a self-hosted local VLM endpoint.
``analyze_with_fallback`` is the single entry point used by
``tracking_collage_client``.
"""

from __future__ import annotations

import base64
import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from openai import AsyncOpenAI

from app.config import Settings, settings
from app.services.openai_client import _completion_kwargs

logger = logging.getLogger("ghost.vision_provider")


@dataclass
class VisionProviderResult:
    tiles: list[dict]
    provider: str
    model: str
    error: str | None = None

    def to_response(self) -> dict:
        out: dict = {"tiles": self.tiles}
        if self.error:
            out["error"] = self.error
        return out


@runtime_checkable
class VisionProvider(Protocol):
    async def analyze_tracking_collage(
        self,
        *,
        image_bytes: bytes,
        prompt: str,
        model: str | None,
        api_key: str,
        locale: str | None,
        tile_count: int,
        cols: int,
        rows: int,
        camera_label: str | None,
    ) -> VisionProviderResult: ...


class _BaseVisionProvider(ABC):
    provider_name: str = "unknown"

    @abstractmethod
    def _resolve_model(self, model: str | None) -> str:
        raise NotImplementedError

    @abstractmethod
    def _build_client(self, api_key: str) -> AsyncOpenAI:
        raise NotImplementedError

    def _image_detail(self) -> str:
        detail = settings.vision_image_detail or "high"
        return detail if detail in ("low", "high", "auto") else "high"

    def _load_schema(self) -> dict:
        from app.services.tracking_collage_client import TRACKING_COLLAGE_SCHEMA

        return TRACKING_COLLAGE_SCHEMA

    def _parse_response(self, raw: str, *, model: str) -> VisionProviderResult:
        safe = VisionProviderResult(
            tiles=[],
            provider=self.provider_name,
            model=model,
        )
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.exception(
                "Tracking collage returned invalid JSON: %r", raw[:500]
            )
            safe.error = "invalid_json"
            return safe

        if not isinstance(parsed, dict):
            return safe
        tiles = parsed.get("tiles")
        if not isinstance(tiles, list):
            return safe
        return VisionProviderResult(
            tiles=tiles,
            provider=self.provider_name,
            model=model,
        )

    async def analyze_tracking_collage(
        self,
        *,
        image_bytes: bytes,
        prompt: str,
        model: str | None,
        api_key: str,
        locale: str | None,
        tile_count: int,
        cols: int,
        rows: int,
        camera_label: str | None,
    ) -> VisionProviderResult:
        chosen_model = self._resolve_model(model)
        safe = VisionProviderResult(
            tiles=[],
            provider=self.provider_name,
            model=chosen_model,
        )

        if not image_bytes:
            return safe

        encoded = base64.b64encode(image_bytes).decode("ascii")
        detail = self._image_detail()
        client = self._build_client(api_key)

        try:
            response = await client.chat.completions.create(
                **_completion_kwargs(
                    model=chosen_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{encoded}",
                                        "detail": detail,
                                    },
                                },
                            ],
                        }
                    ],
                    temperature=0.1,
                    max_tokens=4000,
                    response_format={
                        "type": "json_schema",
                        "json_schema": self._load_schema(),
                    },
                )
            )
        except Exception as err:
            logger.exception(
                "Tracking collage analysis failed via %s", self.provider_name
            )
            safe.error = str(err)[:160] or "request_failed"
            return safe

        raw = response.choices[0].message.content or "{}"
        return self._parse_response(raw, model=chosen_model)


class OpenAIVisionProvider(_BaseVisionProvider):
    provider_name = "openai"

    def _resolve_model(self, model: str | None) -> str:
        return model or settings.vision_model

    def _build_client(self, api_key: str) -> AsyncOpenAI:
        return AsyncOpenAI(api_key=api_key)


class LocalVLMVisionProvider(_BaseVisionProvider):
    provider_name = "local_vlm"

    def _resolve_model(self, model: str | None) -> str:
        return model or settings.local_vlm_model

    def _build_client(self, api_key: str) -> AsyncOpenAI:
        base_url = (settings.local_vlm_base_url or "").strip().rstrip("/")
        key = (api_key or settings.local_vlm_api_key or "local").strip() or "local"
        return AsyncOpenAI(
            api_key=key,
            base_url=base_url,
            timeout=settings.local_vlm_timeout_seconds,
        )


_PROVIDERS: dict[str, VisionProvider] = {
    "openai": OpenAIVisionProvider(),
    "local_vlm": LocalVLMVisionProvider(),
}


def _local_vlm_configured(cfg: Settings | None = None) -> bool:
    active = cfg or settings
    return bool(active.local_vlm_enabled and (active.local_vlm_base_url or "").strip())


def resolve_effective_provider(
    provider_override: str | None = None,
    cfg: Settings | None = None,
) -> str:
    """Resolve request override, configured mode, and local availability."""
    active = cfg or settings
    raw = (provider_override or active.vision_provider or "openai").strip().lower()
    if raw not in ("openai", "local_vlm", "auto"):
        raw = "openai"
    if raw == "openai":
        return "openai"
    if raw == "local_vlm":
        return "local_vlm" if _local_vlm_configured(active) else "openai"
    return "local_vlm" if _local_vlm_configured(active) else "openai"


def resolve_vision_provider(cfg: Settings | None = None) -> str:
    """Return the effective primary vision provider name."""
    active = cfg or settings
    raw = (active.vision_provider or "openai").strip().lower()
    if raw not in ("openai", "local_vlm", "auto"):
        logger.warning("Unknown vision_provider=%r; defaulting to openai", raw)
        return "openai"
    if raw == "openai":
        return "openai"
    if _local_vlm_configured(active):
        return "local_vlm"
    if raw == "local_vlm":
        logger.warning(
            "local_vlm requested but LOCAL_VLM_ENABLED/base URL not configured; "
            "falling back to openai"
        )
    return "openai"


def get_vision_provider(name: str) -> VisionProvider:
    return _PROVIDERS.get(name, OpenAIVisionProvider())


async def analyze_with_fallback(
    *,
    image_bytes: bytes,
    prompt: str,
    model: str | None,
    api_key: str,
    locale: str | None,
    tile_count: int,
    cols: int,
    rows: int,
    camera_label: str | None,
) -> dict:
    """Run collage analysis with optional local-first fallback to OpenAI.

    Always returns ``{"tiles": list[dict]}`` and never raises. An ``error``
    key is included when every attempted provider fails.
    """
    safe_default: dict = {"tiles": []}
    if not image_bytes:
        return safe_default

    provider_pref = (settings.vision_provider or "openai").strip().lower()
    if provider_pref not in ("openai", "local_vlm", "auto"):
        provider_pref = "openai"

    last_result: VisionProviderResult | None = None

    if provider_pref in ("auto", "local_vlm") and _local_vlm_configured():
        local_key = (settings.local_vlm_api_key or api_key or "").strip()
        last_result = await get_vision_provider("local_vlm").analyze_tracking_collage(
            image_bytes=image_bytes,
            prompt=prompt,
            model=model or settings.local_vlm_model,
            api_key=local_key,
            locale=locale,
            tile_count=tile_count,
            cols=cols,
            rows=rows,
            camera_label=camera_label,
        )
        if last_result.error is None:
            return last_result.to_response()
        logger.warning(
            "Local VLM collage analysis failed (model=%s): %s",
            last_result.model,
            last_result.error,
        )

    if provider_pref == "local_vlm":
        if last_result is not None:
            return last_result.to_response()
        return {"tiles": [], "error": "local_vlm_unavailable"}

    if not (api_key or "").strip():
        return {"tiles": [], "error": "missing_api_key"}

    openai_result = await get_vision_provider("openai").analyze_tracking_collage(
        image_bytes=image_bytes,
        prompt=prompt,
        model=model,
        api_key=api_key,
        locale=locale,
        tile_count=tile_count,
        cols=cols,
        rows=rows,
        camera_label=camera_label,
    )
    return openai_result.to_response()
