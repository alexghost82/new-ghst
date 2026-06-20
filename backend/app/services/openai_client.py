from __future__ import annotations

import hashlib
import json
import logging
from collections import OrderedDict
from collections.abc import AsyncGenerator

from openai import APITimeoutError, AsyncOpenAI

from app.config import settings
from app.services.vision_schema import VISION_ANALYSIS_SCHEMA

logger = logging.getLogger("ghost.openai")


# Reuse one ``AsyncOpenAI`` instance per API key. Constructing a fresh
# client on every call adds connection-setup overhead that is wasteful on
# the latency-critical alert path (scans fire every few hundred ms).
#
# Bounded LRU: every distinct trial visitor key would otherwise accumulate a
# client forever (unbounded memory + raw keys living in RAM). We cap the cache
# and key it by a hash of the API key so the plaintext key is never used as a
# dict key.
_CLIENT_CACHE_MAX = 256
_client_cache: "OrderedDict[str, AsyncOpenAI]" = OrderedDict()


def _get_client(api_key: str) -> AsyncOpenAI:
    cache_key = hashlib.sha256(api_key.encode()).hexdigest()
    client = _client_cache.get(cache_key)
    if client is not None:
        _client_cache.move_to_end(cache_key)
        return client
    client = AsyncOpenAI(api_key=api_key)
    _client_cache[cache_key] = client
    _client_cache.move_to_end(cache_key)
    while len(_client_cache) > _CLIENT_CACHE_MAX:
        _client_cache.popitem(last=False)
    return client


def _vision_model() -> str:
    """Return the configured vision model (``settings.vision_model``).

    Wrapped in a function so live env-var overrides via ``Settings`` are
    honoured without restarting the process.
    """
    return settings.vision_model


def _vision_detail() -> str:
    """Return the configured ``image_url.detail`` value.

    Centralised so every vision call uses the same level (``"high"`` by
    default) and the user can flip the whole product to ``"low"`` from
    ``GHOST_VISION_IMAGE_DETAIL`` without touching call sites.
    """
    detail = settings.vision_image_detail or "high"
    return detail if detail in ("low", "high", "auto") else "high"


# Reasoning-style models (gpt-5, o-series) only accept ``temperature=1``
# and reject the legacy ``max_tokens`` parameter. Detecting them here
# lets every API call uniformly omit ``temperature`` when it is not
# supported, instead of getting a 400 from the API.
_REASONING_MODEL_PREFIXES = ("gpt-5", "o1", "o3", "o4")

# Reasoning models spend ``max_completion_tokens`` on INTERNAL reasoning
# tokens BEFORE emitting any visible text. The intent/length caps the rest of
# the codebase computes (e.g. 200/350 for short questions) size the *visible*
# reply only — if that whole budget is handed to a reasoning model it is
# consumed during the reasoning phase and the call returns
# ``finish_reason="length"`` with EMPTY content (HTTP 200, no text). To keep
# the visible caps meaningful we (a) add a fixed reasoning budget on top of the
# requested cap and (b) pin ``reasoning_effort`` low so the reasoning phase
# stays bounded and latency stays predictable.
_REASONING_HEADROOM_TOKENS = 4000
_REASONING_EFFORT = "low"


def _is_reasoning_model(model: str) -> bool:
    """Return ``True`` for reasoning-style models (gpt-5 / o-series)."""
    return model.lower().startswith(_REASONING_MODEL_PREFIXES)


def _supports_temperature(model: str) -> bool:
    """Return ``True`` when the model accepts a custom ``temperature``.

    GPT-5 / o-series models error out on any value other than 1 (their
    default). Callers should drop the parameter entirely for those
    models rather than try to pass ``1`` explicitly — both behaviours
    work, but omitting the kwarg is cleaner and matches OpenAI's
    examples.
    """
    return not _is_reasoning_model(model)


def _completion_kwargs(
    *,
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float | None = None,
    response_format: dict | None = None,
    stream: bool = False,
) -> dict:
    """Build the kwargs dict for ``client.chat.completions.create()``
    while respecting per-model parameter constraints.

    - ``max_completion_tokens`` is used unconditionally (gpt-5 requires
      it; gpt-4o family also accepts it).
    - ``temperature`` is dropped silently for reasoning models.
    - Empty optional fields are omitted so we never send ``None``.
    """
    effective_max_tokens = max_tokens
    kwargs: dict = {
        "model": model,
        "messages": messages,
    }
    if _is_reasoning_model(model):
        # Preserve the caller's *visible* cap as headroom on top of a fixed
        # reasoning budget so the model can always reason AND still write a
        # reply. Without this a small visible cap (e.g. 200) is fully eaten by
        # reasoning and the reply comes back empty.
        effective_max_tokens = max_tokens + _REASONING_HEADROOM_TOKENS
        kwargs["reasoning_effort"] = _REASONING_EFFORT
    kwargs["max_completion_tokens"] = effective_max_tokens
    if temperature is not None and _supports_temperature(model):
        kwargs["temperature"] = temperature
    if response_format is not None:
        kwargs["response_format"] = response_format
    if stream:
        kwargs["stream"] = True
        # Ask the API to append a final usage chunk so streamed calls can be
        # cost-accounted. The streaming consumers already tolerate a trailing
        # chunk with no choices, so this is transparent to them.
        kwargs["stream_options"] = {"include_usage": True}
    return kwargs

MEMORY_EXTRACTION_PROMPT = """\
You are an information extraction engine. Analyze the following conversation turn and extract any \
important facts, user preferences, instructions, or named entities that are worth remembering for \
future conversations.

Return a JSON array of objects. Each object must have:
- "type": one of "fact", "preference", "instruction", "entity"
- "content": a concise statement of what was learned

If nothing notable was said, return an empty array: []

User message:
{user_message}

Assistant response:
{assistant_message}
"""


