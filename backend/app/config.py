from __future__ import annotations

import logging
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("ghost")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ghost_master_key: str = "change-me-to-a-random-fernet-key"
    openai_api_key: str = ""

    # ------------------------------------------------------------------
    # Demo / trial credentials — held SERVER-SIDE only. The public
    # "Talk to Ghost" trial and the hidden demo-admin flow both run on a
    # shared, pre-seeded Ghost agent whose API key must never reach the
    # browser bundle. The frontend calls dedicated demo endpoints that
    # use this key on the server; the key is supplied via the
    # ``GHOST_DEMO_API_KEY`` env var / Secret Manager.
    # ------------------------------------------------------------------
    # NOTE: the env var is ``GHOST_DEMO_API_KEY`` (set by ``.env`` and injected
    # into Cloud Run by deploy-firebase.sh), which does not match this field's
    # bare name. The explicit alias makes pydantic-settings read the prefixed
    # name; without it the demo/trial flow silently breaks with DEMO_UNAVAILABLE.
    demo_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GHOST_DEMO_API_KEY", "DEMO_API_KEY", "demo_api_key"),
    )
    demo_nickname: str = "ghostdemo"
    # Authorization code an operator must present (server-verified) before
    # a new operator account can be provisioned from Settings. Supplied via
    # ``GHOST_GM_CODE``; empty disables operator self-provisioning.
    ghost_gm_code: str = ""
    # Shared secret guarding the internal admin / PII listing endpoints
    # (download leads, job applications, trial-account roster, magic-link
    # minting). Supplied via ``GHOST_ADMIN_TOKEN`` and presented by the
    # client through the ``X-Ghost-Admin-Token`` header. Empty means the
    # admin endpoints are CLOSED to everyone (fail-safe default). The env var
    # is ``GHOST_ADMIN_TOKEN`` (see ``.env`` / deploy-firebase.sh), so the
    # explicit alias is required for the bare field name to pick it up.
    admin_token: str = Field(
        default="",
        validation_alias=AliasChoices("GHOST_ADMIN_TOKEN", "ADMIN_TOKEN", "admin_token"),
    )

    # ------------------------------------------------------------------
    # Owner / Super-Admin panel (/admin). A SEPARATE auth domain from the
    # operator API: email + password + TOTP 2FA, signed into short-lived
    # JWTs. ``admin_jwt_secret`` (env ``GHOST_ADMIN_JWT_SECRET``) signs the
    # access/refresh tokens — if unset, a value is derived from the Fernet
    # master key so a fresh install still works, but a dedicated secret is
    # strongly recommended in production. TTLs are deliberately short.
    # ------------------------------------------------------------------
    admin_jwt_secret: str = Field(
        default="",
        validation_alias=AliasChoices("GHOST_ADMIN_JWT_SECRET", "ADMIN_JWT_SECRET", "admin_jwt_secret"),
    )
    admin_access_ttl_minutes: int = 30
    admin_refresh_ttl_days: int = 7
    # Password step throttle: lock the account for ``admin_lockout_minutes``
    # after this many consecutive failed password attempts.
    admin_max_failed_logins: int = 5
    admin_lockout_minutes: int = 15

    # Persistent owner seed. When BOTH are set, the backend ensures an owner
    # admin with this email exists on startup (created ONLY if missing — an
    # existing account's password is NEVER overwritten). Lets the Super-Admin
    # survive a fresh DB / new environment without a manual CLI step. The
    # password lives in env / Secret Manager, never in source.
    admin_owner_email: str = Field(
        default="",
        validation_alias=AliasChoices("GHOST_OWNER_EMAIL", "ADMIN_OWNER_EMAIL", "admin_owner_email"),
    )
    admin_owner_password: str = Field(
        default="",
        validation_alias=AliasChoices("GHOST_OWNER_PASSWORD", "ADMIN_OWNER_PASSWORD", "admin_owner_password"),
    )

    def effective_admin_jwt_secret(self) -> str:
        """The signing secret for admin JWTs. Falls back to a value derived
        from the Fernet master key so the panel works out of the box, while a
        dedicated ``GHOST_ADMIN_JWT_SECRET`` remains the recommended override."""
        explicit = (self.admin_jwt_secret or "").strip()
        if explicit:
            return explicit
        import hashlib

        return hashlib.sha256(
            (self.ghost_master_key + "::admin-jwt").encode("utf-8")
        ).hexdigest()

    database_path: str = "./data/ghost.db"
    chroma_path: str = "./data/chroma"
    upload_path: str = "./data/uploads"

    host: str = "127.0.0.1"
    port: int = 8000

    # ------------------------------------------------------------------
    # Observability. ``sentry_dsn`` (env ``SENTRY_DSN``) enables error
    # reporting when set AND the optional ``sentry-sdk`` package is
    # installed — otherwise it's a no-op. ``environment`` tags events and
    # logs (development / staging / production).
    # ------------------------------------------------------------------
    sentry_dsn: str = ""
    environment: str = "development"

    # ------------------------------------------------------------------
    # Vision model — single source of truth for every OpenAI call that
    # ships an image (chat, alerts, quick/deep tracking, structured
    # fallback, collage analysis). Defaults to the most capable vision
    # model available on the OpenAI API. Override via the
    # ``GHOST_VISION_MODEL`` environment variable when a cheaper tier
    # is preferred for cost-sensitive deployments.
    # ------------------------------------------------------------------
    vision_model: str = "gpt-5"
    # Ghost Expert mode — the operator's "intelligence advisor" interrogation
    # and the structured 8-tasks/8-alerts recommendation pass. Uses the most
    # capable model available; defaults to the flagship vision model so a
    # single ``GHOST_VISION_MODEL`` override still controls the top tier.
    # Override independently via ``GHOST_EXPERT_MODEL`` when desired.
    expert_model: str = Field(
        default="",
        validation_alias=AliasChoices("GHOST_EXPERT_MODEL", "EXPERT_MODEL", "expert_model"),
    )

    def effective_expert_model(self) -> str:
        return (self.expert_model or "").strip() or self.vision_model
    # Detail level passed to ``image_url.detail`` for every vision call.
    # ``"high"`` tiles the image into 512x512 patches and gives the model
    # the maximum visual context OpenAI exposes. ``"low"`` is one tile
    # and ~10x cheaper but loses detail. We default to ``"high"`` so the
    # model never silently downgrades quality.
    vision_image_detail: str = "high"

    # ------------------------------------------------------------------
    # Alert pipeline — latency-tuned defaults.
    #
    # Alerts are a binary "is this rule satisfied?" check, not a forensic
    # scene description, so they ship a much cheaper/faster vision model
    # with ``detail="low"`` by default. End-to-end target is <=2.8s from
    # the moment an object enters the frame to the SSE push reaching the
    # operator UI. With these defaults a single scan typically runs in
    # ~700-1500ms, well under budget alongside the frontend's 300ms loop
    # cadence.
    #
    # Override via ``GHOST_ALERT_VISION_*`` env vars when a deployment
    # genuinely needs maximum-fidelity rule matching (e.g. license plate
    # rules) — but expect the latency budget to grow accordingly.
    # ------------------------------------------------------------------
    alert_vision_model: str = "gpt-4o-mini"
    alert_vision_image_detail: str = "low"
    alert_vision_max_tokens: int = 220
    # Hard timeout (seconds) on the alert vision call. The end-to-end
    # budget is 1.8s from frame sample to the flashing overlay; with
    # ~300ms of snapshot/blur/encode/network overhead the model call must
    # return in well under ~1.5s. A blocked/slow call is failed fast and
    # reported as a no-match so the frontend immediately re-scans instead
    # of stalling on a single hung request. Override via
    # ``GHOST_ALERT_VISION_TIMEOUT_SECONDS``.
    alert_vision_timeout_seconds: float = 1.4

    # ------------------------------------------------------------------
    # Object Tracking — local YOLO + collage batch analysis
    # ------------------------------------------------------------------
    # Path / name of the YOLO weights file. Ultralytics auto-downloads
    # the weights into ``data/models`` on first use if missing.
    yolo_model_name: str = "yolov8n.pt"
    yolo_models_dir: str = "./data/models"
    # Confidence threshold below which YOLO results are dropped before
    # crop dedupe / enqueue.
    yolo_confidence_threshold: float = 0.35
    # Pixels of padding added around each YOLO bbox before cropping
    # (clamped to frame bounds).
    yolo_crop_padding_px: int = 8
    # Maximum side length after YOLO downscale — keeps inference fast on
    # CPU/Apple Silicon. Frames larger than this are letterboxed by the
    # ultralytics runtime.
    yolo_inference_imgsz: int = 640

    # Cooldown window (seconds) used by the dedupe key
    # (camera + class + centroid bucket). A duplicate detection inside
    # this window does NOT enqueue a new crop. 180s == suppress the same
    # subject for 3 minutes between detections, so a person sitting in
    # front of the camera is not re-sent to the API.
    detection_dedupe_cooldown_seconds: int = 180
    # Centroid bucket size (in pixels) used for dedupe — a smaller value
    # means stricter "same place" matching. 160px keeps a person's
    # natural sway inside a single region bucket (the "region" arm of the
    # hybrid dedupe) so it does not produce a fresh signature each frame.
    detection_dedupe_centroid_bucket_px: int = 160

    # Default batch target — how many crops the queue collects before
    # it auto-flushes a collage to Ghost Vision.
    detection_batch_target_default: int = 8
    # Hard upper bound on batch size. Both the API and the UI clamp to
    # this value; do not raise lightly because the collage tile size
    # scales inversely with the count.
    detection_batch_target_max: int = 88
    # Long-term retention for ``detected_objects`` (the tracking memory).
    # Rows older than this many days are pruned after each batch flush so
    # the upload tree doesn't grow forever — but everything inside the
    # window survives, which is what lets Ghost recall and report sightings
    # from days/weeks ago (not just the latest handful).
    detection_retention_days: int = 30
    # Collage tile dimensions (square) — every crop is resized to this
    # before placement.
    detection_collage_tile_px: int = 224
    # Pixels of padding between tiles on the collage canvas.
    detection_collage_tile_padding_px: int = 8

    # ------------------------------------------------------------------
    # Fast Path / Enrichment Path (feature-flagged rollout)
    # ------------------------------------------------------------------
    # When enabled, a novel high-confidence detection creates a
    # ``detected_objects`` card immediately (``source='fast_yolo'``,
    # ``enrichment_status='pending_enrichment'``) and returns it in the
    # ``/scan`` response, BEFORE the Ghost Vision collage analysis runs.
    # The Vision pass then enriches that same card asynchronously. Off by
    # default so the legacy "card only after Vision" behaviour stays the
    # rollback target — flip to True to roll the feature out.
    tracking_fast_cards_enabled: bool = False
    # When enabled, ``/scan`` responses carry a ``trace_id`` and a
    # per-stage ``timings`` map (yolo/dedupe/persist/response) so the
    # operator can measure the real Fast Path latency budget. Pure
    # diagnostics — leave off in normal operation.
    detection_trace_timings_enabled: bool = False

    # ------------------------------------------------------------------
    # Local visual deduplication gate (HSV histogram + dHash, 3 minute
    # window). Runs *before* the pending crop is written to disk and
    # enqueued, so duplicate subjects are never sent to Ghost Vision.
    # ------------------------------------------------------------------
    detection_visual_dedupe_enabled: bool = True
    # Cooldown horizon for fingerprint comparison; matches across the
    # combined window of detection_pending_crops + detected_objects.
    # Aligned to the 3-minute (180s) signature window so both dedupe arms
    # share a single "presence window" source of truth.
    detection_visual_dedupe_window_seconds: int = 180
    # Cosine similarity threshold over the 72-bin HSV histogram. Raise
    # toward 1.0 to be stricter (fewer matches), lower to be looser.
    detection_visual_dedupe_hist_threshold: float = 0.92
    # Maximum Hamming distance over the 64-bit dHash that still counts
    # as a structural match. Lower = stricter.
    detection_visual_dedupe_hash_threshold: int = 12
    # Pixel-structure gate: zero-mean normalised cross-correlation (NCC)
    # over a 16x16 grayscale thumbnail of the crop. A candidate scoring
    # at or above this value is treated as the SAME subject on its own,
    # independent of the colour histogram. 0.80 == "pixel structure 80%+
    # identical". This is the primary gate that collapses a static
    # subject (e.g. a person sitting still) down to a single queued crop,
    # and is invariant to small lighting/brightness shifts. Raise toward
    # 1.0 to be stricter (more frames sent), lower to be looser.
    detection_visual_dedupe_structure_threshold: float = 0.80

    def ensure_directories(self) -> None:
        for p in (self.database_path, self.chroma_path, self.upload_path):
            Path(p).parent.mkdir(parents=True, exist_ok=True)
        Path(self.chroma_path).mkdir(parents=True, exist_ok=True)
        Path(self.upload_path).mkdir(parents=True, exist_ok=True)
        Path(self.yolo_models_dir).mkdir(parents=True, exist_ok=True)


