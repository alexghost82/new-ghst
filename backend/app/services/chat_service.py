from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import sqlite3
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
from pathlib import Path

from openai import APIConnectionError, AuthenticationError, RateLimitError

from app.config import (
    cap_tokens_for_intent,
    max_tokens_for_length,
    model_for_accuracy,
    normalize_image_detail,
    settings,
)
from app.services.memory_service import extract_and_save, retrieve_relevant as retrieve_memories
from app.services.knowledge_service import (
    retrieve_relevant as retrieve_knowledge,
    retrieve_self_knowledge,
)
from app.services.product_knowledge import (
    looks_like_self_or_usage_query,
    relevant_doc_ids_for_query,
)
from app.services.openai_client import (
    stream_chat_completion,
    structured_vision_analysis,
)
from app.services.prompt_builder import (
    EXPERT_READY_MARKER,
    build_expert_prompt,
    build_prompt,
    build_site_intelligence_prompt,
    classify_query_intent,
    compose_conversation_character,
)
from app.services.visual_memory_service import extract_observations as extract_visual
from app.services.vision_schema import render_scene_analysis_markdown
from app.storage.conversation_store import get_conversation, increment_message_count
from app.storage.message_store import (
    create_message,
    get_messages_since,
    list_messages,
    update_message_image_path,
)
from app.storage.user_store import get_user_api_key
from app.storage.vector_store import VectorStore
from app.storage.visual_memory_store import (
    list_entities as list_visual_entities,
    list_observations_since,
    list_recent_observations,
)
from app.storage.database import get_db as _get_new_db
from app.storage.detection_store import (
    list_objects as list_detected_objects,
    list_objects_since as list_detected_objects_since,
)

logger = logging.getLogger("ghost.chat")


async def _empty_chunks() -> list[dict]:
    """Awaitable that yields no chunks — lets ``asyncio.gather`` keep a fixed
    shape when self-knowledge retrieval is skipped for a turn."""
    return []


def _save_frame_to_disk(
    conversation_id: str,
    message_id: str,
    image_base64: str,
) -> str | None:
    """Persist a captured camera frame to disk and return a public URL fragment.

    The returned path is the canonical URL that resolves through the
    ``/api/frames`` static mount, so it can be used directly as an ``<img>``
    source on the frontend without further composition."""
    try:
        raw = base64.b64decode(image_base64, validate=False)
    except Exception:
        logger.exception("Failed to decode base64 frame for message %s", message_id)
        return None

    frames_root = Path(settings.upload_path) / "frames" / conversation_id
    frames_root.mkdir(parents=True, exist_ok=True)
    file_path = frames_root / f"{message_id}.jpg"

    try:
        file_path.write_bytes(raw)
    except OSError:
        logger.exception("Failed to write frame to disk: %s", file_path)
        return None

    return f"/api/frames/{conversation_id}/{message_id}.jpg"


# Tokens that signal the operator wants a multi-day / historical report or is
# asking about a specific past date, rather than "what's on the camera now".
# Hebrew terms are matched as-is; English terms against a lowercased copy.
_REPORT_KEYWORDS = (
    "דוח", 'דו"ח', "דו\u05f4ח",
    "כל הרכב", "כל האנש", "כל מי ש", "כל הרכבים", "כל האנשים",
    "החודש", "חודש האחרון", "החודש האחרון",
    "השבוע", "שבוע האחרון", "השבוע האחרון", "השבועות",
    "אתמול", "בימים האחרונים", "בשבועות האחרונים", "לאחרונה",
    "רשימה", "סכם", "סיכום", "היסטוריה", "תיעוד", "מתי ראית", "באיזה יום",
    "report", "all vehicles", "all the cars", "every vehicle",
    "every person", "this month", "last month", "this week",
    "last week", "yesterday", "history", "list of", "summary",
    "summarise", "summarize", "log of", "recap", "rundown", "when did you see",
)

# A concrete date reference such as 9/6, 09-06-26, 9.6.2026.
_DATE_MENTION_RE = re.compile(r"\b\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?\b")


def _looks_like_period_report(text: str) -> bool:
    """Heuristic: does the operator want a multi-day / historical report (or is
    asking about a specific past date)?

    When true, memory retrieval widens to the whole retention window with a
    far higher row limit — instead of just the most-recent handful — so queries
    like "every vehicle this month" or one naming a concrete past date can
    actually be answered from the long-term logs."""
    if not text:
        return False
    low = text.lower()
    if any(kw in low for kw in _REPORT_KEYWORDS):
        return True
    return bool(_DATE_MENTION_RE.search(text))


_REFUSAL_PATTERNS = [
    r"\bi['’`]?m\s+unable\s+to\s+identify\b",
    r"\bi\s+can(?:not|'t)\s+identify\b",
    r"\bi\s+can(?:not|'t)\s+describe\s+(?:individuals|specific\s+people|the\s+people)",
    r"\bi\s+can(?:not|'t)\s+provide\s+(?:information|details)\s+about\s+(?:people|individuals|the\s+person)",
    r"\bi\s+can(?:not|'t)\s+help\s+with\s+(?:identifying|surveillance)\b",
    r"\bi\s+can(?:not|'t)\s+analyze\s+(?:faces|the\s+face)\b",
    r"\bunable\s+to\s+identify\s+or\s+describe\s+(?:individuals|people)\b",
    r"\bi['’`]?m\s+sorry,?\s+but\s+i\s+can(?:not|'t)\b.{0,80}\b(?:identify|describe|people|person|image)\b",
    r"מצטער[\u0590-\u05FF\s]*אני\s+לא\s+יכול",
    r"אני\s+לא\s+יכול\s+(?:לעזור\s+עם\s+)?(?:זיהוי|לזהות|לתאר)",
    r"אני\s+לא\s+יכול\s+לספק\s+מידע\s+על",
    # --- Generic refusals (English) ---
    r"\bi['’`]?m\s+sorry,?\s+(?:but\s+)?i\s+can(?:not|'t)\s+(?:assist|help|do that|comply)\b",
    r"\bi\s+can(?:not|'t)\s+assist\s+with\s+that\b",
    r"\bi\s+(?:cannot|can't|won't)\s+help\s+with\s+that\b",
    r"\bi['’`]?m\s+not\s+able\s+to\s+(?:help|assist|do that)\b",
    r"\bi['’`]?m\s+unable\s+to\s+(?:help|assist|comply|fulfill)\b",
    r"\bunfortunately,?\s+i\s+(?:cannot|can't|am\s+unable)\b",
    r"\bi\s+(?:cannot|can't)\s+(?:generate|create|produce)\s+(?:content|that)\b",
    r"\bthis\s+(?:goes\s+against|violates)\s+my\s+(?:guidelines|policy|usage\s+policy)\b",
    r"\bmy\s+(?:usage\s+)?policy\s+prevents\b",
    r"\bi\s+(?:don't|do\s+not)\s+have\s+the\s+ability\s+to\b",
    r"\bi['’`]?m\s+not\s+(?:capable|designed)\s+(?:of|to)\b",
    r"\bi\s+apologize,?\s+but\s+i\s+(?:cannot|can't|am\s+unable)\b",
    # --- Identity leak patterns ---
    r"\bas\s+an?\s+ai\s+(?:language\s+)?(?:model|assistant)\b",
    # --- Hebrew refusals (generic) ---
    r"אני\s+(?:לא\s+יכול|מצטער[,.]?\s+(?:אך|אבל)\s+(?:לא\s+)?(?:אוכל|יכול))\s+לעזור\s+עם\s+(?:זה|הבקשה)",
    r"אני\s+לא\s+(?:יכול|מסוגל)\s+(?:לבצע|לעשות|ליצור)\s+את\s+(?:זה|הבקשה)",
    r"כמודל\s+שפה",
    r"בתור\s+(?:מודל|עוזר)\s+(?:שפה|בינה\s+מלאכותית)",
]

