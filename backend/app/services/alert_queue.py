"""Async rate-limited execution layer for alert vision scans.

Combines:

* A simple in-process **token bucket** that throttles overall throughput
  (default ~30 RPM) so we never get close to the upstream model's rate
  limit.
* A bounded **semaphore** that caps the number of concurrent in-flight
  vision calls — protecting CPU/memory and keeping per-request latency
  predictable.
* **Per-conversation deduplication** so a single conversation can never have
  more than one in-flight scan + one queued scan at the same time. Frontend
  already enforces backpressure per conversation, but this is a safety
  net for misbehaving clients.
* Bounded **exponential backoff with jitter** when the upstream call fails
  (rate-limit, transient network errors). The OpenAI Python SDK already
  retries on 429 internally; this layer ensures the *next* enqueued call
  does not fire immediately after a burst of failures.

The queue is a process-wide singleton. The first call to
``get_alert_queue()`` materialises it. Workers are started lazily on the
first ``enqueue()`` so there is no cost when the feature is unused.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("ghost.alert_queue")


class TokenBucket:
    """Simple async token bucket. ``capacity`` tokens accrue at ``rate`` per
    second. ``acquire(n)`` waits until ``n`` tokens are available."""

    def __init__(self, rate_per_sec: float, capacity: float):
        self._rate = rate_per_sec
        self._capacity = capacity
        self._tokens = capacity
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._updated
        self._updated = now
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)

    async def acquire(self, tokens: float = 1.0) -> None:
        while True:
            async with self._lock:
                self._refill()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    return
                deficit = tokens - self._tokens
                wait_for = deficit / self._rate if self._rate > 0 else 1.0
            await asyncio.sleep(max(wait_for, 0.05))


@dataclass
class _ScanJob:
    conversation_id: str
    runner: Callable[[], Awaitable[Any]]
    future: "asyncio.Future[Any]"
    enqueued_at: float = field(default_factory=time.monotonic)


class AlertQueue:
    """Singleton execution queue for alert scan jobs."""

    def __init__(
        self,
        max_rpm: int = 120,
        max_concurrent: int = 6,
        max_workers: int = 6,
        backoff_initial: float = 0.2,
        backoff_max: float = 3.0,
    ):
        rate = max(0.1, max_rpm / 60.0)
        self._bucket = TokenBucket(rate_per_sec=rate, capacity=max(1.0, rate * 2))
        self._max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._max_workers = max_workers
        self._backoff_initial = backoff_initial
        self._backoff_max = backoff_max

        self._queue: asyncio.Queue[_ScanJob] = asyncio.Queue()
        self._inflight: set[str] = set()
        self._inflight_lock = asyncio.Lock()
        self._workers: list[asyncio.Task[None]] = []
        self._started = False
        self._start_lock = asyncio.Lock()
        self._consecutive_failures = 0
        self._stopping = False

    async def _ensure_started(self) -> None:
        if self._started:
            return
        async with self._start_lock:
            if self._started:
                return
            self._stopping = False
            for i in range(self._max_workers):
                task = asyncio.create_task(
                    self._worker(i), name=f"alert-queue-worker-{i}"
                )
                self._workers.append(task)
            self._started = True
            logger.info(
                "AlertQueue started with %d workers", self._max_workers
            )

    async def stop(self) -> None:
        self._stopping = True
        for w in self._workers:
            w.cancel()
        for w in self._workers:
            try:
                await w
            except (asyncio.CancelledError, Exception):
                pass
        self._workers.clear()
        self._started = False

    async def enqueue(
        self,
        conversation_id: str,
        runner: Callable[[], Awaitable[Any]],
    ) -> Any:
        """Submit a scan job and await its result.

        Drops the request silently (returns ``None``) when this conversation
        already has a job in flight or queued — the frontend will retry on
        its next collage cycle.

        Fast path: when there are no consecutive failures and we have spare
        concurrency, runs the job directly under the semaphore instead of
        hopping through the queue + worker, shaving 50–200ms off scheduling
        latency.
        """

        async with self._inflight_lock:
            if conversation_id in self._inflight:
                logger.debug(
                    "Dropping duplicate alert scan for conversation %s",
                    conversation_id,
                )
                return None
            inflight_count = len(self._inflight)
            self._inflight.add(conversation_id)

        # Fast path: skip the worker queue when the system is healthy and
        # we still have headroom under the concurrency cap.
        can_fast_path = (
            self._consecutive_failures == 0
            and inflight_count < self._max_concurrent
        )
        if can_fast_path:
            try:
                await self._bucket.acquire(1.0)
                async with self._semaphore:
                    try:
                        result = await runner()
                        self._consecutive_failures = 0
                        return result
                    except Exception:
                        self._consecutive_failures = min(
                            self._consecutive_failures + 1, 6
                        )
                        logger.exception(
                            "AlertQueue fast-path job failed (conv=%s)",
                            conversation_id,
                        )
                        raise
            finally:
                async with self._inflight_lock:
                    self._inflight.discard(conversation_id)

        # Slow path: queue + worker hop (also handles backoff after failures).
        await self._ensure_started()
        loop = asyncio.get_running_loop()
        future: asyncio.Future[Any] = loop.create_future()
        job = _ScanJob(
            conversation_id=conversation_id, runner=runner, future=future
        )
        await self._queue.put(job)

        try:
            return await future
        finally:
            async with self._inflight_lock:
                self._inflight.discard(conversation_id)

    async def _worker(self, worker_id: int) -> None:
        while not self._stopping:
            try:
                job = await self._queue.get()
            except asyncio.CancelledError:
                return

            try:
                await self._bucket.acquire(1.0)
                async with self._semaphore:
                    if self._consecutive_failures > 0:
                        delay = min(
                            self._backoff_initial
                            * (2 ** (self._consecutive_failures - 1)),
                            self._backoff_max,
                        )
                        delay += random.uniform(0, delay * 0.2)
                        logger.warning(
                            "AlertQueue backing off for %.2fs after %d failure(s)",
                            delay,
                            self._consecutive_failures,
                        )
                        await asyncio.sleep(delay)

                    try:
                        result = await job.runner()
                        self._consecutive_failures = 0
                        if not job.future.done():
                            job.future.set_result(result)
                    except Exception as exc:
                        self._consecutive_failures = min(
                            self._consecutive_failures + 1, 6
                        )
                        logger.exception(
                            "AlertQueue job failed (worker=%d, conv=%s)",
                            worker_id,
                            job.conversation_id,
                        )
                        if not job.future.done():
                            job.future.set_exception(exc)
            except asyncio.CancelledError:
                if not job.future.done():
                    job.future.cancel()
                return
            finally:
                self._queue.task_done()

    def status(self) -> dict[str, Any]:
        return {
            "started": self._started,
            "queue_size": self._queue.qsize(),
            "inflight": sorted(self._inflight),
            "consecutive_failures": self._consecutive_failures,
            "max_workers": self._max_workers,
        }


_singleton: AlertQueue | None = None


def get_alert_queue() -> AlertQueue:
    global _singleton
    if _singleton is None:
        _singleton = AlertQueue()
    return _singleton
