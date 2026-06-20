"""Public job-application intake for the Careers page.

``POST /applications`` is a multipart endpoint called from the public
Careers page. A visitor submits their name + mobile phone (required), an
optional email / role / message, and attaches a CV file. We store the CV
under ``<upload_path>/applications`` and persist an application row with
server-derived context (client IP, user-agent, timestamp).

``GET /applications`` returns the ledger for internal review.
"""
from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from app.dependencies import require_admin
from app.services.rate_limiter import rate_limit

from app.config import settings
from app.schemas.responses import GhostException, error_response, ok_response
from app.storage.application_store import list_applications, record_application
from app.storage.database import get_db

logger = logging.getLogger("ghost.routes.applications")
router = APIRouter(tags=["applications"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_DIGITS_RE = re.compile(r"\d")

# Accepted CV formats and a hard size ceiling so the public endpoint can't
# be used to dump arbitrary large files onto disk.
_ALLOWED_CV_EXTENSIONS = {".pdf", ".doc", ".docx", ".rtf", ".txt", ".odt"}
_MAX_CV_BYTES = 10 * 1024 * 1024  # 10 MB


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else None


def _safe_filename(name: str) -> str:
    """Reduce an uploaded filename to a safe, bounded basename."""
    base = Path(name).name
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return base[:120] or "cv"


@router.post(
    "/applications",
    dependencies=[Depends(rate_limit("applications", 6, 60))],
)
async def submit_application_endpoint(
    request: Request,
    name: str = Form(...),
    phone: str = Form(...),
    email: str | None = Form(None),
    role: str | None = Form(None),
    message: str | None = Form(None),
    cv: UploadFile | None = File(None),
):
    name = (name or "").strip()
    phone = (phone or "").strip()
    email = (email or "").strip() or None
    role = (role or "").strip() or None
    message = (message or "").strip() or None

    if not name:
        error_response("NAME_REQUIRED", "A name is required", 422)

    phone_digits = len(_PHONE_DIGITS_RE.findall(phone))
    if phone_digits < 7:
        error_response("PHONE_REQUIRED", "A valid mobile phone is required", 422)

    if email and not _EMAIL_RE.match(email):
        error_response("INVALID_EMAIL", "A valid email is required", 422)

    if cv is None or not (cv.filename or "").strip():
        error_response("CV_REQUIRED", "A CV file is required", 422)

    # Validate the CV: extension allow-list + size ceiling.
    original_name = (cv.filename or "cv").strip()
    extension = Path(original_name).suffix.lower()
    if extension not in _ALLOWED_CV_EXTENSIONS:
        error_response(
            "INVALID_CV_TYPE",
            "CV must be a PDF, Word, RTF, ODT, or text document",
            422,
        )

    contents = await cv.read()
    if len(contents) == 0:
        error_response("CV_EMPTY", "The uploaded CV is empty", 422)
    if len(contents) > _MAX_CV_BYTES:
        error_response("CV_TOO_LARGE", "CV must be 10 MB or smaller", 413)

    # Persist the file under <upload_path>/applications with a collision-proof
    # name (random prefix + sanitised original basename).
    applications_dir = Path(settings.upload_path) / "applications"
    applications_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}__{_safe_filename(original_name)}"
    stored_path = applications_dir / stored_name

    def _write_file() -> None:
        with open(stored_path, "wb") as fh:
            fh.write(contents)

    db = get_db()
    try:
        await run_in_threadpool(_write_file)

        application = record_application(
            db,
            name=name,
            phone=phone,
            email=email,
            role=role,
            message=message,
            cv_filename=original_name,
            cv_path=f"/uploads/applications/{stored_name}",
            cv_size=len(contents),
            cv_type=cv.content_type,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        return ok_response(application, status_code=201)
    except GhostException:
        raise
    except Exception:
        logger.exception("Failed to record job application")
        # Best-effort cleanup of a partially written CV.
        try:
            stored_path.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
        error_response(
            "APPLICATION_FAILED", "Failed to submit application", 500
        )
    finally:
        db.close()


@router.get("/applications", dependencies=[Depends(require_admin)])
async def list_applications_endpoint():
    db = get_db()
    try:
        return ok_response(list_applications(db))
    finally:
        db.close()
