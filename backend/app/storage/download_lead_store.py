"""Storage + enrichment for public document download leads.

When a visitor unlocks the enterprise architecture PDF on the public
Security Architecture page, we persist a small lead record: the email
they entered, the file, their client IP, browser user-agent, a precise
timestamp, and a best-effort reverse-geolocation of the IP.

The geolocation is *best effort only*. It calls a free public IP API
with a short timeout; if the call fails (offline / air-gapped install /
private IP), we simply store NULLs for the location columns. The lead is
always recorded regardless of whether enrichment succeeds.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import urllib.request
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("ghost.store.download_lead")

# Short, hard timeout so a slow / unreachable geo provider never holds up
# the visitor's download flow. Enrichment is a nice-to-have, not a gate.
_GEO_TIMEOUT_SECONDS = 2.0

# Private / loopback prefixes we never bother geolocating — they resolve
# to nothing useful and waste the timeout budget.
_PRIVATE_PREFIXES = (
    "127.",
    "10.",
    "192.168.",
    "::1",
    "localhost",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.2",  # 172.20-29
    "172.30.",
    "172.31.",
    "fe80:",
    "fc",
    "fd",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_private_ip(ip: str | None) -> bool:
    if not ip:
        return True
    return any(ip.startswith(prefix) for prefix in _PRIVATE_PREFIXES)


def geolocate_ip(ip: str | None) -> dict:
    """Best-effort reverse-geo of ``ip``.

    Returns a dict with country/region/city/latitude/longitude keys. Any
    field we cannot resolve comes back as ``None``. Never raises — a
    failed lookup just yields an all-``None`` dict.
    """
    empty = {
        "country": None,
        "region": None,
        "city": None,
        "latitude": None,
        "longitude": None,
    }
    if _is_private_ip(ip):
        return empty

    try:
        url = (
            f"http://ip-api.com/json/{ip}"
            "?fields=status,country,regionName,city,lat,lon"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Ghost/1.0"})
        with urllib.request.urlopen(req, timeout=_GEO_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        if payload.get("status") != "success":
            return empty
        return {
            "country": payload.get("country") or None,
            "region": payload.get("regionName") or None,
            "city": payload.get("city") or None,
            "latitude": payload.get("lat"),
            "longitude": payload.get("lon"),
        }
    except Exception as exc:  # noqa: BLE001 — enrichment must never break the flow
        logger.info("IP geolocation unavailable for %s: %s", ip, exc)
        return empty


def record_download(
    db: sqlite3.Connection,
    *,
    email: str,
    file: str,
    ip: str | None,
    user_agent: str | None,
    phone: str | None = None,
    name: str | None = None,
    company: str | None = None,
    geo: dict | None = None,
) -> dict:
    """Persist a single download lead and return the stored row.

    ``geo`` may be supplied by the caller (e.g. computed off the event
    loop). When omitted we leave the location columns NULL — callers
    that want enrichment should call :func:`geolocate_ip` first.

    ``email`` is stored as an empty string when the visitor unlocked with a
    phone number only (the column is ``NOT NULL`` for legacy compatibility).
    """
    geo = geo or {}
    lead_id = uuid.uuid4().hex
    created_at = _now_iso()

    db.execute(
        """
        INSERT INTO download_leads (
            id, email, phone, name, company, file, ip, user_agent,
            country, region, city, latitude, longitude, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            lead_id,
            email,
            phone,
            name,
            company,
            file,
            ip,
            user_agent,
            geo.get("country"),
            geo.get("region"),
            geo.get("city"),
            geo.get("latitude"),
            geo.get("longitude"),
            created_at,
        ),
    )
    db.commit()
    logger.info(
        "Recorded download lead %s for %s / %s from %s",
        lead_id,
        email or "—",
        phone or "—",
        ip,
    )

    return {
        "id": lead_id,
        "email": email,
        "phone": phone,
        "name": name,
        "company": company,
        "file": file,
        "ip": ip,
        "user_agent": user_agent,
        "country": geo.get("country"),
        "region": geo.get("region"),
        "city": geo.get("city"),
        "latitude": geo.get("latitude"),
        "longitude": geo.get("longitude"),
        "created_at": created_at,
    }


def _contact_key(email: str | None, phone: str | None) -> str:
    """Normalised identity for de-duplication / repeat counting.

    Prefers email; falls back to phone for phone-only leads.
    """
    if email:
        return f"email:{email.strip().lower()}"
    if phone:
        return f"phone:{phone.strip()}"
    return "unknown"


def list_downloads(db: sqlite3.Connection, limit: int = 500) -> list[dict]:
    """Return download leads, newest first.

    Also computes a ``download_count`` per contact (email, or phone for
    phone-only leads) so the UI can flag repeat downloaders at a glance.
    """
    rows = db.execute(
        """
        SELECT id, email, phone, name, company, file, ip, user_agent,
               country, region, city, latitude, longitude, created_at
        FROM download_leads
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    counts: dict[str, int] = {}
    for row in db.execute(
        "SELECT email, phone FROM download_leads"
    ).fetchall():
        key = _contact_key(row["email"], row["phone"])
        counts[key] = counts.get(key, 0) + 1

    result: list[dict] = []
    for row in rows:
        item = dict(row)
        key = _contact_key(row["email"], row["phone"])
        item["download_count"] = counts.get(key, 1)
        result.append(item)
    return result
