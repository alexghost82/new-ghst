"""Best-effort capture of OpenAI token usage → cost.

Called from the OpenAI client right after a completion. MUST NEVER raise or
meaningfully slow the model call: every failure is swallowed and logged. The
DB write is a single tiny indexed insert into local SQLite (WAL), consistent
with the synchronous-store pattern used throughout this codebase.
"""

from __future__ import annotations

import logging

from app.config import estimate_cost_usd
from app.storage.cost_store import insert_llm_usage
from app.storage.database import get_db

logger = logging.getLogger("ghost.cost")


def record_usage(
    *,
    model: str,
    action: str,
    prompt_tokens: int,
    completion_tokens: int,
    user_id: str | None = None,
    conversation_id: str | None = None,
) -> None:
    try:
        cost = estimate_cost_usd(model, prompt_tokens, completion_tokens)
        db = get_db()
        try:
            insert_llm_usage(
                db,
                model=model,
                action=action,
                prompt_tokens=int(prompt_tokens or 0),
                completion_tokens=int(completion_tokens or 0),
                cost_usd=cost,
                user_id=user_id,
                conversation_id=conversation_id,
            )
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - cost capture must never break a model call
        logger.debug("Cost capture failed (action=%s model=%s)", action, model, exc_info=True)


def record_from_usage_obj(
    usage,
    *,
    model: str,
    action: str,
    user_id: str | None = None,
    conversation_id: str | None = None,
) -> None:
    """Capture from an OpenAI ``response.usage`` object (or a stream's final
    chunk ``usage``). No-op if usage is absent."""
    if usage is None:
        return
    try:
        prompt = getattr(usage, "prompt_tokens", None)
        completion = getattr(usage, "completion_tokens", None)
        if prompt is None and completion is None:
            return
        record_usage(
            model=model,
            action=action,
            prompt_tokens=prompt or 0,
            completion_tokens=completion or 0,
            user_id=user_id,
            conversation_id=conversation_id,
        )
    except Exception:  # noqa: BLE001
        logger.debug("record_from_usage_obj failed", exc_info=True)
