"""Smoke tests for vision provider resolution, fallback, and the local-analyze API.

Runs against a throwaway SQLite DB under ``backend/data/_vision_smoke``.
Designed for ``python tests/test_vision_provider_smoke.py`` (no pytest). No
live GPU or OpenAI/local VLM servers — providers and the analyze service are
monkeypatched.

Covers:
* ``resolve_vision_provider`` for openai / local_vlm / auto with settings overrides.
* ``analyze_with_fallback``: local failure then OpenAI success.
* ``POST /api/vision/local-analyze`` response schema (service mocked).
"""

from __future__ import annotations

import asyncio
import base64
import io
import os
import shutil
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

TEST_ROOT = Path(__file__).resolve().parent
SCRATCH = TEST_ROOT.parent / "data" / "_vision_smoke"
if SCRATCH.exists():
    shutil.rmtree(SCRATCH)
SCRATCH.mkdir(parents=True, exist_ok=True)

os.environ["DATABASE_PATH"] = str(SCRATCH / "ghost.db")
os.environ["CHROMA_PATH"] = str(SCRATCH / "chroma")
os.environ["UPLOAD_PATH"] = str(SCRATCH / "uploads")
os.environ.setdefault("GHOST_MASTER_KEY", "")
if not os.environ["GHOST_MASTER_KEY"]:
    from cryptography.fernet import Fernet

    os.environ["GHOST_MASTER_KEY"] = Fernet.generate_key().decode()

sys.path.insert(0, str(TEST_ROOT.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings, settings  # noqa: E402
from app.services import vision_provider  # noqa: E402
from app.services.vision_provider import (  # noqa: E402
    VisionProviderResult,
    analyze_with_fallback,
    resolve_vision_provider,
)
from app.storage.database import get_db, run_migrations  # noqa: E402
from app.storage.user_store import create_user  # noqa: E402

_passed = 0
_failed = 0
_REQUIRED_RESPONSE_KEYS = (
    "provider",
    "model",
    "summary",
    "risk_level",
    "objects",
    "actions",
    "recommended_alert",
)


def check(name: str, cond: bool, detail: str = "") -> None:
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  [PASS] {name}")
    else:
        _failed += 1
        suffix = f" — {detail}" if detail else ""
        print(f"  [FAIL] {name}{suffix}")


def _tiny_jpeg_b64() -> str:
    return base64.b64encode(
        bytes(
            [
                0xFF,
                0xD8,
                0xFF,
                0xE0,
                0x00,
                0x10,
                0x4A,
                0x46,
                0x49,
                0x46,
                0x00,
                0x01,
                0xFF,
                0xD9,
            ]
        )
    ).decode("ascii")


def _tiny_png_bytes() -> bytes:
    # 1x1 PNG
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )


def _settings(**overrides: Any) -> Settings:
    base = {
        "vision_provider": "openai",
        "local_vlm_enabled": False,
        "local_vlm_base_url": "",
        "local_vlm_model": "test-local-model",
        "local_vlm_api_key": "",
        "local_vlm_timeout_seconds": 5.0,
        "vision_model": "gpt-test",
    }
    base.update(overrides)
    return Settings(**base)


def test_resolve_vision_provider() -> None:
    print("test_resolve_vision_provider")

    check(
        "openai stays openai",
        resolve_vision_provider(_settings(vision_provider="openai")) == "openai",
    )
    check(
        "local_vlm + enabled + base_url -> local_vlm",
        resolve_vision_provider(
            _settings(
                vision_provider="local_vlm",
                local_vlm_enabled=True,
                local_vlm_base_url="http://127.0.0.1:11434",
            )
        )
        == "local_vlm",
    )
    check(
        "auto + local configured -> local_vlm",
        resolve_vision_provider(
            _settings(
                vision_provider="auto",
                local_vlm_enabled=True,
                local_vlm_base_url="http://127.0.0.1:8000",
            )
        )
        == "local_vlm",
    )
    check(
        "local_vlm without URL falls back to openai",
        resolve_vision_provider(
            _settings(vision_provider="local_vlm", local_vlm_enabled=False)
        )
        == "openai",
    )
    check(
        "auto without local config falls back to openai",
        resolve_vision_provider(
            _settings(vision_provider="auto", local_vlm_enabled=False)
        )
        == "openai",
    )

    prev_provider = settings.vision_provider
    prev_enabled = settings.local_vlm_enabled
    prev_url = settings.local_vlm_base_url
    try:
        settings.vision_provider = "auto"
        settings.local_vlm_enabled = True
        settings.local_vlm_base_url = "http://127.0.0.1:11434"
        check(
            "settings env override: auto resolves local when configured",
            resolve_vision_provider() == "local_vlm",
        )
    finally:
        settings.vision_provider = prev_provider
        settings.local_vlm_enabled = prev_enabled
        settings.local_vlm_base_url = prev_url


async def _run_analyze_with_fallback() -> None:
    print("test_analyze_with_fallback_local_fails_openai_succeeds")

    tile = {
        "tile_index": 0,
        "object_type": "person",
        "tracking_signature": "red_hat",
        "confidence": 0.9,
        "deep_description": "person in red hat",
        "activity_description": "walking",
        "position_description": "center",
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
            "vehicle_type": "",
            "manufacturer_estimation": "",
            "model_estimation": "",
            "primary_color": "",
            "secondary_color": "",
            "license_plate_partial": "",
            "vehicle_identifiers": [],
        },
    }

    async def local_fail(**kwargs: Any) -> VisionProviderResult:
        return VisionProviderResult(
            tiles=[],
            provider="local_vlm",
            model="local-test",
            error="connection refused",
        )

    async def openai_ok(**kwargs: Any) -> VisionProviderResult:
        return VisionProviderResult(
            tiles=[tile],
            provider="openai",
            model="gpt-test",
        )

    class _FakeLocal:
        async def analyze_tracking_collage(self, **kwargs: Any) -> VisionProviderResult:
            return await local_fail(**kwargs)

    class _FakeOpenAI:
        async def analyze_tracking_collage(self, **kwargs: Any) -> VisionProviderResult:
            return await openai_ok(**kwargs)

    prev_provider = settings.vision_provider
    prev_enabled = settings.local_vlm_enabled
    prev_url = settings.local_vlm_base_url
    try:
        settings.vision_provider = "auto"
        settings.local_vlm_enabled = True
        settings.local_vlm_base_url = "http://127.0.0.1:11434"

        with patch.dict(
            vision_provider._PROVIDERS,
            {"local_vlm": _FakeLocal(), "openai": _FakeOpenAI()},
        ):
            result = await analyze_with_fallback(
                image_bytes=_tiny_png_bytes(),
                prompt="analyze collage",
                model=None,
                api_key="sk-test-fake",
                locale="en",
                tile_count=1,
                cols=1,
                rows=1,
                camera_label="Front",
            )

        check("fallback returns tiles", len(result.get("tiles") or []) == 1)
        check(
            "fallback tile has tracking_signature",
            result["tiles"][0].get("tracking_signature") == "red_hat",
        )
        check("no top-level error on success", "error" not in result, str(result))
    finally:
        settings.vision_provider = prev_provider
        settings.local_vlm_enabled = prev_enabled
        settings.local_vlm_base_url = prev_url