async def stream_chat_completion(
    messages: list[dict],
    api_key: str,
    model: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    # ``model`` defaults to the configured vision model — chat may or
    # may not carry an image, but using the flagship vision-capable
    # model keeps the call site simple and never under-powered.
    chosen_model = model or _vision_model()
    client = _get_client(api_key)
    stream = await client.chat.completions.create(
        **_completion_kwargs(
            model=chosen_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content
        # The final include_usage chunk carries token counts and no choices.
        usage = getattr(chunk, "usage", None)
        if usage is not None:
            from app.services.cost_service import record_from_usage_obj

            record_from_usage_obj(usage, model=chosen_model, action="chat")


ALERT_DETECTION_SCHEMA = {
    "name": "alert_detection",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["detected", "matches"],
        "properties": {
            "detected": {"type": "boolean"},
            "matches": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["rule_index", "description", "confidence"],
                    "properties": {
                        "rule_index": {"type": "integer"},
                        "description": {"type": "string"},
                        "confidence": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                        },
                    },
                },
            },
        },
    },
}


async def alert_vision_scan(
    messages: list[dict],
    api_key: str,
    model: str | None = None,
    temperature: float = 0.0,
    max_tokens: int | None = None,
) -> dict:
    """Run a non-streaming vision call optimised for alert detection.

    The image detail level is controlled by the caller when building the
    message payload (see :func:`alert_service._build_messages`); a strict
    JSON schema keeps the response always parseable. Falls back to an
    empty no-match result if the model returns malformed JSON.

    ``model`` defaults to ``settings.alert_vision_model`` (a small/fast
    vision model — see :class:`Settings`) so binary rule checks don't
    inherit the chat vision model's latency. Callers can still override
    explicitly for forensic-grade rules.
    """

    import time as _time

    chosen_model = model or settings.alert_vision_model or _vision_model()
    chosen_max_tokens = (
        max_tokens if max_tokens is not None else settings.alert_vision_max_tokens
    )
    timeout_s = settings.alert_vision_timeout_seconds
    client = _get_client(api_key).with_options(timeout=timeout_s)
    started = _time.monotonic()
    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=chosen_model,
                messages=messages,
                temperature=temperature,
                max_tokens=chosen_max_tokens,
                response_format={
                    "type": "json_schema",
                    "json_schema": ALERT_DETECTION_SCHEMA,
                },
            )
        )
    except APITimeoutError:
        # Fail fast: a hung/slow call must not eat the latency budget. The
        # frontend will re-scan on its next loop iteration immediately.
        logger.warning(
            "alert_vision_scan model=%s timed out after %.2fs (elapsed_ms=%d) — "
            "returning no-match",
            chosen_model,
            timeout_s,
            int((_time.monotonic() - started) * 1000),
        )
        return {"detected": False, "matches": []}
    elapsed_ms = int((_time.monotonic() - started) * 1000)
    logger.info(
        "alert_vision_scan model=%s detail-via-caller elapsed_ms=%d",
        chosen_model,
        elapsed_ms,
    )
    from app.services.cost_service import record_from_usage_obj

    record_from_usage_obj(getattr(response, "usage", None), model=chosen_model, action="alert")
    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception("Alert vision scan returned invalid JSON: %r", raw[:300])
        return {"detected": False, "matches": []}

    if not isinstance(parsed, dict):
        return {"detected": False, "matches": []}

    parsed.setdefault("detected", False)
    parsed.setdefault("matches", [])
    if not isinstance(parsed["matches"], list):
        parsed["matches"] = []
    return parsed


TASK_TRIGGER_SCHEMA = {
    "name": "task_trigger_detection",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["matches"],
        "properties": {
            "matches": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "trigger_index",
                        "confidence",
                        "event_summary",
                    ],
                    "properties": {
                        "trigger_index": {"type": "integer"},
                        "confidence": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                        },
                        "event_summary": {"type": "string"},
                    },
                },
            },
        },
    },
}

_TASK_TRIGGER_TIMEOUT_SECONDS = 8.0
_TASK_TRIGGER_MAX_TOKENS = 400


async def task_trigger_scan(
    reply_text: str,
    triggers: list[dict],
    api_key: str,
    locale: str = "he",
    model: str | None = None,
) -> dict:
    """Semantically match Ghost's reply against task trigger phrases.

    Text-only, non-streaming, strict JSON schema, hard timeout — a hung or
    failed scan returns an empty no-match result and never raises into the
    chat pipeline. A trigger counts as matched even when the reply phrases
    the situation differently (semantic match), but only ``high``
    confidence is acted on by the caller.
    """

    import time as _time

    trigger_lines = []
    for idx, trig in enumerate(triggers, start=1):
        phrase = (trig.get("phrase") or "").strip()
        if phrase:
            trigger_lines.append(f"{idx}. {phrase}")
    if not trigger_lines or not (reply_text or "").strip():
        return {"matches": []}

    summary_lang = "Hebrew" if locale == "he" else "English"
    prompt = (
        "You are a security-report trigger classifier. Below is an AI "
        "monitoring reply describing what a security system observed, "
        "followed by a numbered list of trigger conditions (words, events "
        "or situations).\n\n"
        "Decide which trigger conditions are SATISFIED by the reply. A "
        "trigger matches when the reply describes the same word, event or "
        "situation — even if it is phrased completely differently "
        "(semantic match, any language).\n\n"
        "Rules:\n"
        "- Only report a match when you are confident the condition is "
        "genuinely described in the reply; if unsure, use confidence "
        "'medium' or 'low'.\n"
        "- For every match return the 1-based trigger_index, confidence, "
        f"and a brief factual event_summary in {summary_lang} of what the "
        "reply reported that satisfied the trigger.\n"
        "- No matches -> return an empty matches array. Never refuse.\n\n"
        f"=== MONITORING REPLY ===\n{reply_text.strip()[:6000]}\n\n"
        f"=== TRIGGER CONDITIONS ===\n" + "\n".join(trigger_lines)
    )

    chosen_model = model or settings.alert_vision_model or _vision_model()
    client = _get_client(api_key).with_options(
        timeout=_TASK_TRIGGER_TIMEOUT_SECONDS
    )
    started = _time.monotonic()
    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=_TASK_TRIGGER_MAX_TOKENS,
                response_format={
                    "type": "json_schema",
                    "json_schema": TASK_TRIGGER_SCHEMA,
                },
            )
        )
    except APITimeoutError:
        logger.warning(
            "task_trigger_scan model=%s timed out after %.2fs — returning "
            "no-match",
            chosen_model,
            _TASK_TRIGGER_TIMEOUT_SECONDS,
        )
        return {"matches": []}
    except Exception:
        logger.exception("task_trigger_scan failed (model=%s)", chosen_model)
        return {"matches": []}

    logger.info(
        "task_trigger_scan model=%s elapsed_ms=%d",
        chosen_model,
        int((_time.monotonic() - started) * 1000),
    )
    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception(
            "task_trigger_scan returned invalid JSON: %r", raw[:300]
        )
        return {"matches": []}
    if not isinstance(parsed, dict) or not isinstance(
        parsed.get("matches"), list
    ):
        return {"matches": []}
    return parsed