_PLACEHOLDER_MASTER_KEY = "change-me-to-a-random-fernet-key"


def assert_master_key_safe() -> None:
    """Fail fast at startup if the Fernet master key is missing, the shipped
    placeholder, or not a structurally valid Fernet key.

    Operator API keys are encrypted at rest with this key. Booting with the
    placeholder would silently encrypt secrets under a value that is public in
    the source tree, so we refuse to start instead.
    """
    key = (settings.ghost_master_key or "").strip()
    if not key or key == _PLACEHOLDER_MASTER_KEY:
        raise RuntimeError(
            "GHOST_MASTER_KEY is unset or the shipped placeholder. Generate one "
            "with `python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` and set it via the "
            "GHOST_MASTER_KEY environment variable / Secret Manager."
        )
    try:
        from cryptography.fernet import Fernet

        Fernet(key.encode())
    except Exception as exc:  # noqa: BLE001 - surfaced as a fatal startup error
        raise RuntimeError(
            "GHOST_MASTER_KEY is not a valid Fernet key (expected 44-char "
            "url-safe base64). Regenerate it with Fernet.generate_key()."
        ) from exc


settings = Settings()


# ----------------------------------------------------------------------
# Answer accuracy tiers — maps the per-conversation ``accuracy_level``
# (1-4, operator-selectable in Settings) to an OpenAI chat model. A
# higher level means a stronger and more expensive model. Level 4
# resolves to ``settings.vision_model`` so the ``GHOST_VISION_MODEL``
# env override still controls the top tier, and so the historical
# behaviour (every chat on the flagship model) is preserved by default.
# All four are vision-capable because a chat turn may carry an image.
# ----------------------------------------------------------------------
def model_for_accuracy(level: int | None) -> str:
    return {
        1: "gpt-4o-mini",
        2: "gpt-4o",
        3: "gpt-5-mini",
        4: settings.vision_model,
    }.get(level or 4, settings.vision_model)