def test_local_analyze_endpoint() -> None:
    print("test_local_analyze_endpoint")

    run_migrations()
    db = get_db()
    try:
        user = create_user(db, nickname="vision-smoke", api_key="sk-vision-smoke")
    finally:
        db.close()

    mock_payload = {
        "provider": "local_vlm",
        "model": "qwen-test",
        "summary": "Empty loading bay, no movement.",
        "risk_level": "low",
        "objects": [{"name": "forklift", "description": "parked forklift"}],
        "actions": ["idle"],
        "recommended_alert": False,
    }

    async def fake_analyze_local_vision(**kwargs: Any) -> dict[str, Any]:
        return dict(mock_payload)

    from app.main import app
    import app.routes.vision as vision_routes

    with patch.object(
        vision_routes,
        "analyze_local_vision",
        side_effect=fake_analyze_local_vision,
    ):
        client = TestClient(app)
        response = client.post(
            "/api/vision/local-analyze",
            json={
                "user_id": user["id"],
                "image_base64": _tiny_jpeg_b64(),
                "prompt": "Describe the scene briefly.",
                "provider": "local_vlm",
            },
        )

    check("endpoint returns 200", response.status_code == 200, response.text)
    body = response.json()
    check("envelope ok=true", body.get("ok") is True, str(body))
    data = body.get("data") or {}
    for key in _REQUIRED_RESPONSE_KEYS:
        check(f"response has {key}", key in data, str(data.keys()))
    check("mocked summary returned", data.get("summary") == mock_payload["summary"])
    check("mocked provider returned", data.get("provider") == "local_vlm")
    check("objects is a list", isinstance(data.get("objects"), list))
    check("recommended_alert is bool", isinstance(data.get("recommended_alert"), bool))


def main() -> int:
    print("Vision provider smoke — DB at", settings.database_path)
    test_resolve_vision_provider()
    asyncio.run(_run_analyze_with_fallback())
    test_local_analyze_endpoint()
    print(f"\nRESULTS  passed={_passed}  failed={_failed}")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