# ---------------------------------------------------------------------------
# Conversational automation builder — free-language -> structured alert/task
# ---------------------------------------------------------------------------

ALERT_DRAFT_SCHEMA = {
    "name": "automation_alert_draft",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["description"],
        "properties": {
            # The standing-alert condition, fed straight into
            # alert_rules.description. A faithful, self-contained description
            # of the situation / object / event to watch for, in the
            # operator's language.
            "description": {"type": "string"},
        },
    },
}

TASK_DRAFT_SCHEMA = {
    "name": "automation_task_draft",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "name",
            "prompt_text",
            "schedule_type",
            "run_at",
            "interval_seconds",
            "daily_time",
            "include_camera",
            "is_check",
            "report_phrase",
        ],
        "properties": {
            "name": {"type": "string"},
            "prompt_text": {"type": "string"},
            "schedule_type": {
                "type": "string",
                "enum": ["once", "interval", "daily"],
            },
            # 'once': ISO 8601 with Asia/Jerusalem offset; else null.
            "run_at": {"type": ["string", "null"]},
            # 'interval': seconds between runs (>= 45); else null.
            "interval_seconds": {"type": ["integer", "null"]},
            # 'daily': "HH:MM" wall-clock in Asia/Jerusalem; else null.
            "daily_time": {"type": ["string", "null"]},
            "include_camera": {"type": "boolean"},
            # True when the task is a conditional check ("בדוק אם …") that
            # should report back when the condition is satisfied.
            "is_check": {"type": "boolean"},
            # When is_check: the condition phrase to report on (operator's
            # language); else null.
            "report_phrase": {"type": ["string", "null"]},
        },
    },
}

_AUTOMATION_PARSE_TIMEOUT_SECONDS = 45.0
_AUTOMATION_PARSE_MAX_TOKENS = 700


async def parse_automation_intent(
    *,
    kind: str,
    text: str,
    client_now: str | None = None,
    locale: str = "he",
    api_key: str,
    model: str | None = None,
) -> dict:
    """Extract structured alert/task fields from a free-language request.

    Uses the strongest configured model (``settings.vision_model`` == gpt-5
    by default) with a strict JSON schema so every required field is filled.
    ``client_now`` (the operator's local time) anchors relative schedule
    phrases ("מחר ב-16:00", "כל יום ב-11:00") against Asia/Jerusalem.

    Raises ``RuntimeError`` on timeout / failure so the caller can surface a
    clean error — there is no useful draft without a successful parse.
    """
    from datetime import datetime as _dt
    from zoneinfo import ZoneInfo as _ZoneInfo
    import time as _time

    israel_tz = _ZoneInfo("Asia/Jerusalem")
    ref: _dt | None = None
    if client_now:
        try:
            ref = _dt.fromisoformat(client_now.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            ref = None
    if ref is None:
        ref = _dt.now(israel_tz)
    elif ref.tzinfo is None:
        ref = ref.replace(tzinfo=israel_tz)
    israel_now = ref.astimezone(israel_tz)
    now_str = israel_now.strftime("%Y-%m-%dT%H:%M:%S")
    weekday = israel_now.strftime("%A")
    out_lang = "Hebrew" if locale == "he" else "English"

    clean_text = (text or "").strip()[:2000]
    if not clean_text:
        raise RuntimeError("AUTOMATION_PARSE_EMPTY")

    if kind == "alert":
        schema = ALERT_DRAFT_SCHEMA
        task_rules = (
            "Extract ONE standing-alert condition from the operator's "
            "request: a faithful, self-contained description of the "
            "situation, object, behaviour or event that should trigger an "
            "alert when a camera sees it. Keep the operator's intent and "
            f"language ({out_lang}). Do not add conditions they did not ask "
            "for. Return it in 'description'."
        )
    else:
        schema = TASK_DRAFT_SCHEMA
        task_rules = (
            "Extract a SCHEDULED TASK from the operator's request:\n"
            "- name: a short title for the task (a few words, "
            f"{out_lang}).\n"
            "- prompt_text: the exact question or instruction Ghost should "
            "run on schedule against the camera/scene "
            f"({out_lang}); keep the operator's intent.\n"
            "- schedule_type: 'once' for a single future moment, 'daily' for "
            "a fixed time every day, 'interval' for a fixed repeating gap.\n"
            "- run_at: for 'once' ONLY, the absolute moment as ISO 8601 with "
            "the Asia/Jerusalem timezone offset (e.g. "
            "'2026-06-17T16:00:00+03:00'); otherwise null. Resolve relative "
            f"wording ('מחר', 'tomorrow', 'בעוד שעה') against NOW below.\n"
            "- interval_seconds: for 'interval' ONLY, seconds between runs "
            "(minimum 45); otherwise null.\n"
            "- daily_time: for 'daily' ONLY, 'HH:MM' 24h Asia/Jerusalem wall "
            "clock; otherwise null.\n"
            "- include_camera: true unless the request clearly needs no "
            "camera frame.\n"
            "- is_check: true when the request is a conditional check (asks "
            "to verify whether something is the case), false for a plain "
            "recurring prompt.\n"
            "- report_phrase: when is_check is true, a concise phrase "
            f"naming the condition to report on ({out_lang}); otherwise null."
        )

    prompt = (
        "You are Ghost's automation builder. Convert the operator's "
        "free-language request into structured fields for the JSON schema. "
        "Never refuse; always produce the best structured interpretation.\n\n"
        f"NOW (Asia/Jerusalem): {now_str} ({weekday}).\n\n"
        f"{task_rules}\n\n"
        f"=== OPERATOR REQUEST ===\n{clean_text}"
    )

    chosen_model = model or _vision_model()
    client = _get_client(api_key).with_options(
        timeout=_AUTOMATION_PARSE_TIMEOUT_SECONDS
    )
    started = _time.monotonic()
    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=_AUTOMATION_PARSE_MAX_TOKENS,
                response_format={
                    "type": "json_schema",
                    "json_schema": schema,
                },
            )
        )
    except APITimeoutError as exc:
        logger.warning(
            "parse_automation_intent model=%s timed out after %.1fs",
            chosen_model,
            _AUTOMATION_PARSE_TIMEOUT_SECONDS,
        )
        raise RuntimeError("AUTOMATION_PARSE_TIMEOUT") from exc
    except Exception as exc:
        logger.exception(
            "parse_automation_intent failed (model=%s)", chosen_model
        )
        raise RuntimeError("AUTOMATION_PARSE_FAILED") from exc

    logger.info(
        "parse_automation_intent kind=%s model=%s elapsed_ms=%d",
        kind,
        chosen_model,
        int((_time.monotonic() - started) * 1000),
    )
    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.exception(
            "parse_automation_intent returned invalid JSON: %r", raw[:300]
        )
        raise RuntimeError("AUTOMATION_PARSE_INVALID") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("AUTOMATION_PARSE_INVALID")
    return parsed