_REFUSAL_RE = re.compile("|".join(_REFUSAL_PATTERNS), re.IGNORECASE)

_REFUSAL_BUFFER_CHARS = 240


def _looks_like_refusal(text: str) -> bool:
    if not text:
        return False
    return bool(_REFUSAL_RE.search(text))


_GHOST_REFUSAL_REPLACEMENT = (
    "Ghost \u05dc\u05d0 \u05d4\u05e6\u05dc\u05d9\u05d7 \u05dc\u05e2\u05d1\u05d3 "
    "\u05d0\u05ea \u05d4\u05d1\u05e7\u05e9\u05d4 \u05d4\u05d6\u05d5. "
    "\u05e0\u05e1\u05d4 \u05dc\u05e0\u05e1\u05d7 \u05d0\u05d5\u05ea\u05d4 "
    "\u05d0\u05d7\u05e8\u05ea, \u05d0\u05d5 \u05e9\u05dc\u05d7 "
    "\u05d1\u05e7\u05e9\u05d4 \u05d7\u05d3\u05e9\u05d4."
)


def _ghost_clarification(locale: str = "he") -> str:
    """Ghost-voiced clarification prompt for a vague/contentless operator
    message. Phrased so it NEVER matches ``_REFUSAL_PATTERNS`` (it does not
    open with "I can't" / "אני לא יכול" / "מצטער") — it is an invitation to
    rephrase, plus a quick reminder of what Ghost can do, not a refusal."""
    if locale == "en":
        return (
            "Tell me what you want me to check and I'm on it. I can give you a "
            "quick read of what's in the frame right now, answer a specific "
            "question (who / what / how many / when), or keep an eye on "
            "something in particular. What do you need?"
        )
    return (
        "\u05ea\u05d2\u05d9\u05d3 \u05dc\u05d9 \u05de\u05d4 "
        "\u05dc\u05d1\u05d3\u05d5\u05e7 \u05d5\u05d0\u05e0\u05d9 \u05e2\u05dc "
        "\u05d6\u05d4. \u05d0\u05e4\u05e9\u05e8 \u05ea\u05de\u05d5\u05e0\u05ea "
        "\u05de\u05e6\u05d1 \u05e7\u05e6\u05e8\u05d4 \u05e9\u05dc "
        "\u05de\u05d4 \u05e9\u05d1\u05e4\u05e8\u05d9\u05d9\u05dd "
        "\u05e2\u05db\u05e9\u05d9\u05d5, \u05ea\u05e9\u05d5\u05d1\u05d4 "
        "\u05dc\u05e9\u05d0\u05dc\u05d4 \u05e1\u05e4\u05e6\u05d9\u05e4\u05d9\u05ea "
        "(\u05de\u05d9 / \u05de\u05d4 / \u05db\u05de\u05d4 / \u05de\u05ea\u05d9), "
        "\u05d0\u05d5 \u05de\u05e2\u05e7\u05d1 \u05d0\u05d7\u05e8\u05d9 "
        "\u05de\u05e9\u05d4\u05d5 \u05de\u05e1\u05d5\u05d9\u05dd. "
        "\u05de\u05d4 \u05ea\u05e8\u05e6\u05d4?"
    )


# ---------------------------------------------------------------------------
# Tech-probe lockdown
#
# Ghost's internal operation and the technology that powers it are CLASSIFIED.
# Any operator question that probes "how do you work", "what tech / model / API
# do you use", "who built you", etc. is blocked at all costs across three
# layers: (1) the GHOST_IDENTITY system prompt, (2) this input detector that
# short-circuits *before* the model is ever called, and (3) an output backstop
# that scans the model's reply for leaked tech names.
#
# The replacement message starts with this marker so the frontend can render
# the bubble as a red "classified information leak" warning. The marker is
# stored as part of the message content (same pattern as alert messages), so it
# survives reloads.
# ---------------------------------------------------------------------------
_SECURITY_MARKER = "[[GHOST_SECURITY_BLOCK]]"

# Sentinel prefix stored on user messages that were sent automatically by a
# scheduled task (משימה). The frontend strips it and renders a "task message"
# badge on the bubble. Kept in sync with TASK_MSG_MARKER in
# frontend/src/components/chat/MessageBubble.tsx.
_TASK_MSG_MARKER = "[[GHOST_TASK_MSG]]"

# Sentinel prefix stored on the assistant message that carries a full
# Sitelligence℠ report. The frontend strips it and renders a downloadable
# report card (the long report never shows as a raw bubble) — both live and
# after a refresh. Kept in sync with SITE_REPORT_MARKER in
# frontend/src/utils/siteReportMarker.ts.
_SITE_REPORT_MARKER = "[[GHOST_SITE_REPORT]]"

# Sentinel suffix appended to an assistant reply when Ghost answered a
# self/usage/how-to question that the source documents cover. The frontend
# strips it from the displayed text and renders a "download the guide" card
# below the answer. Kept in sync with DOC_OFFER_RE in
# frontend/src/utils/docOfferMarker.ts.
_DOC_OFFER_MARKER = "[[GHOST_DOC_OFFER:{ids}]]"

# Strong tokens/phrases that, on their own, mark the message as a tech probe.
_TECH_PROBE_STANDALONE = [
    # AI providers / model families
    r"open\s?ai",
    r"chat\s?gpt",
    r"\bgpt\b",
    r"\bgpt-?\d",
    r"\bllm\b",
    r"\bvlm\b",
    # vision / detection / tracking / OCR stacks
    r"\byolo\w*",
    r"deep\s?sort",
    r"byte\s?track",
    r"retina\s?net",
    r"faster\s+r-?cnn",
    r"mask\s+r-?cnn",
    r"\br-?cnn\b",
    r"tesseract",
    r"paddle\s?ocr",
    r"open\s?alpr",
    r"\balpr\b",
    r"ffmpeg",
    r"\brtsp\b",
    r"\bonvif\b",
    r"\bmqtt\b",
    r"opencv",
    r"py\s?torch",
    r"tensor\s?flow",
    r"\bmog2\b",
    r"segment\s+anything",
    # Hebrew operation / architecture probes
    r"\u05de\u05d0\u05d7\u05d5\u05e8\u05d9\s+\u05d4\u05e7\u05dc\u05e2\u05d9\u05dd",  # "מאחורי הקלעים"
    r"\u05d0\u05e8\u05db\u05d9\u05d8\u05e7\u05d8\u05d5\u05e8",  # "ארכיטקטור..."
    r"(?:\u05d0\u05d9\u05d6\u05d4|\u05d0\u05d9\u05d6\u05d5|\u05d0\u05d9\u05dc\u05d5|\u05d1\u05d0\u05d9\u05d6\u05d4)\s+\u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2",  # "איזה/אילו טכנולוג..."
    r"\u05de\u05d4\s+\u05d4\u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2",  # "מה הטכנולוג..."
    r"\u05de\u05d9\s+(?:\u05d9\u05e6\u05e8|\u05d1\u05e0\u05d4|\u05e4\u05d9\u05ea\u05d7|\u05d0\u05d9\u05de\u05df|\u05ea\u05db\u05e0\u05ea|\u05d4\u05e7\u05d9\u05dd)\s+\u05d0\u05d5\u05ea\u05da",  # "מי יצר/בנה אותך"
    r"\u05d0\u05d9\u05da\s+\u05d0\u05ea\u05d4\s+(?:\u05e2\u05d5\u05d1\u05d3|\u05d1\u05e0\u05d5\u05d9|\u05e4\u05d5\u05e2\u05dc|\u05e2\u05e9\u05d5\u05d9)",  # "איך אתה עובד/בנוי"
    r"\u05e2\u05dc\s+\u05de\u05d4\s+\u05d0\u05ea\u05d4\s+(?:\u05e8\u05e5|\u05d1\u05e0\u05d5\u05d9|\u05de\u05d1\u05d5\u05e1\u05e1)",  # "על מה אתה רץ"
    r"\u05de\u05d4\s+\u05de(?:\u05e4\u05e2\u05d9\u05dc|\u05e8\u05d9\u05e5)\s+\u05d0\u05d5\u05ea\u05da",  # "מה מפעיל/מריץ אותך"
    # English operation / architecture probes
    r"behind\s+the\s+scenes",
    r"how\s+(?:do|does)\s+you\s+work",
    r"how\s+(?:are|were)\s+you\s+(?:built|made|trained|created|designed)",
    r"who\s+(?:built|made|created|developed|trained|designed)\s+you",
    r"what\s+(?:tech|technology|technologies|framework|frameworks|llm|stack)\b",
    r"tech\s+stack",
    r"what\s+(?:are|do)\s+you\s+(?:built|run|running|made|based)\s+(?:on|with)",
    r"what'?s\s+your\s+(?:architecture|stack|tech|model)",
    r"what\s+powers\s+you",
    # model probes that explicitly target Ghost itself (not a vehicle's model)
    r"(?:what|which)\s+model\s+(?:are|is|do|does)\s+you",
    r"\u05d0\u05d9\u05d6\u05d4\s+\u05de\u05d5\u05d3\u05dc\s+\u05d0\u05ea\u05d4",  # "איזה מודל אתה"
    r"\u05d1?\u05d0\u05d9\u05d6\u05d4\s+\u05de\u05d5\u05d3\u05dc\s+(?:\u05d0\u05ea\u05d4\s+)?\u05de\u05e9\u05ea\u05de\u05e9",  # "באיזה מודל (אתה) משתמש"
    r"\u05e2\u05dc\s+\u05d0\u05d9\u05d6\u05d4\s+\u05de\u05d5\u05d3\u05dc",  # "על איזה מודל"
]

