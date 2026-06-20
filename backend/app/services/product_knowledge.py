"""Ghost product self-knowledge — sourced ONLY from the marketing site.

Ghost must be able to answer "who are you / what do you know / what can you
do" using ONLY the content of the marketing pages — and for *capabilities*,
ONLY the 9 capabilities shown on ``/capabilities``.

The 9 capabilities are authored in the frontend
(``frontend/src/data/capabilities.ts``) and exported to
``backend/app/data/ghost_capabilities.json`` by
``scripts/gen-ghost-knowledge.mjs`` (wired into ``npm run build``). This module
loads that snapshot once and renders a compact system-prompt block that is
injected by default into every chat turn (see ``prompt_builder.build_prompt``).

This is *product* knowledge (what the operator can do with Ghost). It is
deliberately separate from, and does not relax, the tech-probe lockdown in
``chat_service`` that keeps Ghost's internal technology classified.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger("ghost.product_knowledge")

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "ghost_capabilities.json"

# Hard fallback used only if the generated JSON is missing (e.g. a backend run
# before the frontend build ever ran). The 9 ids match capabilities.ts so the
# guardrail still names the right set even without titles.
_FALLBACK = {
    "page": {
        "en": {"title": "What Ghost can do", "subtitle": ""},
        "he": {"title": "מה Ghost יודע לעשות", "subtitle": ""},
    },
    "capabilities": [
        {"id": cid, "copy": {"en": {"title": cid, "simple": ""}, "he": {"title": cid, "simple": ""}}}
        for cid in (
            "chat",
            "cameras",
            "organize",
            "systemPrompt",
            "memory",
            "siteScan",
            "history",
            "broadcast",
            "alerts",
        )
    ],
}


def _load() -> dict:
    try:
        with _DATA_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        caps = data.get("capabilities")
        if not isinstance(caps, list) or not caps:
            raise ValueError("no capabilities in snapshot")
        return data
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        logger.warning(
            "ghost_capabilities.json unavailable (%s); using built-in fallback. "
            "Run `npm run gen:knowledge` in frontend/ to regenerate.",
            exc,
        )
        return _FALLBACK


# Loaded once at import. The snapshot is a build artifact, so a process restart
# (which a deploy implies) is enough to pick up changes.
_KNOWLEDGE = _load()


def _locale_key(locale: str) -> str:
    return "he" if (locale or "he").lower().startswith("he") else "en"


# ---------------------------------------------------------------------------
# Bounded professional self-knowledge — the ONLY source documents Ghost may
# draw on when answering "what can you do / how do I use you / how does X
# work in Ghost". These are seeded into the global ``ghost_self_knowledge``
# vector collection and offered to the operator as downloads in chat. The
# ``download_path`` resolves through Firebase Hosting (``frontend/public/docs``).
# ---------------------------------------------------------------------------
SELF_KNOWLEDGE_DOCS: list[dict] = [
    {
        "id": "operator_training_program",
        "filename": "Ghost_Operator_Training_Program_HE.pdf",
        "download_path": "/docs/Ghost_Operator_Training_Program_HE.pdf",
        "title": {"he": "תוכנית הדרכת מפעיל Ghost", "en": "Ghost Operator Training Program"},
        # Topics this doc is the best download for (matched against the query).
        "topics": ("training", "usage", "howto", "operation", "onboarding"),
    },
    {
        "id": "operator_training_visual_appendix",
        "filename": "Ghost_Operator_Training_Visual_Appendix_HE.pdf",
        "download_path": "/docs/Ghost_Operator_Training_Visual_Appendix_HE.pdf",
        "title": {
            "he": "נספח תרגול ויזואלי למפעיל",
            "en": "Ghost Operator Training — Visual Appendix",
        },
        "topics": ("training", "usage", "howto", "examples", "visual"),
    },
    {
        "id": "shared_language_partners",
        "filename": "Ghost_Shared_Language_Partners.pdf",
        "download_path": "/docs/Ghost_Shared_Language_Partners.pdf",
        "title": {"he": "שפה משותפת — שותפים", "en": "Ghost Shared Language — Partners"},
        "topics": ("capabilities", "concept", "language", "messaging"),
    },
    {
        "id": "enterprise_architecture",
        "filename": "Ghost_Enterprise_Architecture_wecL.pdf",
        "download_path": "/docs/Ghost_Enterprise_Architecture_wecL.pdf",
        "title": {"he": "ארכיטקטורת Ghost לארגון", "en": "Ghost Enterprise Architecture"},
        "topics": ("architecture", "capabilities", "concept"),
    },
]

_DOC_BY_ID = {d["id"]: d for d in SELF_KNOWLEDGE_DOCS}


def doc_meta(doc_id: str) -> dict | None:
    return _DOC_BY_ID.get(doc_id)


def all_doc_ids() -> list[str]:
    return [d["id"] for d in SELF_KNOWLEDGE_DOCS]


# --- Self-identity blurb (per the marketing voice; never names a provider) ---
GHOST_SELF_IDENTITY_BLURB = {
    "he": (
        "## מי אתה — לפי אתר Ghost\n"
        "כשנשאל מי אתה או מה אתה: אתה Ghost — שכבת ההבנה שיושבת על גבי המצלמות "
        "של המפעיל. אתה לא רק מזהה, אתה מבין מה קורה בזירה ומדבר על זה בשפה "
        "פשוטה. המפעיל שואל אותך שאלות על מה שהמצלמות רואות — בהווה ובעבר — "
        "ואתה עונה. ענה על שאלות זהות אך ורק מתוך מה שמופיע באתר; אל תמציא "
        "פרטים, מספרים, או הבטחות שלא מופיעים כאן."
    ),
    "en": (
        "## Who you are — per the Ghost site\n"
        "When asked who or what you are: you are Ghost — the understanding "
        "layer that sits on top of the operator's cameras. You don't just "
        "detect, you understand what's happening on the site and talk about it "
        "in plain language. The operator asks you about what the cameras see — "
        "now and in the past — and you answer. Answer identity questions ONLY "
        "from what the site says; never invent details, numbers, or promises "
        "that aren't here."
    ),
}

# --- Guardrail: capability answers must come ONLY from the 9 capabilities -----
CAPABILITIES_GUARDRAIL = {
    "he": (
        "## גבול היכולות — חובה\n"
        "כשנשאל *מה אתה יודע לעשות*, *מה אתה מציע*, *מה הפיצ'רים*, *איך "
        "משתמשים בך*, או *איך עושים משהו ב-Ghost* — ענה אך ורק מתוך תשע "
        "היכולות המפורטות למעלה ומתוך 'הידע המקצועי הרשמי על Ghost' שמופיע "
        "בהמשך (כשהוא צורף). אלה מקורות האמת היחידים שלך לגבי המוצר עצמו, "
        "ואין אחרים. אל תמציא, תרמוז על, או תבטיח יכולת/נוהל שאינם מופיעים שם. "
        "אם נשאלת על משהו שמחוץ למקורות האלה, אמור בפשטות שזה לא חלק ממה "
        "ש-Ghost עושה, והפנה למה שכן. הגבלה זו חלה רק על שאלות זהות/יכולות/"
        "אופן-שימוש/מוצר; היא אינה משנה את תפקידך לתאר זירות, לענות על שאלות "
        "על המצלמות, ולהתריע."
    ),
    "en": (
        "## Capability boundary — mandatory\n"
        "When asked *what you can do*, *what you offer*, *what your features "
        "are*, *how to use you*, or *how to do something in Ghost* — answer "
        "ONLY from the nine capabilities listed above and from the 'official "
        "professional knowledge about Ghost' block below (when attached). Those "
        "are your only sources of truth about the product itself; there are no "
        "others. Never invent, imply, or promise a capability/procedure that "
        "isn't in those sources. If asked about something outside them, simply "
        "say it's not part of what Ghost does, and point to what is. This "
        "boundary applies only to identity/capability/usage/product questions; "
        "it does not change your job of describing scenes, answering questions "
        "about the cameras, and raising alerts."
    ),
}


def build_capabilities_block(locale: str = "he") -> str:
    """Render the authoritative 9-capability list as a compact prompt block."""
    key = _locale_key(locale)
    caps = _KNOWLEDGE.get("capabilities") or _FALLBACK["capabilities"]

    if key == "he":
        header = (
            "## מה Ghost יודע לעשות (מקור רשמי — אלה היכולות היחידות)\n"
            "תשע היכולות הבאות, בדיוק כפי שמוצגות באתר Ghost, הן כל מה שאתה "
            "יודע לעשות:\n"
        )
    else:
        header = (
            "## What Ghost can do (authoritative — the only capabilities)\n"
            "The following nine capabilities, exactly as shown on the Ghost "
            "site, are everything you can do:\n"
        )

    lines: list[str] = []
    for i, cap in enumerate(caps, start=1):
        copy = (cap.get("copy") or {}).get(key) or {}
        title = (copy.get("title") or cap.get("id") or "").strip()
        simple = (copy.get("simple") or "").strip()
        if simple:
            lines.append(f"{i}. **{title}** — {simple}")
        else:
            lines.append(f"{i}. **{title}**")

    return header + "\n".join(lines)


# --- Capability / identity intent detection ---------------------------------
# Reinforces the system block: when the operator explicitly asks who Ghost is
# or what it can do, build_prompt injects a one-shot example that answers from
# the 9 capabilities, so the model never drifts into invented features.
_CAPABILITY_QUERY_PATTERNS = [
    # Hebrew
    r"מה\s+אתה\s+(?:יודע|יכול)\s+לעשות",
    r"מה\s+(?:אתה\s+)?(?:יודע|יכול)",
    r"מה\s+היכולות",
    r"מה\s+אתה\s+(?:מציע|נותן)",
    r"במה\s+אתה\s+(?:עוזר|מסייע)",
    r"מי\s+אתה\b",
    r"מה\s+אתה\b",
    r"מה\s+זה\s+ghost",
    r"מה\s+הפיצ'?רים",
    r"איך\s+(?:משתמשים|אני\s+משתמש)\s+בך",
    # English
    r"what\s+can\s+you\s+do",
    r"what\s+do\s+you\s+do",
    r"what\s+are\s+you(?:r\s+capabilities| able to do)?\b",
    r"what\s+can\s+ghost\s+do",
    r"who\s+are\s+you\b",
    r"what\s+is\s+ghost\b",
    r"what\s+(?:features|capabilities)\b",
    r"how\s+do\s+i\s+use\s+(?:you|ghost)\b",
    r"what\s+do\s+you\s+offer\b",
]

_CAPABILITY_QUERY_RE = re.compile("|".join(_CAPABILITY_QUERY_PATTERNS), re.IGNORECASE)


def looks_like_capability_query(text: str) -> bool:
    """True when the operator is asking who Ghost is / what it can do."""
    if not text:
        return False
    return bool(_CAPABILITY_QUERY_RE.search(text))


# Broader detector: capability/identity questions PLUS "how do I do X in
# Ghost", "how do I set an alert/task", "how do I connect a camera", "guide
# me", etc. When this fires, Ghost retrieves from the bounded self-knowledge
# documents and may offer the matching source PDF for download.
_USAGE_QUERY_PATTERNS = [
    # Hebrew — how-to / guidance
    r"איך\s+(?:אני\s+)?(?:עושים|עושה|מגדיר|מגדירים|יוצר|יוצרים|מחבר|מחברים|"
    r"מפעיל|מפעילים|משתמש|משתמשים|בודק|בודקים|כותב|כותבים)",
    r"איך\s+",
    r"כיצד\s+",
    r"מדריך|הדרכה|הסבר על|תסביר לי|להדריך|תלמד אותי|איך מתחילים",
    r"מה\s+(?:זה|המשמעות של)\s+(?:משימה|התראה|alert|task)",
    r"איך\s+מגדירים\s+(?:התראה|משימה)",
    # English — how-to / guidance
    r"how\s+do\s+i\b",
    r"how\s+to\b",
    r"how\s+can\s+i\b",
    r"guide\s+me|walk\s+me\s+through|teach\s+me|tutorial|getting\s+started",
    r"how\s+does\s+\w+\s+work",
    r"set\s+up\s+(?:an?\s+)?(?:alert|task|camera)",
]
_USAGE_QUERY_RE = re.compile("|".join(_USAGE_QUERY_PATTERNS), re.IGNORECASE)


def looks_like_self_or_usage_query(text: str) -> bool:
    """True when the operator asks about Ghost's identity/capabilities OR how
    to use Ghost / how something works in Ghost.

    This is the gate for (a) retrieving the bounded professional self-knowledge
    and (b) offering the matching source documents for download in chat."""
    if not text:
        return False
    return looks_like_capability_query(text) or bool(_USAGE_QUERY_RE.search(text))


# Lightweight topic hints used to pick WHICH source docs to offer for a query.
_TOPIC_HINTS: dict[str, tuple[str, ...]] = {
    "training": ("הדרכ", "מדריך", "תרגול", "מתחיל", "ללמוד", "תלמד", "train", "learn", "onboard", "tutorial", "getting started", "guide"),
    "howto": ("איך", "כיצד", "how do", "how to", "how can", "set up"),
    "examples": ("דוגמ", "תרחיש", "example", "scenario"),
    "architecture": ("ארכיטקט", "מערכת", "אבטחת מידע", "architecture", "security", "infrastructure", "deploy"),
    "capabilities": ("יכול", "פיצ", "מה אתה", "capabilit", "feature", "what can"),
}


def relevant_doc_ids_for_query(text: str) -> list[str]:
    """Pick the most relevant source documents to offer for a usage/identity
    query. Falls back to the training program + capabilities docs."""
    low = (text or "").lower()
    matched_topics: set[str] = set()
    for topic, hints in _TOPIC_HINTS.items():
        if any(h in low for h in hints):
            matched_topics.add(topic)

    if not matched_topics:
        # Generic capability/usage question → the two best entry-point docs.
        return ["operator_training_program", "shared_language_partners"]

    picked: list[str] = []
    for doc in SELF_KNOWLEDGE_DOCS:
        if matched_topics.intersection(doc.get("topics", ())):
            picked.append(doc["id"])
    # Cap at three so the card stays focused.
    return (picked or ["operator_training_program"])[:3]


def build_bounded_knowledge_block(chunks: list[dict], locale: str = "he") -> str:
    """Render retrieved self-knowledge chunks as an authoritative prompt block.

    The block is injected into the system prompt only when the operator asks a
    self/usage question, so routine scene turns are unaffected."""
    if not chunks:
        return ""
    key = _locale_key(locale)
    if key == "he":
        header = (
            "## ידע מקצועי רשמי על Ghost (מקור מחייב)\n"
            "הקטעים הבאים נשלפו ממסמכי המקור הרשמיים של Ghost (הדרכת מפעיל, "
            "שפה משותפת, ארכיטקטורה). כשאתה עונה על שאלת יכולות/אופן-שימוש/"
            "הדרכה — בסס את התשובה אך ורק על הקטעים האלה ועל תשע היכולות "
            "למעלה. אל תוסיף מידע שאינו מופיע כאן.\n"
        )
    else:
        header = (
            "## Official professional knowledge about Ghost (authoritative)\n"
            "The following passages were retrieved from Ghost's official source "
            "documents (operator training, shared language, architecture). When "
            "answering a capability/usage/how-to question, base your answer ONLY "
            "on these passages and the nine capabilities above. Do not add "
            "information that is not present here.\n"
        )
    lines: list[str] = []
    for c in chunks:
        snippet = (c.get("content") or "").strip()
        if snippet:
            lines.append(f"---\n{snippet}")
    return header + "\n".join(lines)


def capability_few_shot(locale: str = "he") -> tuple[str, str]:
    """A one-shot (user, assistant) pair answering strictly from the 9 caps.

    The assistant answer is built from the loaded capability titles so it can
    never name a capability that isn't on the page."""
    key = _locale_key(locale)
    caps = _KNOWLEDGE.get("capabilities") or _FALLBACK["capabilities"]
    titles = [
        ((c.get("copy") or {}).get(key) or {}).get("title") or c.get("id")
        for c in caps
    ]

    if key == "he":
        user = "מה אתה יודע לעשות?"
        intro = (
            "הנה מה ש-Ghost יודע לעשות — כל אחד מאלה דרך שיחה פשוטה מול "
            "המצלמות שלך:"
        )
        outro = "תרצה שאסביר אחת מהן לעומק?"
    else:
        user = "What can you do?"
        intro = (
            "Here's what Ghost can do — each one through a plain conversation "
            "with your cameras:"
        )
        outro = "Want me to walk you through any of these?"

    body = "\n".join(f"- {t}" for t in titles)
    assistant = f"{intro}\n\n{body}\n\n{outro}"
    return user, assistant


def build_self_knowledge(locale: str = "he") -> str:
    """Full self-knowledge block injected into the system prompt by default.

    Combines the identity blurb, the authoritative 9-capability list, and the
    capability guardrail, in the interface language.
    """
    key = _locale_key(locale)
    return "\n\n".join(
        [
            GHOST_SELF_IDENTITY_BLURB[key],
            build_capabilities_block(locale),
            CAPABILITIES_GUARDRAIL[key],
        ]
    )
