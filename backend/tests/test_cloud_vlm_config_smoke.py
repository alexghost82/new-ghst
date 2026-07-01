"""Smoke tests for cloud/local VLM configuration validation (no GPU, no secrets).

Run: ``python tests/test_cloud_vlm_config_smoke.py``
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

TEST_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(TEST_ROOT.parent))

from app.config import Settings  # noqa: E402
from app.services.local_vlm import _normalize_base_url  # noqa: E402

_passed = 0
_failed = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  [PASS] {name}")
    else:
        _failed += 1
        suffix = f" — {detail}" if detail else ""
        print(f"  [FAIL] {name}{suffix}")


def test_settings_defaults_off() -> None:
    print("test_settings_defaults_off")
    cfg = Settings(
        vision_provider="openai",
        local_vlm_enabled=False,
        local_vlm_base_url="",
    )
    check("default vision_provider is openai", cfg.vision_provider == "openai")
    check("local VLM disabled by default", cfg.local_vlm_enabled is False)
    check("empty base URL by default", cfg.local_vlm_base_url == "")


def test_cloud_wiring_env() -> None:
    print("test_cloud_wiring_env")
    cfg = Settings(
        vision_provider="auto",
        local_vlm_enabled=True,
        local_vlm_base_url="https://ghost-vlm-xxxxx.run.app",
        local_vlm_model="Qwen/Qwen3-VL-8B-Instruct",
        local_vlm_api_key="test-bearer-not-a-real-secret",
        local_vlm_timeout_seconds=90.0,
    )
    check("auto provider accepted", cfg.vision_provider == "auto")
    check("cloud base URL stored", "run.app" in cfg.local_vlm_base_url)
    check("model name stored", "Qwen" in cfg.local_vlm_model)
    check("timeout >= 60 for cloud", cfg.local_vlm_timeout_seconds >= 60.0)


def test_base_url_normalization() -> None:
    print("test_base_url_normalization")
    check(
        "strips trailing slash",
        _normalize_base_url("https://ghost-vlm.run.app/") == "https://ghost-vlm.run.app",
    )
    check(
        "strips /v1 suffix for backend client",
        _normalize_base_url("https://ghost-vlm.run.app/v1") == "https://ghost-vlm.run.app/v1",
    )


def test_fake_openai_compatible_payload_shape() -> None:
    """Document the minimal mock response shape used in integration tests."""
    print("test_fake_openai_compatible_payload_shape")
    mock = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "summary": "Two people near the entrance.",
                            "risk_level": "low",
                            "objects": [{"name": "person", "description": "standing"}],
                            "actions": ["waiting"],
                            "recommended_alert": False,
                        }
                    )
                }
            }
        ]
    }
    content = mock["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    check("mock has summary", "summary" in parsed)
    check("mock has risk_level", "risk_level" in parsed)
    check("mock has objects list", isinstance(parsed.get("objects"), list))


def main() -> int:
    print("Cloud VLM config smoke\n")
    test_settings_defaults_off()
    test_cloud_wiring_env()
    test_base_url_normalization()
    test_fake_openai_compatible_payload_shape()
    print(f"\nRESULTS  passed={_passed}  failed={_failed}")
    return 0 if _failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
