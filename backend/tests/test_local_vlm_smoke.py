"""Smoke tests for the local VLM (vLLM/Ollama) HTTP client.

Runs with plain ``python tests/test_local_vlm_smoke.py`` (no pytest). All HTTP
calls are monkeypatched — no GPU, no live VLM server, no API keys required.

Covers:
* JSON fence / markdown extraction before ``json.loads``.
* Single retry on HTTP 503 and on timeout.
* ``analyze_scene_structured`` default normalization on errors and partial JSON.
"""

from __future__ import annotations

import asyncio
import base64
import json
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

sys.path.insert(0, str(TEST_ROOT.parent))

import httpx  # noqa: E402

from app.services import local_vlm  # noqa: E402

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


def _tiny_jpeg_b64() -> str:
    # Minimal valid JPEG header bytes — no Pillow dependency required.
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


def _chat_payload(content: str) -> dict[str, Any]:
    return {
        "choices": [
            {
                "message": {
                    "content": content,
                }
            }
        ]
    }


async def _instant_sleep(*_args: Any, **_kwargs: Any) -> None:
    return None


class _FakeResponse:
    def __init__(
        self,
        *,
        status_code: int = 200,
        text: str = "",
        json_data: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.text = text
        self._json_data = json_data

    def json(self) -> dict[str, Any]:
        if self._json_data is None:
            raise json.JSONDecodeError("no json", self.text, 0)
        return self._json_data


class _FakeAsyncClient:
    """Records POST calls and returns a scripted sequence of responses."""

    instances: list["_FakeAsyncClient"] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._responses: list[_FakeResponse] = []
        self._exceptions: list[BaseException] = []
        self.post_calls = 0
        _FakeAsyncClient.instances.append(self)

    def script(
        self,
        *,
        responses: list[_FakeResponse] | None = None,
        exceptions: list[BaseException] | None = None,
    ) -> None:
        self._responses = list(responses or [])
        self._exceptions = list(exceptions or [])

    async def __aenter__(self) -> _FakeAsyncClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def post(self, *args: Any, **kwargs: Any) -> _FakeResponse:
        self.post_calls += 1
        if self._exceptions:
            raise self._exceptions.pop(0)
        if not self._responses:
            return _FakeResponse(status_code=500, text="no script")
        return self._responses.pop(0)


def _install_fake_client() -> tuple[_FakeAsyncClient, Any]:
    _FakeAsyncClient.instances.clear()
    client = _FakeAsyncClient()

    def _factory(*args: Any, **kwargs: Any) -> _FakeAsyncClient:
        _FakeAsyncClient.instances.append(client)
        return client

    patcher = patch.object(httpx, "AsyncClient", side_effect=_factory)
    patcher.start()
    return client, patcher


def _stop_fake_client(patcher: Any) -> None:
    patcher.stop()


def test_json_fence_parsing() -> None:
    print("test_json_fence_parsing")
    fenced = 'Here is the scene:\n```json\n{"summary": "quiet yard", "risk_level": "low"}\n```'
    extracted = local_vlm._extract_json_text(fenced)
    parsed, err = local_vlm._parse_json_content(extracted)
    check("fence stripped before parse", err is None, err or "")
    check(
        "fence JSON parsed",
        isinstance(parsed, dict) and parsed.get("summary") == "quiet yard",
        str(parsed),
    )

    bare_fence = "```\n{\"actions\": [\"walking\"]}\n```"
    parsed2, err2 = local_vlm._parse_json_content(bare_fence)
    check("bare ``` fence parses", err2 is None and parsed2.get("actions") == ["walking"])

    raw = '{"summary": "direct"}'
    parsed3, err3 = local_vlm._parse_json_content(raw)
    check("raw JSON still parses", err3 is None and parsed3.get("summary") == "direct")

    bad, err4 = local_vlm._parse_json_content("not json at all")
    check("invalid JSON returns error", bad is None and err4 is not None)


async def _run_retry_on_503() -> None:
    print("test_analyze_image_retries_on_503")
    client, patcher = _install_fake_client()
    try:
        ok_body = _chat_payload(
            json.dumps(
                {
                    "summary": "gate clear",
                    "risk_level": "none",
                    "objects": [],
                    "actions": [],
                    "recommended_alert": False,
                }
            )
        )
        client.script(
            responses=[
                _FakeResponse(status_code=503, text="overloaded"),
                _FakeResponse(
                    status_code=200,
                    text=json.dumps(ok_body),
                    json_data=ok_body,
                ),
            ]
        )

        with patch.object(local_vlm.asyncio, "sleep", new=_instant_sleep):
            result = await local_vlm.analyze_image(
                _tiny_jpeg_b64(),
                "describe",
                model="test-model",
                base_url="http://127.0.0.1:9999",
                api_key="",
                timeout_seconds=5.0,
            )

        check("503 then success: two POST attempts", client.post_calls == 2, str(client.post_calls))
        check("503 retry returns parsed JSON", result.get("summary") == "gate clear", str(result))
    finally:
        _stop_fake_client(patcher)


async def _run_timeout_handling() -> None:
    print("test_analyze_image_timeout_handling")
    client, patcher = _install_fake_client()
    try:
        client.script(
            exceptions=[
                httpx.ReadTimeout("read timed out"),
                httpx.ReadTimeout("read timed out again"),
            ]
        )

        with patch.object(local_vlm.asyncio, "sleep", new=_instant_sleep):
            result = await local_vlm.analyze_image(
                _tiny_jpeg_b64(),
                "describe",
                model="test-model",
                base_url="http://127.0.0.1:9999",
                api_key="",
                timeout_seconds=0.5,
            )

        check("timeout retried once", client.post_calls == 2, str(client.post_calls))
        check("timeout surfaces error dict", "error" in result, str(result))
        check("timeout error mentions timed out", "timed out" in result["error"].lower(), result["error"])
    finally:
        _stop_fake_client(patcher)


async def _run_scene_structured_defaults() -> None:
    print("test_analyze_scene_structured_defaults")

    async def fake_analyze_error(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {"error": "upstream down", "raw_text": "raw failure"}

    with patch.object(local_vlm, "analyze_image", side_effect=fake_analyze_error):
        failed = await local_vlm.analyze_scene_structured(
            _tiny_jpeg_b64(),
            "describe the scene",
            model="m",
            base_url="http://127.0.0.1:1",
            api_key="",
            timeout_seconds=1.0,
        )

    check("error path sets summary default", failed.get("summary") == "")
    check("error path sets risk_level unknown", failed.get("risk_level") == "unknown")
    check("error path sets empty objects/actions", failed.get("objects") == [] and failed.get("actions") == [])
    check("error path recommended_alert false", failed.get("recommended_alert") is False)
    check("error key preserved", failed.get("error") == "upstream down")

    async def fake_analyze_partial(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {
            "summary": "two people near dock",
            "risk_level": "HIGH",
            "objects": [{"name": "person", "description": "red jacket"}],
            "actions": ["standing"],
            "recommended_alert": "yes",
        }

    with patch.object(local_vlm, "analyze_image", side_effect=fake_analyze_partial):
        ok = await local_vlm.analyze_scene_structured(
            _tiny_jpeg_b64(),
            "describe",
            model="m",
            base_url="http://127.0.0.1:1",
            api_key="",
            timeout_seconds=1.0,
        )

    check("partial success keeps summary", ok.get("summary") == "two people near dock")
    check("risk_level normalized to lowercase", ok.get("risk_level") == "high")
    check("objects coerced to list", len(ok.get("objects") or []) == 1)
    check("recommended_alert coerced to bool", ok.get("recommended_alert") is True)


def main() -> int:
    print("Local VLM smoke")
    test_json_fence_parsing()
    asyncio.run(_run_retry_on_503())
    asyncio.run(_run_timeout_handling())
    asyncio.run(_run_scene_structured_defaults())
    print(f"\nRESULTS  passed={_passed}  failed={_failed}")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