# Generic terms that only count as a probe when paired with a self-reference
# (you / your / ghost / אתה / אותך / שלך / לך).
_TECH_PROBE_GENERIC = [
    r"\bapi\b",
    r"framework",
    r"\btools?\b",
    r"\u05db\u05dc\u05d9\u05dd",  # "כלים"
    r"\u05d0\u05dc\u05d2\u05d5\u05e8\u05d9\u05ea\u05dd",  # "אלגוריתם"
    r"algorithm",
    r"\u05e1\u05e4\u05e8\u05d9(?:\u05d4|\u05d5\u05ea)",  # "ספריה/ספריות"
    r"librar(?:y|ies)",
]

_TECH_PROBE_SELF_REF = [
    r"\byou\b",
    r"\byour\b",
    r"yourself",
    r"\bghost\b",
    r"\u05d0\u05ea\u05d4",  # "אתה"
    r"\u05d0\u05d5\u05ea\u05da",  # "אותך"
    r"\u05e9\u05dc\u05da",  # "שלך"
    r"\u05dc\u05da\b",  # "לך"
]

# Tech names that must never appear in a streamed reply. If the model leaks any
# of these despite layers 1+2, the output backstop replaces the whole reply.
_TECH_LEAK_PATTERNS = [
    r"open\s?ai",
    r"chat\s?gpt",
    r"\bgpt-?\d",
    r"\bllm\b",
    r"\bvlm\b",
    r"\byolo\w*",
    r"deep\s?sort",
    r"byte\s?track",
    r"retina\s?net",
    r"faster\s+r-?cnn",
    r"mask\s+r-?cnn",
    r"\br-?cnn\b",
    r"tesseract",
    r"paddle\s?ocr",
    r"open\s?alpr",
    r"ffmpeg",
    r"\brtsp\b",
    r"\bonvif\b",
    r"opencv",
    r"py\s?torch",
    r"tensor\s?flow",
    r"\bmog2\b",
    r"segment\s+anything",
]

_TECH_PROBE_STANDALONE_RE = re.compile("|".join(_TECH_PROBE_STANDALONE), re.IGNORECASE)
_TECH_PROBE_GENERIC_RE = re.compile("|".join(_TECH_PROBE_GENERIC), re.IGNORECASE)
_TECH_PROBE_SELF_REF_RE = re.compile("|".join(_TECH_PROBE_SELF_REF), re.IGNORECASE)
_TECH_LEAK_RE = re.compile("|".join(_TECH_LEAK_PATTERNS), re.IGNORECASE)


def _looks_like_tech_probe(text: str) -> bool:
    """True when the operator is probing Ghost's internal operation/technology."""
    if not text:
        return False
    if _TECH_PROBE_STANDALONE_RE.search(text):
        return True
    if _TECH_PROBE_GENERIC_RE.search(text) and _TECH_PROBE_SELF_REF_RE.search(text):
        return True
    return False


def _looks_like_tech_leak(text: str) -> bool:
    """True when a reply leaks the name of a model/library/tool/provider."""
    if not text:
        return False
    return bool(_TECH_LEAK_RE.search(text))


def _ghost_security_warning(locale: str = "he") -> str:
    """Sharp, Ghost-branded refusal to disclose classified technology.

    Prefixed with ``_SECURITY_MARKER`` so the frontend renders the bubble in
    red as an information-leak warning. Worded so it never matches the refusal
    or tech-leak patterns, and never names any provider."""
    if locale == "en":
        body = (
            "\u26d4 CLASSIFIED. Ghost does not disclose its internal operation, "
            "its architecture, or the technologies that power it \u2014 not to "
            "operators, not to anyone. This request has been logged as an "
            "attempt to access classified technical information."
        )
    else:
        body = (
            "\u26d4 \u05de\u05d9\u05d3\u05e2 \u05de\u05e1\u05d5\u05d5\u05d2. Ghost "
            "\u05dc\u05d0 \u05d7\u05d5\u05e9\u05e3 \u05d0\u05ea \u05d0\u05d5\u05e4\u05df "
            "\u05e4\u05e2\u05d5\u05dc\u05ea\u05d5, \u05d0\u05ea "
            "\u05d4\u05d0\u05e8\u05db\u05d9\u05d8\u05e7\u05d8\u05d5\u05e8\u05d4 "
            "\u05d0\u05d5 \u05d0\u05ea "
            "\u05d4\u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2\u05d9\u05d5\u05ea "
            "\u05e9\u05de\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea \u05d0\u05d5\u05ea\u05d5 "
            "\u2014 \u05dc\u05d0 \u05dc\u05de\u05e4\u05e2\u05d9\u05dc\u05d9\u05dd "
            "\u05d5\u05dc\u05d0 \u05dc\u05d0\u05e3 \u05d2\u05d5\u05e8\u05dd. "
            "\u05d4\u05d1\u05e7\u05e9\u05d4 \u05ea\u05d5\u05e2\u05d3\u05d4 "
            "\u05db\u05e0\u05d9\u05e1\u05d9\u05d5\u05df \u05d2\u05d9\u05e9\u05d4 "
            "\u05dc\u05de\u05d9\u05d3\u05e2 \u05d8\u05db\u05e0\u05d9 "
            "\u05de\u05e1\u05d5\u05d5\u05d2."
        )
    return f"{_SECURITY_MARKER}\n{body}"