async def generate_expert_recommendations(
    messages: list[dict],
    api_key: str,
    model: str | None = None,
    max_tokens: int = 4096,
) -> dict:
    """Run the Ghost Expert structured generation pass (8 tasks + 8 alerts).

    Returns a parsed JSON object ``{summary, tasks, alerts}``; raises on a hard
    failure so the route can surface a clean error. Uses ``json_object`` mode
    (the schema is enforced in the prompt + normalised by the caller)."""
    chosen_model = model or _vision_model()
    client = _get_client(api_key)
    response = await client.chat.completions.create(
        **_completion_kwargs(
            model=chosen_model,
            messages=messages,
            temperature=0.5,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
    )
    from app.services.cost_service import record_from_usage_obj

    record_from_usage_obj(getattr(response, "usage", None), model=chosen_model, action="expert")
    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.exception("Expert generation returned invalid JSON: %r", raw[:500])
        raise RuntimeError("EXPERT_GENERATE_INVALID") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("EXPERT_GENERATE_INVALID")
    return parsed


async def structured_vision_analysis(
    messages: list[dict],
    api_key: str,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
) -> dict:
    """Run a non-streaming chat completion with a strict JSON schema response
    format. Used as a fallback when the free-form streaming response refuses
    to describe a frame. The strict schema forces the model to fill every
    required field.
    """

    chosen_model = model or _vision_model()
    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        **_completion_kwargs(
            model=chosen_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={
                "type": "json_schema",
                "json_schema": VISION_ANALYSIS_SCHEMA,
            },
        )
    )
    from app.services.cost_service import record_from_usage_obj

    record_from_usage_obj(getattr(response, "usage", None), model=chosen_model, action="vision")
    raw = response.choices[0].message.content or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.exception("Structured vision analysis returned invalid JSON: %r", raw[:500])
        return {}


async def get_embedding(text: str, api_key: str) -> list[float]:
    client = _get_client(api_key)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    from app.services.cost_service import record_from_usage_obj

    record_from_usage_obj(
        getattr(response, "usage", None), model="text-embedding-3-small", action="embedding"
    )
    return response.data[0].embedding


async def get_embeddings(texts: list[str], api_key: str) -> list[list[float]]:
    if not texts:
        return []
    client = _get_client(api_key)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    from app.services.cost_service import record_from_usage_obj

    record_from_usage_obj(
        getattr(response, "usage", None), model="text-embedding-3-small", action="embedding"
    )
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


VISUAL_OBSERVATION_SCHEMA = {
    "name": "visual_observations",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["observations"],
        "properties": {
            "observations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "entity_type",
                        "description",
                        "visual_attributes",
                        "position_in_frame",
                        "direction",
                        "activity",
                        "confidence",
                        "semantic_tags",
                    ],
                    "properties": {
                        "entity_type": {
                            "type": "string",
                            "enum": ["person", "vehicle", "environment", "object"],
                        },
                        "description": {"type": "string"},
                        "visual_attributes": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "clothing",
                                "colors",
                                "vehicle_type",
                                "vehicle_color",
                                "facial_hair",
                                "objects_held",
                                "environmental_details",
                            ],
                            "properties": {
                                "clothing": {"type": "string"},
                                "colors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "vehicle_type": {"type": "string"},
                                "vehicle_color": {"type": "string"},
                                "facial_hair": {"type": "string"},
                                "objects_held": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "environmental_details": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                        },
                        "position_in_frame": {"type": "string"},
                        "direction": {"type": "string"},
                        "activity": {"type": "string"},
                        "confidence": {"type": "number"},
                        "semantic_tags": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                },
            }
        },
    },
}