# ----------------------------------------------------------------------
# Response length tiers — maps the per-conversation ``response_length``
# knob (operator-selectable in Advanced settings) to the model output
# cap (``max_tokens``). A shorter cap means the reply wraps up sooner,
# which lowers latency; ``long`` preserves the historical 4096 cap so the
# default behaviour is unchanged.
# ----------------------------------------------------------------------
def max_tokens_for_length(response_length: str | None) -> int:
    return {
        "short": 600,
        "medium": 1500,
        "long": 4096,
    }.get(response_length or "long", 4096)


# ----------------------------------------------------------------------
# Answer-scope token caps — enforce a SHORT, on-point reply when the
# operator asked a narrow question (``specific``) or sent a general
# "what do you see" prompt (``open``). These caps are applied *on top of*
# ``max_tokens_for_length`` via ``min(...)`` so the operator's response-
# length preference can only ever make a reply shorter, never longer than
# the scope allows. ``describe`` (explicit full-breakdown request) keeps
# the full length budget. ``vague`` is short-circuited before the model is
# called, so it has no cap here.
# ----------------------------------------------------------------------
_INTENT_TOKEN_CAP = {
    "specific": 350,
    "open": 200,
}


def cap_tokens_for_intent(intent: str | None, base_max_tokens: int) -> int:
    """Clamp ``base_max_tokens`` down to the per-intent cap when one applies.

    ``describe`` and any unknown intent return ``base_max_tokens`` unchanged so
    the historical full-length behaviour is preserved."""
    cap = _INTENT_TOKEN_CAP.get(intent or "")
    if cap is None:
        return base_max_tokens
    return min(base_max_tokens, cap)