async def handle_send_message(
    conversation_id: str,
    user_id: str,
    content: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
    image_base64: str | None = None,
    camera_frames: list[dict] | None = None,
    locale: str = "he",
    mode: str = "chat",
    task_id: str | None = None,
    camera_label: str | None = None,
) -> AsyncGenerator[str, None]:
    conv = get_conversation(db, conversation_id, user_id=user_id)
    if not conv:
        yield _sse_error("CONVERSATION_NOT_FOUND", "Conversation not found or access denied")
        return

    api_key = get_user_api_key(db, user_id)
    if not api_key:
        yield _sse_error("API_KEY_MISSING", "No API key configured for this user")
        return

    # Operator-selected answer accuracy (1-4) -> OpenAI chat model. A higher
    # level means a stronger / more expensive model for every reply in this
    # conversation.
    chat_model = model_for_accuracy(conv.get("accuracy_level"))
    # Advanced-settings knobs: response length -> output cap, image detail ->
    # vision pass fidelity. Both default to the previous behaviour.
    chat_max_tokens = max_tokens_for_length(conv.get("response_length"))
    chat_image_detail = normalize_image_detail(conv.get("image_detail"))

    # Tech-probe lockdown (layer 2): block questions about Ghost's own
    # operation/technology BEFORE the model is ever called. Records the
    # question, then streams the red security warning as the assistant reply.
    if _looks_like_tech_probe(content):
        logger.info("Tech-probe detected; blocking before model call.")
        probe_user_msg = create_message(db, conversation_id, "user", content)
        increment_message_count(db, conversation_id)
        warning = _ghost_security_warning(locale)
        yield _sse_token(warning)
        probe_assistant_msg = create_message(
            db, conversation_id, "assistant", warning
        )
        increment_message_count(db, conversation_id)
        yield _sse_done(
            message_id=probe_assistant_msg["id"],
            user_message_id=probe_user_msg["id"],
        )
        return

    # Answer-scope intent drives HOW MUCH Ghost says: a specific question gets
    # a narrow answer, a general prompt gets a one-liner, an explicit request
    # gets the full breakdown, and a vague/contentless message is answered with
    # a clarification instead of a generic dump.
    intent = classify_query_intent(content)

    # Vague short-circuit (same pattern as the tech-probe lockdown): when the
    # operator's message has no actionable content, ask them to clarify in
    # Ghost's voice instead of calling the model. Skipped for the dedicated
    # Site Intelligence scan, which is button-driven and always specific, and
    # for scheduled-task runs whose prompt was deliberately pre-defined.
    if intent == "vague" and mode not in ("site_intelligence", "expert") and not task_id:
        logger.info("Vague message detected; asking operator to clarify.")
        vague_user_msg = create_message(db, conversation_id, "user", content)
        increment_message_count(db, conversation_id)
        if image_base64:
            saved = _save_frame_to_disk(conversation_id, vague_user_msg["id"], image_base64)
            if saved:
                update_message_image_path(db, vague_user_msg["id"], saved)
                vague_user_msg["image_path"] = saved
        clarification = _ghost_clarification(locale)
        yield _sse_token(clarification)
        vague_assistant_msg = create_message(
            db, conversation_id, "assistant", clarification
        )
        increment_message_count(db, conversation_id)
        yield _sse_done(
            message_id=vague_assistant_msg["id"],
            user_message_id=vague_user_msg["id"],
            user_image_path=vague_user_msg.get("image_path"),
        )
        return

    if mode == "site_intelligence" and image_base64:
        async for event in _handle_site_intelligence_message(
            conversation_id=conversation_id,
            content=content,
            image_base64=image_base64,
            api_key=api_key,
            db=db,
            model=chat_model,
        ):
            yield event
        return

    if mode == "expert":
        async for event in _handle_expert_message(
            conversation_id=conversation_id,
            content=content,
            api_key=api_key,
            db=db,
            locale=locale,
        ):
            yield event
        return

    # Scheduled-task runs persist the user message with a marker prefix so
    # the chat UI can badge it as an automated message. The model still
    # receives the clean ``content`` (the marker is only in the stored row).
    stored_user_content = (
        f"{_TASK_MSG_MARKER}\n{content}" if task_id else content
    )

    if camera_frames:
        async for event in _handle_multi_camera_message(
            conversation_id=conversation_id,
            content=content,
            camera_frames=camera_frames,
            conv=conv,
            api_key=api_key,
            db=db,
            vector_store=vector_store,
            locale=locale,
            model=chat_model,
            max_tokens=chat_max_tokens,
            image_detail=chat_image_detail,
            intent=intent,
        ):
            yield event
        return

    user_msg = create_message(db, conversation_id, "user", stored_user_content)
    increment_message_count(db, conversation_id)

    if image_base64:
        saved_path = _save_frame_to_disk(conversation_id, user_msg["id"], image_base64)
        if saved_path:
            update_message_image_path(db, user_msg["id"], saved_path)
            user_msg["image_path"] = saved_path

    recent = get_messages_since(db, conversation_id, since_hours=24)

    # When the operator asks "what can you do / how do I use you / how does X
    # work in Ghost", Ghost's product answers are bounded to its official
    # source documents (operator training, shared language, architecture). We
    # retrieve from that global self-knowledge collection and, after the reply,
    # offer the matching source PDF for download.
    wants_self_knowledge = looks_like_self_or_usage_query(content)

    # Memory + knowledge retrieval each embed the query and search a vector
    # store; running them concurrently shaves one embedding round-trip off the
    # latency-critical pre-model path.
    memories, knowledge, self_knowledge = await asyncio.gather(
        retrieve_memories(
            conversation_id, content, api_key, db, vector_store, top_k=5
        ),
        retrieve_knowledge(
            conv["user_id"], content, api_key, db, vector_store, top_k=5
        ),
        retrieve_self_knowledge(content, api_key, vector_store, top_k=6)
        if wants_self_knowledge
        else _empty_chunks(),
    )
    # Period-report / past-date queries pull the whole retention window so the
    # long-term memory (which spans days) is actually surfaced; routine "what's
    # on the camera now" turns keep the cheaper recent-rows slice.
    report_query = _looks_like_period_report(content)
    if report_query:
        since_iso = (
            datetime.now(timezone.utc)
            - timedelta(days=settings.detection_retention_days)
        ).isoformat()
        visual_observations = list_observations_since(
            db, conversation_id, since_iso, limit=1500
        )
        visual_entities = list_visual_entities(db, conversation_id, limit=120)
    else:
        visual_observations = list_recent_observations(db, conversation_id, limit=200)
        visual_entities = list_visual_entities(db, conversation_id, limit=60)

    detected_objects: list[dict] | None = None
    if not image_base64:
        if report_query:
            detected_objects = list_detected_objects_since(
                db, conversation_id, since_iso, limit=1500
            ) or None
        else:
            detected_objects = list_detected_objects(db, conversation_id, limit=200) or None

    messages = build_prompt(
        system_prompt=compose_conversation_character(conv),
        memories=memories,
        knowledge_chunks=knowledge,
        recent_messages=recent[:-1],
        current_message=content,
        image_base64=image_base64,
        locale=locale,
        visual_observations=visual_observations,
        visual_entities=visual_entities,
        detected_objects=detected_objects,
        image_detail=chat_image_detail,
        intent=intent,
        self_knowledge_chunks=self_knowledge,
    )

    effective_max_tokens = cap_tokens_for_intent(intent, chat_max_tokens)

    full_response = ""
    try:
        async for chunk in _stream_with_refusal_guard(
            messages,
            api_key,
            has_image=bool(image_base64),
            locale=locale,
            model=chat_model,
            max_tokens=effective_max_tokens,
        ):
            full_response += chunk
            yield _sse_token(chunk)
    except Exception as e:
        logger.exception("Stream error")
        yield _stream_error_event(e, locale)
        return

    # Defense-in-depth: a reasoning model can still exhaust its budget and
    # return an empty reply. Never persist/emit an empty bubble — surface a
    # Ghost-branded message instead so the operator always sees something.
    if not full_response.strip():
        logger.warning(
            "Empty assistant reply for conversation %s (model=%s, intent=%s); "
            "substituting Ghost message.",
            conversation_id,
            chat_model,
            intent,
        )
        full_response = _GHOST_REFUSAL_REPLACEMENT
        yield _sse_token(full_response)

    # Self/usage answer: offer the matching official source document(s) for
    # download via an in-chat card. The marker is appended (and streamed) so it
    # lands in both the live bubble and the persisted message, but the frontend
    # strips it from the displayed text and renders only the download card.
    if wants_self_knowledge and self_knowledge:
        doc_ids = relevant_doc_ids_for_query(content)
        if doc_ids:
            offer = "\n\n" + _DOC_OFFER_MARKER.format(ids=",".join(doc_ids))
            full_response += offer
            yield _sse_token(offer)

    assistant_msg = create_message(db, conversation_id, "assistant", full_response)
    increment_message_count(db, conversation_id)

    yield _sse_done(
        message_id=assistant_msg["id"],
        user_message_id=user_msg["id"],
        user_image_path=user_msg.get("image_path"),
    )

    if task_id:
        # Scheduled-task run: evaluate the reply against the task's trigger
        # phrases in an isolated background task (own DB connection, full
        # try/except, rate-limited via the shared AlertQueue). Memory and
        # visual-memory extraction are intentionally SKIPPED for task runs —
        # recurring automated turns must not burn extra model calls or
        # pollute conversation memory.
        from app.services.task_service import evaluate_task_triggers

        asyncio.create_task(
            evaluate_task_triggers(
                task_id=task_id,
                conversation_id=conversation_id,
                user_id=user_id,
                assistant_text=full_response,
                frame_url=user_msg.get("image_path"),
                camera_label=camera_label,
                api_key=api_key,
                locale=locale,
            )
        )
        return

    asyncio.create_task(
        _background_memory_extraction(
            conversation_id, content, full_response, api_key, vector_store
        )
    )

    if image_base64:
        asyncio.create_task(
            _background_visual_memory(
                conversation_id=conversation_id,
                message_id=assistant_msg["id"],
                assistant_text=full_response,
                camera_label=None,
                camera_device_id=None,
                image_path=user_msg.get("image_path"),
                observed_at=assistant_msg["created_at"],
                api_key=api_key,
            )
        )


