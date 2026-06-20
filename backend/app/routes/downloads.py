"""Public document-download lead capture + internal review endpoints.

``POST /downloads/track`` is called from the public Security Architecture
page when a visitor unlocks the enterprise PDF. It records the email plus
server-derived context (client IP, user-agent, best-effort geolocation,
timestamp).

``GET /downloads`` returns the full ledger for the hidden internal
"download management" view, including a per-email repeat-download count.
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, Request
from starlette.concurrency import run_in_threadpool

from app.dependencies import require_admin
from app.services.rate_limiter import rate_limit
from app.schemas.requests import TrackDownloadRequest
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.database import get_db
from app.storage.download_lead_store import (
    geolocate_ip,
    list_downloads,
    record_download,
)

logger = logging.getLogger("ghost.routes.downloads")
router = APIRouter(tags=["downloads"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
# Loose phone check — accepts +country prefixes, spaces, dashes, parens.
# We require at least 7 digits so a stray fragment can't unlock the gate.
_PHONE_DIGITS_RE = re.compile(r"\d")
_DEFAULT_FILE = "Ghost_Enterprise_Architecture.pdf"


def _client_ip(request: Request) -> str | None:
    """Resolve the best-effort client IP.

    Honours the first hop in ``X-Forwarded-For`` (set by a fronting
    proxy / tunnel) and falls back to the direct socket peer.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else None


@router.post(
    "/downloads/track",
    dependencies=[Depends(rate_limit("downloads_track", 12, 60))],
)
async def track_download_endpoint(req: TrackDownloadRequest, request: Request):
    email = (req.email or "").strip().lower()
    phone = (req.phone or "").strip()
    name = (req.name or "").strip() or None
    company = (req.company or "").strip() or None

    if email and not _EMAIL_RE.match(email):
        error_response("INVALID_EMAIL", "A valid email is required", 422)

    phone_digits = len(_PHONE_DIGITS_RE.findall(phone))
    has_phone = phone_digits >= 7

    if not email and not has_phone:
        error_response(
            "CONTACT_REQUIRED",
            "A valid email or mobile phone is required",
            422,
        )

    ip = _client_ip(request)
    user_agent = request.headers.get("user-agent")
    file = (req.file or _DEFAULT_FILE).strip() or _DEFAULT_FILE

    db = get_db()
    try:
        # Reverse-geo lookup is blocking I/O — keep it off the event loop.
        geo = await run_in_threadpool(geolocate_ip, ip)
        lead = record_download(
            db,
            email=email,
            phone=phone if has_phone else None,
            name=name,
            company=company,
            file=file,
            ip=ip,
            user_agent=user_agent,
            geo=geo,
        )
        return ok_response(lead, status_code=201)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to record download lead")
        error_response("DOWNLOAD_TRACK_FAILED", "Failed to record download", 500)
    finally:
        db.close()


@router.get("/downloads", dependencies=[Depends(require_admin)])
async def list_downloads_endpoint():
    db = get_db()
    try:
        return ok_response(list_downloads(db))
    finally:
        db.close()