# ----------------------------------------------------------------------
# Image detail tiers — normalises the per-conversation ``image_detail``
# knob to a value accepted by the vision call. ``high`` tiles the frame
# for maximum detail (historical default); ``low`` is a single coarse
# pass that is ~10x cheaper and noticeably faster.
# ----------------------------------------------------------------------
def normalize_image_detail(image_detail: str | None) -> str:
    value = (image_detail or "").lower()
    return value if value in ("low", "high") else "high"


# ----------------------------------------------------------------------
# Model pricing — USD per 1,000,000 tokens, used by the admin cost
# dashboard to translate captured token usage into dollars. These are
# APPROXIMATE list prices and are intentionally easy to edit in one place;
# they are a management estimate, not a billing source of truth. Unknown
# models fall back to ``_DEFAULT_PRICE`` so cost is never silently zero.
# ----------------------------------------------------------------------
_MODEL_PRICES_PER_M = {
    "gpt-5": {"input": 1.25, "output": 10.0},
    "gpt-5-mini": {"input": 0.25, "output": 2.0},
    "gpt-4o": {"input": 2.5, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "text-embedding-3-small": {"input": 0.02, "output": 0.0},
    "text-embedding-3-large": {"input": 0.13, "output": 0.0},
}
_DEFAULT_PRICE = {"input": 1.0, "output": 3.0}


def estimate_cost_usd(model: str | None, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate the USD cost of a single model call from its token counts.

    Matches on a model-name prefix so dated variants (e.g. ``gpt-4o-2024-…``)
    still resolve. Returns a non-negative float rounded to 6 decimals."""
    name = (model or "").lower()
    price = _DEFAULT_PRICE
    # Match the MOST specific (longest) known prefix first so e.g.
    # "gpt-4o-mini" is not shadowed by "gpt-4o", or "gpt-5-mini" by "gpt-5".
    for known in sorted(_MODEL_PRICES_PER_M, key=len, reverse=True):
        if name.startswith(known):
            price = _MODEL_PRICES_PER_M[known]
            break
    cost = (max(0, prompt_tokens) / 1_000_000) * price["input"] + (
        max(0, completion_tokens) / 1_000_000
    ) * price["output"]
    return round(cost, 6)
