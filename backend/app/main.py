from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import assert_master_key_safe, settings
from app.dependencies import set_vector_store
from app.routes import (
    alerts,
    applications,
    automations,
    cameras,
    chat,
    conversations,
    detection,
    downloads,
    expert,
    health,
    incidents,
    knowledge,
    tasks,
    users,
)
from app.routes.admin import router as admin_router
from app.storage.database import run_migrations
from app.storage.vector_store import VectorStore

# Per-request correlation id, surfaced in every log line and the
# X-Request-ID response header so a single request can be traced end-to-end.
_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id_ctx.get()
        return True


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s [%(request_id)s]: %(message)s",
)
for _h in logging.getLogger().handlers:
    _h.addFilter(_RequestIdFilter())
logger = logging.getLogger("ghost")


def _init_sentry() -> None:
    """Initialise Sentry error reporting if a DSN is configured and the
    optional ``sentry-sdk`` package is installed. No-op otherwise."""
    dsn = (settings.sentry_dsn or "").strip()
    if not dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=dsn,
            environment=settings.environment,
            traces_sample_rate=0.0,
            send_default_pii=False,
        )
        logger.info("Sentry error reporting enabled (env=%s)", settings.environment)
    except Exception:  # noqa: BLE001 - observability must never block boot
        logger.warning("Sentry DSN set but sentry-sdk unavailable; skipping", exc_info=True)


_init_sentry()


def _seed_owner_admin() -> None:
    """Create the persistent owner admin from env if it doesn't exist yet.

    Never overwrites an existing account (so a rotated password set via the CLI
    survives reboots). Best-effort: a failure here must not block boot."""
    email = (settings.admin_owner_email or "").strip().lower()
    password = settings.admin_owner_password or ""
    if not email or not password:
        return
    try:
        from app.services.admin_auth_service import hash_password
        from app.storage.admin_store import create_admin, get_admin_by_email
        from app.storage.database import get_db

        db = get_db()
        try:
            if get_admin_by_email(db, email):
                return  # already provisioned — leave password untouched
            create_admin(
                db,
                email=email,
                password_hash=hash_password(password),
                role="owner",
                display_name="Owner",
                created_by="env-seed",
            )
            logger.info("Seeded owner admin %s from environment", email)
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - seeding must never block startup
        logger.warning("Owner-admin seed failed", exc_info=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Refuse to boot with an unsafe encryption key — operator API keys are
    # encrypted at rest with it, so a placeholder/invalid key is fatal.
    assert_master_key_safe()
    settings.ensure_directories()
    logger.info("Running database migrations …")
    run_migrations()
    # Sweep dead magic-login tokens on boot so the table can't grow forever.
    try:
        from app.storage.database import get_db
        from app.storage.magic_link_store import purge_expired_magic_tokens

        _db = get_db()
        try:
            removed = purge_expired_magic_tokens(_db)
            if removed:
                logger.info("Purged %d expired magic-login tokens", removed)
        finally:
            _db.close()
    except Exception:  # noqa: BLE001 - cleanup is best-effort
        logger.warning("Magic-token cleanup failed", exc_info=True)
    # Ensure the persistent Super-Admin owner exists (created only if missing;
    # an existing account's password is never overwritten). Requires both
    # GHOST_OWNER_EMAIL and GHOST_OWNER_PASSWORD to be set.
    _seed_owner_admin()

    logger.info("Initialising ChromaDB at %s", settings.chroma_path)
    set_vector_store(VectorStore(settings.chroma_path))

    # Surface server-side credential gaps loudly at boot. These are supplied via
    # GHOST_-prefixed env vars; a name/alias mismatch used to leave them silently
    # empty, breaking the public demo/trial flow and closing the admin endpoints
    # with no obvious signal. Warn (don't fail) so a dev box without a demo key
    # still boots.
    if not (settings.demo_api_key or "").strip():
        logger.warning(
            "GHOST_DEMO_API_KEY is not set — the public demo/trial flow "
            "(/users/demo/*) will return DEMO_UNAVAILABLE."
        )
    if not (settings.admin_token or "").strip():
        logger.warning(
            "GHOST_ADMIN_TOKEN is not set — admin/PII endpoints "
            "(trial roster, leads, magic-link minting) are CLOSED."
        )

    yield

    logger.info("Shutting down Ghost backend")
    # Stop the alert queue's background workers so a reload/redeploy does not
    # orphan in-flight scans.
    try:
        from app.services import alert_queue as _aq

        if _aq._singleton is not None:
            await _aq._singleton.stop()
    except Exception:  # noqa: BLE001 - shutdown best-effort
        logger.warning("Alert queue shutdown failed", exc_info=True)


app = FastAPI(
    title="Ghost Internal Interface",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Behind Firebase Hosting rewrites the frontend and API share an origin,
    # so CORS is not strictly required in production. These entries cover the
    # local dev frontend and the Hosting domains as a safety net (e.g. direct
    # Cloud Run access or preview channels).
    allow_origins=[
        "http://localhost:8765",
        "http://localhost:8888",
        "https://localhost:8888",
        "https://ghst-rashi.web.app",
        "https://ghst-rashi.firebaseapp.com",
        "https://ghost-il.com",
        "https://www.ghost-il.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Ghost-Admin-Token"],
)


@app.middleware("http")
async def request_id_middleware(request, call_next):
    """Assign/propagate a correlation id for the request lifetime and echo it
    back as ``X-Request-ID`` so logs and clients can be cross-referenced."""
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    token = _request_id_ctx.set(rid)
    try:
        response = await call_next(request)
    finally:
        _request_id_ctx.reset(token)
    response.headers["X-Request-ID"] = rid
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    """Catch-all for genuinely unhandled (500-class) errors. ``GhostException``
    / ``HTTPException`` are handled by FastAPI's own handlers and never reach
    here, so this only fires on real bugs/crashes. Records the failure to the
    global error ledger (best-effort) and returns the standard error envelope.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    try:
        from app.services.error_service import record

        record(
            message=f"{type(exc).__name__}: {exc}",
            source="api",
            severity="high",
            route=request.url.path,
            exc=exc,
        )
    except Exception:  # noqa: BLE001 - never let error logging mask the error
        pass
    from starlette.responses import JSONResponse

    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
        },
    )


@app.middleware("http")
async def protect_uploaded_pii(request, call_next):
    """Block public access to uploaded job-application CVs (PII) on the static
    ``/uploads`` mount. Everything else under ``/uploads`` (camera frames,
    knowledge files) stays directly fetchable for the operator UI. Callers must
    present the admin token via header or ``?admin_token=``."""
    path = request.url.path
    if path.startswith("/uploads/applications/"):
        configured = (settings.admin_token or "").strip()
        presented = (
            request.headers.get("x-ghost-admin-token")
            or request.query_params.get("admin_token")
            or ""
        ).strip()
        import hmac as _hmac

        if not configured or not presented or not _hmac.compare_digest(configured, presented):
            from starlette.responses import JSONResponse

            return JSONResponse(
                status_code=403,
                content={"ok": False, "error": {"code": "ADMIN_FORBIDDEN", "message": "Admin authorization required"}},
            )
    return await call_next(request)

app.include_router(health.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(cameras.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(detection.router, prefix="/api")
app.include_router(downloads.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(automations.router, prefix="/api")
app.include_router(expert.router, prefix="/api")
app.include_router(admin_router, prefix="/api")

upload_dir = Path(settings.upload_path)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

frames_dir = upload_dir / "frames"
frames_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/frames", StaticFiles(directory=str(frames_dir)), name="frames")
