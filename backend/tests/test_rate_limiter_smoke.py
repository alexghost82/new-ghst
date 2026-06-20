"""Smoke test for the in-process token-bucket rate limiter.

Pure-function test (no app/server). Run with ``python tests/test_rate_limiter_smoke.py``.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services import rate_limiter  # noqa: E402

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


def main() -> int:
    # capacity 3 per 60s for a fixed ip.
    allowed = [rate_limiter._allow("t", "1.2.3.4", 3, 60) for _ in range(3)]
    check("first 3 within capacity are allowed", all(allowed))
    check("4th over capacity is blocked", rate_limiter._allow("t", "1.2.3.4", 3, 60) is False)

    # A different IP has its own independent bucket.
    check("different ip is allowed", rate_limiter._allow("t", "9.9.9.9", 3, 60) is True)

    # Refill: a fast bucket (capacity 1 / 0.05s) refills after a short wait.
    check("fast bucket first token", rate_limiter._allow("fast", "5.5.5.5", 1, 0.05) is True)
    check("fast bucket immediately blocked", rate_limiter._allow("fast", "5.5.5.5", 1, 0.05) is False)
    time.sleep(0.08)
    check("fast bucket refills after wait", rate_limiter._allow("fast", "5.5.5.5", 1, 0.05) is True)

    print(f"\nRESULTS  passed={PASSED}  failed={FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