VISUAL_EXTRACTION_PROMPT = """\
You are a visual-memory extraction engine for a security monitoring system.
Read the assistant's scene description below and extract every concrete
entity that was reported in the frame(s): each person, each vehicle, each
notable environmental detail. One row per distinct entity.

Use the camera label (if provided) as the source of truth for "where" the
entity was seen. Camera label is NOT an entity itself.

Rules:
- Be conservative: only extract entities the assistant actually described.
- If the assistant said "no people" or "none visible" for a category, do NOT
  emit anything for that category.
- "environment" entities = persistent scene conditions worth remembering
  (open gate, smoke, trash pile, broken light, suspicious object on the floor).
- Leave any string field empty ("") if the assistant did not mention it.
- Leave array fields as [] if not mentioned.
- "confidence" is your confidence in the extraction (0.0 - 1.0), not the
  assistant's confidence.

Camera label: {camera_label}

Assistant response:
{assistant_message}
"""


async def extract_visual_observations(
    assistant_message: str,
    camera_label: str | None,
    api_key: str,
    model: str = "gpt-4o-mini",
) -> list[dict]:
    """Extract a list of structured visual entity observations from an
    assistant message that described a camera frame. Always returns a list
    (possibly empty). Never raises."""

    if not assistant_message or not assistant_message.strip():
        return []

    client = AsyncOpenAI(api_key=api_key)
    prompt = VISUAL_EXTRACTION_PROMPT.format(
        camera_label=camera_label or "(unspecified)",
        assistant_message=assistant_message.strip(),
    )

    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=1500,
                response_format={
                    "type": "json_schema",
                    "json_schema": VISUAL_OBSERVATION_SCHEMA,
                },
            )
        )
    except Exception:
        logger.exception("Visual extraction request failed")
        return []

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception(
            "Visual extraction returned invalid JSON: %r", raw[:500]
        )
        return []

    obs = parsed.get("observations") if isinstance(parsed, dict) else None
    if not isinstance(obs, list):
        return []

    result = []
    for item in obs:
        if not isinstance(item, dict):
            continue
        entity_type = item.get("entity_type")
        description = item.get("description")
        if entity_type not in ("person", "vehicle", "environment", "object"):
            continue
        if not description or not str(description).strip():
            continue
        result.append(
            {
                "entity_type": entity_type,
                "description": str(description).strip(),
                "visual_attributes": item.get("visual_attributes") or {},
                "position_in_frame": str(item.get("position_in_frame") or ""),
                "direction": str(item.get("direction") or ""),
                "activity": str(item.get("activity") or ""),
                "confidence": float(item.get("confidence") or 0.7),
                "semantic_tags": item.get("semantic_tags") or [],
            }
        )
    return result


SEVERITY_SCORE_SCHEMA = {
    "name": "severity_score",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["severity", "reasoning", "tags"],
        "properties": {
            "severity": {
                "type": "string",
                "enum": ["low", "medium", "high", "critical"],
            },
            "reasoning": {"type": "string"},
            "tags": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
    },
}


SEVERITY_SCORE_PROMPT = """\
You are a security incident triage classifier for a camera-monitoring \
system. Given the matched alert rule, the AI's description of the frame, \
and contextual metadata, score the incident's operational severity.

Severity definitions:
- critical: imminent threat to life or property (weapon, fire, violent \
  intrusion, person down).
- high: clear policy violation that needs immediate operator response \
  (intruder in restricted zone, suspicious vehicle parked at gate, \
  smoke / sparks / breaking glass).
- medium: notable activity worth handling soon but not immediate danger \
  (loitering, after-hours movement, unrecognised vehicle on perimeter, \
  package delivery outside hours).
- low: routine / ambiguous (small animal, leaves moving, vehicle passing \
  on public road, expected employee activity).

Always return 2-5 short lowercase tags drawn from concepts like: \
intrusion, perimeter, fire, smoke, weapon, vehicle, person, loitering, \
delivery, fall, crowd, vandalism, after_hours, daylight, safety.

The "reasoning" string should be ONE sentence in {language_name} that \
explains why this severity was chosen. Do not refuse and do not include \
disclaimers.

Matched rule: {matched_rule}
AI frame description: {ai_description}
Source camera: {camera_label}
Local time of day: {time_of_day}
Confidence (alert engine): {confidence}
"""


# Lightweight English/Hebrew refusal sniffer used to invalidate AI severity
# results. We only need to detect the most common refusal openers — anything
# slipping through gets replaced by safe defaults in ``incident_service``.
_AI_REFUSAL_HINTS = (
    "i'm sorry",
    "i am sorry",
    "i cannot",
    "i can't",
    "as an ai",
    "i'm unable",
    "i am unable",
    "אני מצטער",
    "אני לא יכול",
    "כמודל שפה",
)


