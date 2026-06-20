"""Smoke test for the streaming text refusal/tech-leak guard.

Locks the P0 guarantee that ``_stream_text_guarded`` NEVER emits refusal text to
the client — including the tricky case where a refusal appears AFTER a clean
prefix was already flushed (``sent > 0``). The matching phrase always lands
inside the still-unsent safe tail, so it is dropped, never streamed.

Pure unit test: ``stream_chat_completion`` is monkeypatched with a canned token
generator (no network / no API key). Run with
``python tests/test_refusal_guard_smoke.py``.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services import chat_service  # noqa: E402

PASSED = 0
FAILED = 0


def check(label: str, cond: bool) -> None:
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  [PASS] {label}")
    else:
        FAILED += 1
        print(f"  [FAIL] {label}")


def _install_fake_stream(tokens: list[str]) -> None:
    """Replace the module-level ``stream_chat_completion`` with a canned async
    generator yielding ``tokens`` one at a time."""

    async def fake_stream(messages, api_key, model=None, max_tokens=4096):
        for tok in tokens:
            yield tok

    chat_service.stream_chat_completion = fake_stream  # type: ignore[assignment]


async def _collect(tokens: list[str]) -> str:
    _install_fake_stream(tokens)
    out: list[str] = []
    async for chunk in chat_service._stream_text_guarded([], "key", "en"):
        out.append(chunk)
    return "".join(out)


def _chunk(text: str, size: int = 7) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size)]


async def run() -> None:
    replacement = chat_service._GHOST_REFUSAL_REPLACEMENT

    # 1) Pure refusal from the very first tokens → branded replacement only.
    refusal = "I'm sorry, but I can't assist with that request."
    out1 = await _collect(_chunk(refusal))
    check("pure refusal replaced with Ghost message", out1 == replacement)
    check("pure refusal output has no 'sorry'", "sorry" not in out1.lower())

    # 2) Clean prefix (well past the 240-char tail) THEN a refusal phrase.
    prefix = "Here is a detailed read of the scene at gate three. " * 8  # ~416 chars
    late_refusal = prefix + "I'm sorry, but I cannot assist with that."
    out2 = await _collect(_chunk(late_refusal))
    check(
        "late refusal: 'sorry' never streamed",
        "sorry" not in out2.lower(),
    )
    check(
        "late refusal: 'cannot assist' never streamed",
        "cannot assist" not in out2.lower(),
    )
    check(
        "late refusal: clean prefix content was delivered",
        "detailed read of the scene" in out2,
    )

    # 3) A clean reply streams through unchanged.
    clean = "Two people near the loading dock, one holding a clipboard."
    out3 = await _collect(_chunk(clean))
    check("clean reply delivered verbatim", out3 == clean)

    # 4) Hebrew refusal is intercepted too.
    he_refusal = "אני לא יכול לעזור עם זה."
    out4 = await _collect(_chunk(he_refusal))
    check("hebrew refusal replaced with Ghost message", out4 == replacement)


def main() -> int:
    asyncio.run(run())
    print(f"\nRESULTS  passed={PASSED}  failed={FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
