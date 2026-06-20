"""In-process pub/sub broker for alert events.

A single shared :class:`AlertBroker` instance multiplexes alert event
notifications to any number of SSE listeners per ``user_id``. The broker is
push-only — if a listener is slow it drops messages rather than blocking
the publisher, since the canonical record of every event is already in
SQLite (``alert_events`` table).

Singleton accessor: :func:`get_alert_broker`.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger("ghost.alert_broker")

# Per-listener queue depth before we start dropping messages. 32 is comfortably
# more than any realistic burst given the queue's RPM cap (~120/min).
_LISTENER_QUEUE_MAX = 32


class AlertBroker:
    """Fan-out broker keyed by ``user_id``."""

    def __init__(self) -> None:
        self._listeners: dict[str, set[asyncio.Queue[dict[str, Any]]]] = (
            defaultdict(set)
        )
        self._lock = asyncio.Lock()

    async def register(self, user_id: str) -> asyncio.Queue[dict[str, Any]]:
        """Register a new listener queue for ``user_id``.

        The caller is responsible for awaiting items off the queue and
        calling :meth:`unregister` when done.
        """

        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(
            maxsize=_LISTENER_QUEUE_MAX
        )
        async with self._lock:
            self._listeners[user_id].add(queue)
        logger.debug(
            "AlertBroker registered listener for user=%s (now %d)",
            user_id,
            len(self._listeners[user_id]),
        )
        return queue

    async def unregister(
        self, user_id: str, queue: asyncio.Queue[dict[str, Any]]
    ) -> None:
        async with self._lock:
            bucket = self._listeners.get(user_id)
            if bucket is not None:
                bucket.discard(queue)
                if not bucket:
                    self._listeners.pop(user_id, None)
        logger.debug("AlertBroker unregistered listener for user=%s", user_id)

    def publish(self, user_id: str, payload: dict[str, Any]) -> None:
        """Push a payload to every listener registered for ``user_id``.

        Non-blocking: a full listener queue drops this payload (logged at
        WARNING) — the event is still persisted in SQLite, so the next
        ``GET /alerts/events`` call from the frontend will pick it up.
        """

        bucket = self._listeners.get(user_id)
        if not bucket:
            return
        delivered = 0
        for queue in list(bucket):
            try:
                queue.put_nowait(payload)
                delivered += 1
            except asyncio.QueueFull:
                logger.warning(
                    "AlertBroker dropped event for user=%s (listener queue full)",
                    user_id,
                )
        logger.debug(
            "AlertBroker delivered event to %d listener(s) for user=%s",
            delivered,
            user_id,
        )

    def listener_count(self, user_id: str | None = None) -> int:
        if user_id is None:
            return sum(len(v) for v in self._listeners.values())
        return len(self._listeners.get(user_id, set()))


_singleton: AlertBroker | None = None


def get_alert_broker() -> AlertBroker:
    global _singleton
    if _singleton is None:
        _singleton = AlertBroker()
    return _singleton