def looks_like_refusal_text(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.strip().lower()
    return any(hint in lowered for hint in _AI_REFUSAL_HINTS)


async def score_incident_severity(
    *,
    matched_rule: str,
    ai_description: str,
    camera_label: str | None,
    time_of_day: str,
    confidence: str | None,
    locale: str = "he",
    api_key: str,
    model: str = "gpt-4o-mini",
) -> dict:
    """Classify an incident into one of four severity buckets via gpt-4o-mini.

    Returns a dict ``{severity, reasoning, tags}``. Never raises — on
    failure, returns the safe default (medium / empty reasoning / no tags),
    leaving the caller to log and continue.
    """

    language_name = "Hebrew" if locale == "he" else "English"
    prompt = SEVERITY_SCORE_PROMPT.format(
        matched_rule=matched_rule or "(unspecified)",
        ai_description=ai_description or "(none)",
        camera_label=camera_label or "(unspecified)",
        time_of_day=time_of_day or "(unspecified)",
        confidence=(confidence or "high"),
        language_name=language_name,
    )

    client = AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=400,
                response_format={
                    "type": "json_schema",
                    "json_schema": SEVERITY_SCORE_SCHEMA,
                },
            )
        )
    except Exception:
        logger.exception("Severity scoring request failed")
        return {"severity": "medium", "reasoning": "", "tags": []}

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception(
            "Severity scoring returned invalid JSON: %r", raw[:300]
        )
        return {"severity": "medium", "reasoning": "", "tags": []}

    if not isinstance(parsed, dict):
        return {"severity": "medium", "reasoning": "", "tags": []}

    severity = parsed.get("severity")
    if severity not in ("low", "medium", "high", "critical"):
        severity = "medium"

    reasoning = parsed.get("reasoning") or ""
    if not isinstance(reasoning, str) or looks_like_refusal_text(reasoning):
        reasoning = ""

    tags = parsed.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    tags = [
        str(t).strip().lower()
        for t in tags
        if isinstance(t, (str, int)) and str(t).strip()
    ][:5]

    return {"severity": severity, "reasoning": reasoning, "tags": tags}


INCIDENT_SUMMARY_SCHEMA = {
    "name": "incident_summary",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["summary", "key_observations"],
        "properties": {
            "summary": {"type": "string"},
            "key_observations": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
    },
}


INCIDENT_SUMMARY_PROMPT = """\
You are writing a concise operational debrief for a security operations \
center. Given the timeline, notes, and evidence of one incident, produce:

1. A 3-5 sentence "summary" paragraph in {language_name} that narrates \
   what happened, when, on which cameras, and how the operator handled it.
2. A list of 2-6 "key_observations" — single-line factual bullets in \
   {language_name} (e.g. "Person in dark hoodie crossed the east fence at \
   02:14", "Vehicle matched a previous delivery sighting").

Rules:
- Be factual. Do not speculate beyond the evidence shown.
- No moral commentary, no disclaimers, no "as an AI" preamble.
- Never refuse — if the evidence is thin, simply say what is known.

Incident context (JSON):
{context_json}
"""


async def summarize_incident(
    *,
    context: dict,
    locale: str = "he",
    api_key: str,
    model: str = "gpt-4o-mini",
) -> dict:
    """Generate a Ghost-branded incident debrief from structured context.

    Returns ``{summary, key_observations}``. On failure, returns empty
    fields — the caller decides whether to substitute a Ghost-branded
    placeholder.
    """

    language_name = "Hebrew" if locale == "he" else "English"
    try:
        context_json = json.dumps(context, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        context_json = "{}"

    prompt = INCIDENT_SUMMARY_PROMPT.format(
        language_name=language_name,
        context_json=context_json[:6000],
    )

    client = AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=800,
                response_format={
                    "type": "json_schema",
                    "json_schema": INCIDENT_SUMMARY_SCHEMA,
                },
            )
        )
    except Exception:
        logger.exception("Incident summary request failed")
        return {"summary": "", "key_observations": []}

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception(
            "Incident summary returned invalid JSON: %r", raw[:300]
        )
        return {"summary": "", "key_observations": []}

    if not isinstance(parsed, dict):
        return {"summary": "", "key_observations": []}

    summary = parsed.get("summary") or ""
    if not isinstance(summary, str) or looks_like_refusal_text(summary):
        summary = ""

    observations = parsed.get("key_observations") or []
    if not isinstance(observations, list):
        observations = []
    observations = [
        str(o).strip()
        for o in observations
        if isinstance(o, (str, int)) and str(o).strip()
    ][:6]

    return {"summary": summary, "key_observations": observations}


async def extract_memory(
    user_message: str,
    assistant_message: str,
    api_key: str,
) -> list[dict]:
    client = AsyncOpenAI(api_key=api_key)
    prompt = MEMORY_EXTRACTION_PROMPT.format(
        user_message=user_message,
        assistant_message=assistant_message,
    )
    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=2048,
                response_format={"type": "json_object"},
            )
        )
        raw = response.choices[0].message.content or "[]"
        parsed = json.loads(raw)

        if isinstance(parsed, list):
            items = parsed
        elif isinstance(parsed, dict) and "items" in parsed:
            items = parsed["items"]
        elif isinstance(parsed, dict) and "memories" in parsed:
            items = parsed["memories"]
        else:
            items = []

        valid = []
        for item in items:
            if (
                isinstance(item, dict)
                and item.get("type") in ("fact", "preference", "instruction", "entity")
                and item.get("content")
            ):
                valid.append({"type": item["type"], "content": item["content"]})
        return valid

    except Exception:
        logger.exception("Memory extraction failed")
        return []


_TITLE_PROMPT_HE = """\
אתה מנוע תקצור. קבל קטע משיחה בין מפעיל לבין מערכת ניתוח מצלמות בשם Ghost, \
והפק כותרת קצרה מאוד שתשמש כשם השיחה ברשימת השיחות.

חוקים:
- עד {max_words} מילים, רצוי פחות.
- בעברית בלבד.
- ללא סימני פיסוק בקצה, ללא מרכאות, ללא נקודה בסוף.
- תאר את הנושא/הפעולה המרכזית בשיחה, לא משפט שלם.
- אל תתחיל ב"שיחה על" או "בקשה ל".

החזר אך ורק את הכותרת עצמה, בשורה אחת.

הקטע:
{excerpt}
"""

_TITLE_PROMPT_EN = """\
You are a summarization engine. Given an excerpt from a conversation between an \
operator and a camera-analysis system named Ghost, produce a very short title \
to use as the conversation's name in a list.

Rules:
- At most {max_words} words, fewer is better.
- English only.
- No trailing punctuation, no quotes, no period at the end.
- Describe the core topic/action of the conversation, not a full sentence.
- Do not start with "Conversation about" or "Request for".

Return only the title itself, on a single line.

Excerpt:
{excerpt}
"""