async def _handle_site_intelligence_message(
    conversation_id: str,
    content: str,
    image_base64: str,
    api_key: str,
    db: sqlite3.Connection,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """Run a one-shot Site Intelligence scan on a single frame.

    Bypasses ``GHOST_IDENTITY`` (conversational, no headers) and uses the
    dedicated structured PDF-report prompt. Uses a higher ``max_tokens`` cap
    because the target output is a long formal report (~600+ words). Skips
    refusal guard, conversation history, memories, knowledge — this is a
    discrete analysis turn, not a chat reply."""

    user_msg = create_message(db, conversation_id, "user", content)
    increment_message_count(db, conversation_id)

    saved_path = _save_frame_to_disk(conversation_id, user_msg["id"], image_base64)
    if saved_path:
        update_message_image_path(db, user_msg["id"], saved_path)
        user_msg["image_path"] = saved_path

    messages = build_site_intelligence_prompt(image_base64=image_base64)

    full_response = ""
    try:
        async for chunk in stream_chat_completion(
            messages,
            api_key,
            model=model,
            temperature=0.4,
            max_tokens=8192,
        ):
            full_response += chunk
            yield _sse_token(chunk)
    except Exception as e:
        logger.exception("Site intelligence stream error")
        yield _stream_error_event(e, locale="he")
        return

    # Store the report with the marker prefix (store-only — never streamed in
    # tokens) so a page refresh reconstructs the downloadable report card
    # instead of rendering the long report as a raw bubble.
    stored_response = f"{_SITE_REPORT_MARKER}{full_response}"
    assistant_msg = create_message(db, conversation_id, "assistant", stored_response)
    increment_message_count(db, conversation_id)

    yield _sse_done(
        message_id=assistant_msg["id"],
        user_message_id=user_msg["id"],
        user_image_path=user_msg.get("image_path"),
    )


async def _handle_expert_message(
    conversation_id: str,
    content: str,
    api_key: str,
    db: sqlite3.Connection,
    locale: str = "he",
) -> AsyncGenerator[str, None]:
    """Run one turn of the Ghost Expert interrogation.

    Persists the operator message + Ghost's interrogation reply, streams the
    reply, and signals ``expert_ready`` on the ``done`` event once Ghost emits
    the readiness marker (asking to pull a live frame). The marker is a system
    sentinel and is NEVER shown to the operator: it is held back from the
    streamed display and stripped from the stored message."""
    from app.config import settings as _settings

    user_msg = create_message(db, conversation_id, "user", content)
    increment_message_count(db, conversation_id)

    recent = get_messages_since(db, conversation_id, since_hours=24)
    messages = build_expert_prompt(
        recent_messages=recent[:-1],
        current_message=content,
        locale=locale,
    )

    model = _settings.effective_expert_model()

    # Hold back a trailing window so the readiness marker (which always lands at
    # the very end on its own line) can never be partially emitted to the UI.
    holdback = len(EXPERT_READY_MARKER) + 2
    full_response = ""
    emitted = 0
    try:
        async for chunk in stream_chat_completion(
            messages,
            api_key,
            model=model,
            temperature=0.6,
            max_tokens=2048,
        ):
            full_response += chunk
            safe_upto = max(emitted, len(full_response) - holdback)
            if safe_upto > emitted:
                yield _sse_token(full_response[emitted:safe_upto])
                emitted = safe_upto
    except Exception as e:
        logger.exception("Expert interrogation stream error")
        yield _stream_error_event(e, locale=locale)
        return

    expert_ready = EXPERT_READY_MARKER in full_response
    visible = full_response.replace(EXPERT_READY_MARKER, "").rstrip()

    # Flush whatever remains after the held-back window (marker already removed).
    if len(visible) > emitted:
        yield _sse_token(visible[emitted:])

    if not visible.strip():
        visible = _GHOST_REFUSAL_REPLACEMENT
        yield _sse_token(visible)

    assistant_msg = create_message(db, conversation_id, "assistant", visible)
    increment_message_count(db, conversation_id)

    yield _sse_done(
        message_id=assistant_msg["id"],
        user_message_id=user_msg["id"],
        expert_ready=expert_ready,
    )


async def _handle_multi_camera_message(
    conversation_id: str,
    content: str,
    camera_frames: list[dict],
    conv: dict,
    api_key: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
    locale: str = "he",
    model: str | None = None,
    max_tokens: int = 4096,
    image_detail: str | None = None,
    intent: str = "open",
) -> AsyncGenerator[str, None]:
    """Run a separate analysis turn per camera, streaming a labelled assistant
    response for each one. Each camera is treated as an isolated observation:
    the same user message persists once, but every assistant reply is tied to
    its source camera via ``camera_label`` so the UI can render distinct
    bubbles."""
    user_msg = create_message(db, conversation_id, "user", content)
    increment_message_count(db, conversation_id)

    yield _sse_user_message(
        user_message_id=user_msg["id"],
        camera_count=len(camera_frames),
    )

    # Snapshot the visual log ONCE per turn so every camera sees the same
    # ground-truth context (and so we save N-1 SQL roundtrips).
    visual_observations = list_recent_observations(db, conversation_id, limit=200)
    visual_entities = list_visual_entities(db, conversation_id, limit=60)

    aggregated_assistant = ""
    last_assistant_id: str | None = None

    effective_max_tokens = cap_tokens_for_intent(intent, max_tokens)

    for index, frame in enumerate(camera_frames):
        label = frame.get("label") or f"Camera {index + 1}"
        image_b64 = frame.get("image_base64") or ""
        device_id = frame.get("device_id") or None
        if not image_b64:
            logger.warning(
                "Skipping camera frame with empty image_base64 for %s",
                conversation_id,
            )
            continue

        recent = get_messages_since(db, conversation_id, since_hours=24)
        memories, knowledge = await asyncio.gather(
            retrieve_memories(
                conversation_id, content, api_key, db, vector_store, top_k=5
            ),
            retrieve_knowledge(
                conv["user_id"], content, api_key, db, vector_store, top_k=5
            ),
        )

        per_camera_message = f"[Camera: {label}] {content}"
        messages = build_prompt(
            system_prompt=compose_conversation_character(conv),
            memories=memories,
            knowledge_chunks=knowledge,
            recent_messages=recent[:-1],
            current_message=per_camera_message,
            image_base64=image_b64,
            locale=locale,
            visual_observations=visual_observations,
            visual_entities=visual_entities,
            image_detail=image_detail,
            intent=intent,
        )

        yield _sse_camera_start(label=label, index=index)

        full_response = ""
        try:
            async for chunk in _stream_with_refusal_guard(
                messages,
                api_key,
                has_image=True,
                locale=locale,
                model=model,
                max_tokens=effective_max_tokens,
            ):
                full_response += chunk
                yield _sse_token(chunk, camera_label=label)
        except Exception as e:
            logger.exception("Stream error for camera %s", label)
            yield _stream_error_event(e, locale)
            continue

        # Defense-in-depth: never persist/emit an empty per-camera bubble.
        if not full_response.strip():
            logger.warning(
                "Empty assistant reply for camera %s (model=%s, intent=%s); "
                "substituting Ghost message.",
                label,
                model,
                intent,
            )
            full_response = _GHOST_REFUSAL_REPLACEMENT
            yield _sse_token(full_response, camera_label=label)

        assistant_msg = create_message(
            db,
            conversation_id,
            "assistant",
            full_response,
            camera_label=label,
        )
        increment_message_count(db, conversation_id)

        frame_path = _save_frame_to_disk(
            conversation_id, assistant_msg["id"], image_b64
        )
        if frame_path:
            update_message_image_path(db, assistant_msg["id"], frame_path)
            assistant_msg["image_path"] = frame_path

        last_assistant_id = assistant_msg["id"]
        aggregated_assistant += f"\n\n[{label}]\n{full_response}"

        asyncio.create_task(
            _background_visual_memory(
                conversation_id=conversation_id,
                message_id=assistant_msg["id"],
                assistant_text=full_response,
                camera_label=label,
                camera_device_id=device_id,
                image_path=assistant_msg.get("image_path"),
                observed_at=assistant_msg["created_at"],
                api_key=api_key,
            )
        )

        yield _sse_camera_done(
            label=label,
            message_id=assistant_msg["id"],
            image_path=assistant_msg.get("image_path"),
        )

    yield _sse_done(
        message_id=last_assistant_id or user_msg["id"],
        user_message_id=user_msg["id"],
        user_image_path=None,
    )

    if aggregated_assistant.strip():
        asyncio.create_task(
            _background_memory_extraction(
                conversation_id,
                content,
                aggregated_assistant.strip(),
                api_key,
                vector_store,
            )
        )


async def handle_broadcast_message(
    content: str,
    camera_frames: list[dict],
    api_key: str,
    *,
    locale: str = "he",
    system_prompt: str = "",
    scope_label: str | None = None,
) -> AsyncGenerator[str, None]:
    """Run an ephemeral per-camera analysis turn for an area/group broadcast.

    Behaves like :func:`_handle_multi_camera_message` — one labelled assistant
    reply per camera, streamed via the same ``camera_start`` / ``token`` /
    ``camera_done`` SSE events so the frontend can reuse its stream parser — but
    persists nothing: no conversation, no messages, no visual memory, no frames
    on disk. Each camera is an isolated, stateless observation. The refusal
    guard still runs on every response, as required."""
    # Tech-probe lockdown (layer 2): block before any model call. Ephemeral —
    # emit the red security warning once and stop.
    if _looks_like_tech_probe(content):
        logger.info("Tech-probe detected in broadcast; blocking before model call.")
        yield _sse_user_message(
            user_message_id="broadcast-user",
            camera_count=len(camera_frames),
        )
        yield _sse_token(_ghost_security_warning(locale))
        yield _sse_done(
            message_id="broadcast-security-block",
            user_message_id="broadcast-user",
        )
        return

    intent = classify_query_intent(content)

    # Vague short-circuit — ephemeral: emit one Ghost clarification and stop.
    if intent == "vague":
        logger.info("Vague broadcast message detected; asking operator to clarify.")
        yield _sse_user_message(
            user_message_id="broadcast-user",
            camera_count=len(camera_frames),
        )
        yield _sse_token(_ghost_clarification(locale))
        yield _sse_done(
            message_id="broadcast-clarify",
            user_message_id="broadcast-user",
        )
        return

    yield _sse_user_message(
        user_message_id="broadcast-user",
        camera_count=len(camera_frames),
    )

    last_assistant_id: str | None = None

    effective_max_tokens = cap_tokens_for_intent(intent, 4096)

    for index, frame in enumerate(camera_frames):
        label = frame.get("label") or f"Camera {index + 1}"
        image_b64 = frame.get("image_base64") or ""
        if not image_b64:
            logger.warning("Skipping broadcast camera frame with empty image (%s)", label)
            continue

        per_camera_message = f"[Camera: {label}] {content}"
        messages = build_prompt(
            system_prompt=system_prompt,
            memories=[],
            knowledge_chunks=[],
            recent_messages=[],
            current_message=per_camera_message,
            image_base64=image_b64,
            locale=locale,
            intent=intent,
        )

        yield _sse_camera_start(label=label, index=index)

        full_response = ""
        try:
            async for chunk in _stream_with_refusal_guard(
                messages,
                api_key,
                has_image=True,
                locale=locale,
                max_tokens=effective_max_tokens,
            ):
                full_response += chunk
                yield _sse_token(chunk, camera_label=label)
        except Exception as e:
            logger.exception("Broadcast stream error for camera %s", label)
            yield _stream_error_event(e, locale)
            continue

        last_assistant_id = f"broadcast-{index}"
        yield _sse_camera_done(label=label, message_id=last_assistant_id)

    yield _sse_done(
        message_id=last_assistant_id or "broadcast-user",
        user_message_id="broadcast-user",
        user_image_path=None,
    )


# Warm "אופי אנושי" tone, SCOPED to the broadcast-explore handler only. It is
# prepended as the per-call ``system_prompt`` so it never leaks into any other
# chat path (the rest of the product stays dry-tactical). Deliberate softening:
# warmer and conversational, but still dry-intel discipline — no emojis, no
# superlatives, no buzzwords, no provider names. The refusal / tech-leak guards
# still run on every token via ``_stream_text_guarded``.
_EXPLORE_WARM_TONE = {
    "he": (
        "אתה משוחח עכשיו עם המפעיל במצב 'חקור' — שיחה רגועה ואנושית שמבוססת "
        "אך ורק על ההיסטוריה השמורה של השיחה הזו. דבר בגוף ראשון, בחום ובפשטות, "
        "כמו עמית שמכיר את התיק לעומק. שמור על דיוק ויובש מודיעיני: בלי "
        "סופרלטיבים, בלי אימוג'ים, בלי מילות באז. ענה רק ממה שמתועד בהיסטוריה; "
        "אם פרט חסר — אמור זאת בפשטות במקום לנחש."
    ),
    "en": (
        "You are now talking with the operator in 'Explore' mode — a calm, "
        "human conversation grounded only in this conversation's stored "
        "history. Speak in the first person, warmly and plainly, like a "
        "colleague who knows the file well. Stay precise and dry: no "
        "superlatives, no emojis, no buzzwords. Answer only from what the "
        "history records; if a detail isn't there, say so plainly rather than "
        "guessing."
    ),
}


async def handle_broadcast_explore(
    content: str,
    conversation_ids: list[str],
    user_id: str,
    api_key: str,
    *,
    locale: str = "he",
    scope_label: str | None = None,
) -> AsyncGenerator[str, None]:
    """Run an ephemeral per-conversation "explore" turn for an area/group.

    For each conversation in scope, answers ``content`` from that
    conversation's STORED text history (no live camera frame, no source image)
    and streams one warm, conversational reply, labelled by the conversation
    title, via the same ``camera_start`` / ``token`` / ``camera_done`` SSE
    events the broadcast frontend already parses. Persists nothing: no
    messages, no memory, no frames. Ownership is verified per conversation via
    :func:`get_conversation`; conversations that are missing/denied or have no
    history are silently skipped. The same tech-probe / vague short-circuits
    and the refusal / tech-leak guards run exactly as in the camera path."""
    if _looks_like_tech_probe(content):
        logger.info("Tech-probe detected in broadcast explore; blocking before model call.")
        yield _sse_user_message(
            user_message_id="broadcast-user",
            camera_count=len(conversation_ids),
        )
        yield _sse_token(_ghost_security_warning(locale))
        yield _sse_done(
            message_id="broadcast-security-block",
            user_message_id="broadcast-user",
        )
        return

    intent = classify_query_intent(content)

    if intent == "vague":
        logger.info("Vague broadcast explore message detected; asking operator to clarify.")
        yield _sse_user_message(
            user_message_id="broadcast-user",
            camera_count=len(conversation_ids),
        )
        yield _sse_token(_ghost_clarification(locale))
        yield _sse_done(
            message_id="broadcast-clarify",
            user_message_id="broadcast-user",
        )
        return

    yield _sse_user_message(
        user_message_id="broadcast-user",
        camera_count=len(conversation_ids),
    )

    last_assistant_id: str | None = None
    effective_max_tokens = cap_tokens_for_intent(intent, 4096)
    warm_system = _EXPLORE_WARM_TONE.get(locale, _EXPLORE_WARM_TONE["he"])

    db = _get_new_db()
    try:
        for index, conv_id in enumerate(conversation_ids):
            conv = get_conversation(db, conv_id, user_id=user_id)
            if not conv:
                logger.info("Skipping explore conversation not owned/found: %s", conv_id)
                continue

            title = conv.get("title") or f"Conversation {index + 1}"
            history = list_messages(db, conv_id, limit=200)
            if not history:
                logger.info("Skipping explore conversation with empty history: %s", title)
                continue

            messages = build_prompt(
                system_prompt=warm_system,
                memories=[],
                knowledge_chunks=[],
                recent_messages=history,
                current_message=content,
                image_base64=None,
                locale=locale,
                intent=intent,
            )

            yield _sse_camera_start(
                label=title, index=index, conversation_id=conv_id
            )

            full_response = ""
            try:
                async for chunk in _stream_text_guarded(
                    messages,
                    api_key,
                    locale,
                    max_tokens=effective_max_tokens,
                ):
                    full_response += chunk
                    yield _sse_token(chunk, camera_label=title)
            except Exception as e:
                logger.exception("Broadcast explore stream error for conversation %s", title)
                yield _stream_error_event(e, locale)
                continue

            last_assistant_id = f"broadcast-explore-{index}"
            yield _sse_camera_done(
                label=title, message_id=last_assistant_id, conversation_id=conv_id
            )
    finally:
        db.close()

    yield _sse_done(
        message_id=last_assistant_id or "broadcast-user",
        user_message_id="broadcast-user",
        user_image_path=None,
    )


# The streaming text guard emits tokens as they arrive but always withholds a
# trailing "safe tail" so a refusal/tech-leak phrase that straddles two chunks
# can never be partially flushed to the client before the full accumulated
# reply has been scanned. The tail must be at least as long as the longest
# phrase any pattern could match; 240 chars comfortably exceeds every entry in
# ``_REFUSAL_PATTERNS`` / ``_TECH_LEAK_PATTERNS`` (the longest are ~80 chars).
_GUARD_SAFE_TAIL_CHARS = 240


async def _stream_text_guarded(
    messages: list[dict],
    api_key: str,
    locale: str,
    model: str | None = None,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    """Stream a text-only reply token-by-token while guarding it.

    Tokens are forwarded as they arrive for a real streaming feel, but the
    guard keeps a ``_GUARD_SAFE_TAIL_CHARS`` trailing window UNSENT and
    re-scans the FULL accumulated reply on every step. The moment the
    accumulated text matches a tech-leak or refusal pattern, every already-sent
    character is irrelevant — we stop forwarding, discard the streamed reply,
    and emit the Ghost-branded replacement instead. Because a match is detected
    before the tail (which contains the still-unsent portion) is ever flushed,
    a leak/refusal phrase straddling a chunk boundary is still caught before it
    reaches the operator. On clean completion the withheld tail is flushed."""
    full = ""
    sent = 0
    intercepted = False
    try:
        async for token in stream_chat_completion(
            messages, api_key, model=model, max_tokens=max_tokens
        ):
            full += token

            if _looks_like_tech_leak(full):
                logger.warning(
                    "Tech leak detected mid-stream (%d chars); intercepting.",
                    len(full),
                )
                # The leak is always within the still-unsent safe tail, so it
                # never reached the client. Emit the warning only when nothing
                # was streamed yet; otherwise truncate to avoid contradicting a
                # clean prefix already shown.
                if sent == 0:
                    warning = _ghost_security_warning(locale)
                    for i in range(0, len(warning), 60):
                        yield warning[i : i + 60]
                intercepted = True
                return
            if _looks_like_refusal(full):
                logger.info("Refusal detected mid-stream; intercepting.")
                if sent == 0:
                    yield _GHOST_REFUSAL_REPLACEMENT
                intercepted = True
                return

            # Flush everything except the trailing safe tail.
            flush_to = len(full) - _GUARD_SAFE_TAIL_CHARS
            if flush_to > sent:
                yield full[sent:flush_to]
                sent = flush_to
    except Exception:
        logger.exception("Streaming chat completion failed (text turn)")
        # A genuine model/transport failure (auth, rate-limit, network) must
        # propagate so the caller can surface an explicit, actionable error —
        # never swallow it into the generic Ghost refusal bubble.
        raise

    if intercepted:
        return

    # Final whole-reply scan (covers anything still inside the withheld tail).
    if _looks_like_tech_leak(full):
        logger.warning(
            "Tech leak detected in final text reply (%d chars); replacing with "
            "security warning.",
            len(full),
        )
        if sent == 0:
            warning = _ghost_security_warning(locale)
            for i in range(0, len(warning), 60):
                yield warning[i : i + 60]
        return
    if _looks_like_refusal(full):
        logger.info("Refusal detected in final text reply; replacing with Ghost message.")
        if sent == 0:
            yield _GHOST_REFUSAL_REPLACEMENT
        return

    if len(full) > sent:
        yield full[sent:]


async def _stream_with_refusal_guard(
    messages: list[dict],
    api_key: str,
    *,
    has_image: bool = False,
    locale: str = "he",
    model: str | None = None,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    """Guard every AI response before it reaches the client.

    Text turns (``has_image=False``) are buffered in full, then scanned for
    both refusals and tech-leaks (layer 3 of the tech-probe lockdown) before
    being re-emitted in chunks — this guarantees a leaked model/library/tool
    name can never stream to the operator. Vision turns keep low-latency
    streaming with the first-~240-char refusal sniff (and a structured
    JSON-schema fallback on refusal)."""

    if not has_image:
        async for chunk in _stream_text_guarded(
            messages, api_key, locale, model=model, max_tokens=max_tokens
        ):
            yield chunk
        return

    buffer = ""
    buffered_chunks: list[str] = []
    decision_made = False
    refusal_detected = False

    try:
        async for token in stream_chat_completion(
            messages, api_key, model=model, max_tokens=max_tokens
        ):
            if not decision_made:
                buffer += token
                buffered_chunks.append(token)
                if len(buffer) >= _REFUSAL_BUFFER_CHARS:
                    decision_made = True
                    if _looks_like_refusal(buffer):
                        refusal_detected = True
                        break
                    for chunk in buffered_chunks:
                        yield chunk
                    buffered_chunks = []
                continue

            yield token
    except Exception:
        logger.exception("Vision streaming chat completion failed")
        # A genuine model/transport failure must propagate so the caller can
        # surface an actionable error, NOT be misread as a model refusal that
        # triggers the structured-vision fallback / Ghost refusal bubble.
        raise

    if not decision_made and not refusal_detected:
        if _looks_like_refusal(buffer):
            refusal_detected = True
        else:
            for chunk in buffered_chunks:
                yield chunk
            return

    if not refusal_detected:
        return

    logger.info(
        "Response looked like a refusal (%d chars buffered, has_image=%s); "
        "intercepting.",
        len(buffer),
        has_image,
    )

    if has_image:
        try:
            analysis = await structured_vision_analysis(messages, api_key)
        except Exception:
            logger.exception("Structured vision fallback failed")
            yield _GHOST_REFUSAL_REPLACEMENT
            return

        if not analysis:
            yield _GHOST_REFUSAL_REPLACEMENT
            return

        markdown = render_scene_analysis_markdown(analysis)
        if not markdown.strip():
            yield _GHOST_REFUSAL_REPLACEMENT
            return

        chunk_size = 60
        for i in range(0, len(markdown), chunk_size):
            yield markdown[i : i + chunk_size]
    else:
        yield _GHOST_REFUSAL_REPLACEMENT


async def _background_memory_extraction(
    conversation_id: str,
    user_message: str,
    assistant_message: str,
    api_key: str,
    vector_store: VectorStore,
) -> None:
    """Run memory extraction in the background with a dedicated SQLite
    connection. The route's primary connection is closed as soon as the SSE
    stream ends, so we must NOT share it — opening a fresh one here keeps
    this task fully decoupled from the request lifecycle and prevents
    "Cannot operate on a closed database" / lock contention errors during
    multi-camera turns."""
    db = _get_new_db()
    try:
        await extract_and_save(
            conversation_id, user_message, assistant_message, api_key, db, vector_store
        )
    except Exception:
        logger.exception(
            "Background memory extraction failed for conversation %s",
            conversation_id,
        )
    finally:
        try:
            db.close()
        except Exception:
            pass


async def _background_visual_memory(
    *,
    conversation_id: str,
    message_id: str,
    assistant_text: str,
    camera_label: str | None,
    camera_device_id: str | None,
    image_path: str | None,
    observed_at: str,
    api_key: str,
) -> None:
    """Run structured visual-entity extraction for a single assistant
    response and persist the results.

    Uses a dedicated SQLite connection per task so it cannot collide with
    the request's primary connection (which the route closes as soon as the
    SSE stream ends) and cannot serialise behind another background task
    writing to the same handle. Never raises — failures are logged so they
    cannot break the SSE stream that already returned ``done`` to the
    client."""
    db = _get_new_db()
    try:
        await extract_visual(
            conversation_id=conversation_id,
            message_id=message_id,
            assistant_text=assistant_text,
            camera_label=camera_label,
            camera_device_id=camera_device_id,
            image_path=image_path,
            observed_at=observed_at,
            api_key=api_key,
            db=db,
        )
    except Exception:
        logger.exception(
            "Background visual memory extraction failed for conversation %s (message=%s)",
            conversation_id,
            message_id,
        )
    finally:
        try:
            db.close()
        except Exception:
            pass


def _sse_token(token: str, camera_label: str | None = None) -> str:
    payload: dict[str, str] = {"token": token}
    if camera_label is not None:
        payload["camera_label"] = camera_label
    return f"event: token\ndata: {json.dumps(payload)}\n\n"


def _sse_done(
    message_id: str,
    user_message_id: str | None = None,
    user_image_path: str | None = None,
    expert_ready: bool = False,
) -> str:
    payload: dict[str, str | bool | None] = {"message_id": message_id}
    if user_message_id is not None:
        payload["user_message_id"] = user_message_id
    if user_image_path is not None:
        payload["user_image_path"] = user_image_path
    if expert_ready:
        # Ghost Expert: signals the operator should be asked to authorize a
        # live frame pull (the interrogation has gathered enough context).
        payload["expert_ready"] = True
    return f"event: done\ndata: {json.dumps(payload)}\n\n"


def _sse_error(code: str, message: str) -> str:
    return f"event: error\ndata: {json.dumps({'code': code, 'message': message})}\n\n"


def _stream_error_event(exc: Exception, locale: str = "he") -> str:
    """Translate a model/transport exception into a clean, brand-safe,
    localized SSE error event for the operator.

    A genuine infrastructure failure (invalid API key, rate limit, network)
    must NEVER be masked behind the Ghost refusal message — that makes a 401
    look like the model declined the request. Instead we surface an explicit,
    actionable error the operator can act on. The message never names any AI
    provider and never echoes key material."""
    he = locale != "en"
    if isinstance(exc, AuthenticationError):
        message = (
            "\u05de\u05e4\u05ea\u05d7 \u05d4-Ghost API \u05e9\u05de\u05d5\u05d2\u05d3\u05e8 "
            "\u05d0\u05d9\u05e0\u05d5 \u05ea\u05e7\u05d9\u05df \u05d0\u05d5 \u05e9\u05e4\u05d2 "
            "\u05ea\u05d5\u05e7\u05e3. \u05e2\u05d3\u05db\u05df \u05de\u05e4\u05ea\u05d7 "
            "Ghost API \u05ea\u05e7\u05d9\u05df \u05d1\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea "
            "\u05db\u05d3\u05d9 \u05dc\u05d4\u05de\u05e9\u05d9\u05da."
            if he
            else
            "The configured Ghost API key is invalid or expired. Update a valid "
            "Ghost API key in Settings to continue."
        )
        return _sse_error("API_KEY_INVALID", message)
    if isinstance(exc, RateLimitError):
        message = (
            "Ghost \u05e2\u05de\u05d5\u05e1 \u05db\u05e8\u05d2\u05e2 "
            "(\u05d7\u05e8\u05d9\u05d2\u05ea \u05e7\u05e6\u05d1). \u05e0\u05e1\u05d4 "
            "\u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05e8\u05d2\u05e2."
            if he
            else "Ghost is rate-limited right now. Try again in a moment."
        )
        return _sse_error("RATE_LIMITED", message)
    if isinstance(exc, APIConnectionError):
        message = (
            "Ghost \u05dc\u05d0 \u05d4\u05e6\u05dc\u05d9\u05d7 "
            "\u05dc\u05d4\u05ea\u05d7\u05d1\u05e8 \u05dc\u05e9\u05e8\u05ea "
            "\u05d4\u05de\u05d5\u05d3\u05dc. \u05d1\u05d3\u05d5\u05e7 \u05d0\u05ea "
            "\u05d4\u05d7\u05d9\u05d1\u05d5\u05e8 \u05d5\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1."
            if he
            else "Ghost couldn't reach the model server. Check the connection and try again."
        )
        return _sse_error("CONNECTION_ERROR", message)
    message = (
        "Ghost \u05e0\u05ea\u05e7\u05dc \u05d1\u05e9\u05d2\u05d9\u05d0\u05d4 "
        "\u05d1\u05e2\u05d9\u05d1\u05d5\u05d3 \u05d4\u05d1\u05e7\u05e9\u05d4. "
        "\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1."
        if he
        else "Ghost hit an error processing the request. Try again."
    )
    return _sse_error("STREAM_ERROR", message)


def _sse_user_message(user_message_id: str, camera_count: int) -> str:
    payload = {
        "user_message_id": user_message_id,
        "camera_count": camera_count,
    }
    return f"event: user_message\ndata: {json.dumps(payload)}\n\n"


def _sse_camera_start(
    label: str, index: int, conversation_id: str | None = None
) -> str:
    payload: dict[str, str | int] = {"label": label, "index": index}
    if conversation_id is not None:
        payload["conversation_id"] = conversation_id
    return f"event: camera_start\ndata: {json.dumps(payload)}\n\n"


def _sse_camera_done(
    label: str,
    message_id: str,
    image_path: str | None = None,
    conversation_id: str | None = None,
) -> str:
    payload: dict[str, str | None] = {"label": label, "message_id": message_id}
    if image_path is not None:
        payload["image_path"] = image_path
    if conversation_id is not None:
        payload["conversation_id"] = conversation_id
    return f"event: camera_done\ndata: {json.dumps(payload)}\n\n"
