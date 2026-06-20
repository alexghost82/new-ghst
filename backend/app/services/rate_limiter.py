"""In-process token-bucket rate limiting.

Scoped to the single-instance deployment posture (one Cloud Run worker): the
buckets live in this process's memory. If the backend is ever scaled to
multiple instances this must be backed by Redis so limits are shared — see the
single-instance limitations note in the deploy journal.

Usage::

    from app.services.rate_limiter import rate_limit

    @router.post("/expensive", dependencies=[Depends(rate_limit("expensive", 30, 60))])
    async def handler(...): ...

Keys are derived from the client IP (first ``X-Forwarded-For`` hop behind the
Firebase/Cloud Run proxy, falling back to the socket peer).
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

from fastapi import Request

from app.schemas.responses import error_response


@dataclass
class _Bucket:
    tokens: float
    last: float = field(default_factory=time.monotonic)


# (limiter-name, ip) -> bucket
_buckets: dict[tuple[str, str], _Bucket] = {}
_lock = threading.Lock()
# Hard cap on the number of tracked buckets so a flood of unique IPs cannot
# grow the table without bound; stale entries are evicted opportunistically.
_MAX_BUCKETS = 50_000
_STALE_SECONDS = 3600.0


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _evict_stale(now: float) -> None:
    if len(_buckets) < _MAX_BUCKETS:
        return
    stale = [k for k, b in _buckets.items() if now - b.last > _STALE_SECONDS]
    for k in stale:
        _buckets.pop(k, None)
    # If still over the cap (pathological), clear the whole table — a coarse
    # but safe fallback that re-grants everyone a fresh allowance.
    if len(_buckets) >= _MAX_BUCKETS:
        _buckets.clear()


def _allow(name: str, ip: str, capacity: int, per_seconds: float) -> bool:
    refill_rate = capacity / per_seconds
    now = time.monotonic()
    with _lock:
        _evict_stale(now)
        key = (name, ip)
        bucket = _buckets.get(key)
        if bucket is None:
            # Anchor ``last`` to the captured ``now`` so the first request sees
            # elapsed==0 (never a tiny negative delta, which would shave the
            # bucket below capacity and wrongly reject the very first call).
            bucket = _Bucket(tokens=float(capacity), last=now)
            _buckets[key] = bucket
        # Refill proportionally to elapsed time, capped at capacity.
        elapsed = now - bucket.last
        bucket.tokens = min(capacity, bucket.tokens + elapsed * refill_rate)
        bucket.last = now
        if bucket.tokens < 1.0:
            return False
        bucket.tokens -= 1.0
        return True


def rate_limit(name: str, capacity: int, per_seconds: float):
    """Build a FastAPI dependency enforcing ``capacity`` requests per
    ``per_seconds`` window per client IP for the named bucket."""

    async def _dep(request: Request) -> None:
        ip = _client_ip(request)
        if not _allow(name, ip, capacity, per_seconds):
            error_response(
                "RATE_LIMITED",
                "Too many requests — slow down and try again shortly.",
                429,
            )

    return _dep