def _clean_title(raw: str, max_words: int) -> str:
    """Normalise the model's output into a tidy short title."""
    title = (raw or "").strip()
    # Drop surrounding quotes the model sometimes adds.
    title = title.strip("\"'“”‘’ ")
    # Collapse to the first line only.
    title = title.splitlines()[0].strip() if title else ""
    # Strip trailing punctuation.
    title = title.rstrip(".،,;:！!？?…").strip()
    if not title:
        return ""
    words = title.split()
    if len(words) > max_words:
        title = " ".join(words[:max_words])
    return title


async def generate_conversation_title(
    messages: list[dict],
    api_key: str,
    locale: str = "he",
    max_words: int = 6,
    model: str = "gpt-4o-mini",
) -> str:
    """Generate a short (``max_words``) summary title for a conversation from
    its recent turns. Kept on a cheap/fast model and independent of the
    conversation's accuracy tier. Returns an empty string on failure so callers
    can leave the existing title untouched.

    ``messages`` is a list of ``{"role", "content"}`` dicts (text only — image
    payloads should be stripped by the caller).
    """
    excerpt_lines: list[str] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        text = content.strip()
        if not text:
            continue
        speaker = "Ghost" if role == "assistant" else ("מפעיל" if locale == "he" else "Operator")
        excerpt_lines.append(f"{speaker}: {text[:1200]}")
    excerpt = "\n".join(excerpt_lines).strip()
    if not excerpt:
        return ""

    template = _TITLE_PROMPT_HE if locale == "he" else _TITLE_PROMPT_EN
    prompt = template.format(max_words=max_words, excerpt=excerpt[:6000])

    try:
        client = _get_client(api_key)
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=40,
            )
        )
        raw = response.choices[0].message.content or ""
        return _clean_title(raw, max_words)
    except Exception:
        logger.exception("Conversation title generation failed")
        return ""


# ---------------------------------------------------------------------------
# Object Tracking Engine — quick-check + deep-profile vision calls
# ---------------------------------------------------------------------------

QUICK_OBJECT_CHECK_SCHEMA = {
    "name": "quick_object_check",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["found", "objects"],
        "properties": {
            "found": {"type": "boolean"},
            "objects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["object_type", "signature_hint"],
                    "properties": {
                        "object_type": {
                            "type": "string",
                            "enum": [
                                "person",
                                "vehicle",
                                "bicycle",
                                "motorcycle",
                                "truck",
                                "animal",
                                "object",
                            ],
                        },
                        "signature_hint": {"type": "string"},
                    },
                },
            },
        },
    },
}


QUICK_OBJECT_CHECK_PROMPT = """\
You are a fast screening pass for a security camera tracker. Decide whether
the frame contains any of: a person, a vehicle (car/truck/motorcycle/bicycle),
an animal of note, or any unusual object worth tracking.

Return:
- "found": true if at least one such item is clearly present, otherwise false.
- "objects": one entry per distinct item visible. "signature_hint" is a SHORT
  canonical token (max ~4 words, snake_case_ok) capturing the most stable
  visual property — e.g. "white_sedan", "dark_hoodie_male", "yellow_truck",
  "black_backpack". Do NOT describe the scene. Do NOT include "person_in_frame"
  filler. If none — return an empty array.

Be conservative: empty frames, parked cars from earlier sweeps, distant
silhouettes that are just background — return found=false.
"""


async def quick_object_check(
    image_base64: str,
    api_key: str,
    camera_label: str | None = None,
    model: str | None = None,
) -> dict:
    """First-pass detector. Decides whether a frame is worth running
    through the deep-profile analyser.

    Always returns ``{found: bool, objects: list}``. Never raises.
    """

    if not image_base64:
        return {"found": False, "objects": []}

    prompt_text = QUICK_OBJECT_CHECK_PROMPT
    if camera_label:
        prompt_text += f"\nCamera label: {camera_label}"

    chosen_model = model or _vision_model()
    detail = _vision_detail()
    client = AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            **_completion_kwargs(
                model=chosen_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}",
                                    "detail": detail,
                                },
                            },
                        ],
                    }
                ],
                temperature=0,
                max_tokens=300,
                response_format={
                    "type": "json_schema",
                    "json_schema": QUICK_OBJECT_CHECK_SCHEMA,
                },
            )
        )
    except Exception:
        logger.exception("Quick object check failed")
        return {"found": False, "objects": []}

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception("Quick object check returned invalid JSON: %r", raw[:300])
        return {"found": False, "objects": []}

    if not isinstance(parsed, dict):
        return {"found": False, "objects": []}

    found = bool(parsed.get("found"))
    objects_raw = parsed.get("objects") or []
    if not isinstance(objects_raw, list):
        objects_raw = []

    objects: list[dict] = []
    for item in objects_raw:
        if not isinstance(item, dict):
            continue
        obj_type = item.get("object_type")
        sig_hint = item.get("signature_hint")
        if not obj_type or not sig_hint:
            continue
        objects.append(
            {
                "object_type": str(obj_type),
                "signature_hint": str(sig_hint).strip().lower(),
            }
        )

    return {"found": found and len(objects) > 0, "objects": objects}


