"""Storage for inbound job applications from the public Careers page.

Each application records the applicant's name + phone (required), an
optional email / role / message, and the stored CV file (path on disk
under the uploads dir, plus original filename, size and reported type).

Schema lives in ``migrations/019_job_applications.sql``.
"""
from __future__ import annotations

import logging
import sqlite3
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("ghost.store.application")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def record_application(
    db: sqlite3.Connection,
    *,
    name: str,
    phone: str,
    email: str | None = None,
    role: str | None = None,
    message: str | None = None,
    cv_filename: str | None = None,
    cv_path: str | None = None,
    cv_size: int | None = None,
    cv_type: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    """Persist a single job application and return the stored row."""
    application_id = uuid.uuid4().hex
    created_at = _now_iso()

    db.execute(
        """
        INSERT INTO job_applications (
            id, name, phone, email, role, message,
            cv_filename, cv_path, cv_size, cv_type,
            ip, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            application_id,
            name,
            phone,
            email,
            role,
            message,
            cv_filename,
            cv_path,
            cv_size,
            cv_type,
            ip,
            user_agent,
            created_at,
        ),
    )
    db.commit()
    logger.info(
        "Recorded job application %s from %s / %s for role %s",
        application_id,
        name,
        phone,
        role or "—",
    )

    return {
        "id": application_id,
        "name": name,
        "phone": phone,
        "email": email,
        "role": role,
        "message": message,
        "cv_filename": cv_filename,
        "cv_path": cv_path,
        "cv_size": cv_size,
        "cv_type": cv_type,
        "ip": ip,
        "user_agent": user_agent,
        "created_at": created_at,
    }


def list_applications(db: sqlite3.Connection, limit: int = 500) -> list[dict]:
    """Return job applications, newest first."""
    rows = db.execute(
        """
        SELECT id, name, phone, email, role, message,
               cv_filename, cv_path, cv_size, cv_type,
               ip, user_agent, created_at
        FROM job_applications
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]