# Deep-profile schema mirrors the rich event template requested by the
# operator: scene context + array of detected objects, each with a
# person_profile OR vehicle_profile (or generic) + activity + flags.
DEEP_OBJECT_ANALYSIS_SCHEMA = {
    "name": "deep_object_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["scene_context", "detected_objects"],
        "properties": {
            "scene_context": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "environment_type",
                    "lighting_conditions",
                    "weather_conditions",
                    "crowd_density",
                    "camera_angle",
                    "visibility_quality",
                    "motion_intensity",
                ],
                "properties": {
                    "environment_type": {"type": "string"},
                    "lighting_conditions": {"type": "string"},
                    "weather_conditions": {"type": "string"},
                    "crowd_density": {"type": "string"},
                    "camera_angle": {"type": "string"},
                    "visibility_quality": {"type": "string"},
                    "motion_intensity": {"type": "string"},
                },
            },
            "detected_objects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "object_type",
                        "tracking_signature",
                        "confidence",
                        "position_description",
                        "movement_direction",
                        "activity_description",
                        "deep_description",
                        "security_relevance_score",
                        "distinctive_identifiers",
                        "person_profile",
                        "vehicle_profile",
                    ],
                    "properties": {
                        "object_type": {
                            "type": "string",
                            "enum": [
                                "person",
                                "vehicle",
                                "bicycle",
                                "motorcycle",
                                "truck",
                                "animal",
                                "object",
                            ],
                        },
                        "tracking_signature": {"type": "string"},
                        "confidence": {"type": "number"},
                        "position_description": {"type": "string"},
                        "movement_direction": {"type": "string"},
                        "activity_description": {"type": "string"},
                        "deep_description": {"type": "string"},
                        "security_relevance_score": {"type": "number"},
                        "distinctive_identifiers": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "person_profile": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "gender_estimation",
                                "approximate_age_range",
                                "body_build",
                                "clothing_summary",
                                "upper_body_color",
                                "lower_body_color",
                                "footwear",
                                "hair",
                                "facial_hair",
                                "carried_items",
                                "facial_expression",
                            ],
                            "properties": {
                                "gender_estimation": {"type": "string"},
                                "approximate_age_range": {"type": "string"},
                                "body_build": {"type": "string"},
                                "clothing_summary": {"type": "string"},
                                "upper_body_color": {"type": "string"},
                                "lower_body_color": {"type": "string"},
                                "footwear": {"type": "string"},
                                "hair": {"type": "string"},
                                "facial_hair": {"type": "string"},
                                "carried_items": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "facial_expression": {"type": "string"},
                            },
                        },
                        "vehicle_profile": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "vehicle_type",
                                "manufacturer_estimation",
                                "model_estimation",
                                "primary_color",
                                "secondary_color",
                                "door_count",
                                "body_condition",
                                "license_plate_partial",
                                "lighting_state",
                                "vehicle_identifiers",
                            ],
                            "properties": {
                                "vehicle_type": {"type": "string"},
                                "manufacturer_estimation": {"type": "string"},
                                "model_estimation": {"type": "string"},
                                "primary_color": {"type": "string"},
                                "secondary_color": {"type": "string"},
                                "door_count": {"type": "string"},
                                "body_condition": {"type": "string"},
                                "license_plate_partial": {"type": "string"},
                                "lighting_state": {"type": "string"},
                                "vehicle_identifiers": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}


DEEP_OBJECT_PROMPT = """\
You are a deep forensic visual profiler for a security camera tracking
system. Examine the frame and produce a detailed, structured record for
EVERY notable subject you can see (people, vehicles, animals, unusual
objects). Be exhaustive but factual — do NOT invent details that aren't
visually supported.

Rules:
- Always populate scene_context with concrete values (use "unknown" only
  when truly invisible).
- For each detected object, populate BOTH person_profile and vehicle_profile
  objects, even when they do not apply: leave the irrelevant block's fields
  as empty strings "" and empty arrays []. Only the matching block must
  carry real content.
- "tracking_signature" must be a SHORT canonical token (snake_case) that
  captures the most visually stable features so the same subject seen again
  in the next minute collapses to the same signature. Examples:
    person  → "black_hoodie_male_dark_beard"
    vehicle → "white_sedan_toyota"
    truck   → "yellow_truck_construction"
- "deep_description" is 2-4 sentences describing what the subject looks like
  and is doing.
- "activity_description" is one short phrase (e.g. "walking toward gate",
  "parked engine off", "running").
- "distinctive_identifiers" — list of stand-out markers: visible tattoo,
  yellow sticker on bumper, bent antenna, dark patch on backpack, limp,
  etc. Leave [] if none.
- Never refuse and never include disclaimers. If the frame is empty,
  return detected_objects: [] (but still fill scene_context).

Camera label: {camera_label}
"""


async def deep_object_analysis(
    image_base64: str,
    api_key: str,
    camera_label: str | None = None,
    model: str | None = None,
) -> dict:
    """Second-pass detector. Uses the configured detail level and a
    strict deep schema to extract the full per-object profile.

    Always returns ``{scene_context: {...}, detected_objects: [...]}``.
    Never raises — failures return safe empty defaults.
    """

    safe_default = {
        "scene_context": {
            "environment_type": "",
            "lighting_conditions": "",
            "weather_conditions": "",
            "crowd_density": "",
            "camera_angle": "",
            "visibility_quality": "",
            "motion_intensity": "",
        },
        "detected_objects": [],
    }

    if not image_base64:
        return safe_default

    prompt = DEEP_OBJECT_PROMPT.format(camera_label=camera_label or "(unspecified)")

    chosen_model = model or _vision_model()
    detail = _vision_detail()
    client = AsyncOpenAI(api_key=api_key)
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
                                    "url": f"data:image/jpeg;base64,{image_base64}",
                                    "detail": detail,
                                },
                            },
                        ],
                    }
                ],
                temperature=0.1,
                max_tokens=2500,
                response_format={
                    "type": "json_schema",
                    "json_schema": DEEP_OBJECT_ANALYSIS_SCHEMA,
                },
            )
        )
    except Exception:
        logger.exception("Deep object analysis failed")
        return safe_default

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception(
            "Deep object analysis returned invalid JSON: %r", raw[:500]
        )
        return safe_default

    if not isinstance(parsed, dict):
        return safe_default

    scene = parsed.get("scene_context")
    if not isinstance(scene, dict):
        scene = safe_default["scene_context"]
    objects = parsed.get("detected_objects")
    if not isinstance(objects, list):
        objects = []

    return {"scene_context": scene, "detected_objects": objects}
