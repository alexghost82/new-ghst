from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

# Allowed enum values for the structured-character knobs. Anything outside the
# set is coerced to "" (== "no preference") so a bad client payload can never
# inject free text into these tightly-scoped fields.
_PERSONA_TONES = {"terse", "friendly", "formal"}
_PROACTIVITY = {"on_demand", "flag_anomalies", "continuous"}
_OPERATOR_PROFILES = {"guard", "shift_manager", "owner"}
_CONTACT_SEVERITIES = {"critical", "important"}
# Hard caps so the composed character block can never blow the prompt budget.
_MAX_CONTACTS = 10
_MAX_TEXT_FIELD = 2000

logger = logging.getLogger("ghost.store.conversation")


def create_conversation(
    db: sqlite3.Connection,
    user_id: str,
    title: str = "",
    system_prompt: str = "",
    origin_ip: str | None = None,
    lead_name: str | None = None,
    lead_email: str | None = None,
    lead_phone: str | None = None,
    title_source: str = "default",
) -> dict:
    conv_id = uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO conversations (id, user_id, title, system_prompt, message_count, created_at, updated_at, origin_ip, lead_name, lead_email, lead_phone, title_source) "
        "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)",
        (
            conv_id,
            user_id,
            title,
            system_prompt,
            now,
            now,
            origin_ip,
            lead_name,
            lead_email,
            lead_phone,
            title_source,
        ),
    )
    db.commit()
    logger.info("Created conversation %s for user %s", conv_id, user_id)
    return {
        "id": conv_id,
        "user_id": user_id,
        "title": title,
        "system_prompt": system_prompt,
        "message_count": 0,
        "created_at": now,
        "updated_at": now,
        "camera_count": 0,
        "alert_mode_enabled": False,
        "tracking_enabled": False,
        "accuracy_level": 4,
        "response_length": "long",
        "image_detail": "high",
        "lead_name": lead_name,
        "lead_email": lead_email,
        "lead_phone": lead_phone,
        "title_source": title_source,
        "agent_name": "",
        "role_mission": "",
        "site_type": "",
        "focus_priorities": "",
        "ignore_scope": "",
        "site_baseline": "",
        "persona_tone": "",
        "dry_humor": False,
        "proactivity": "",
        "operator_profile": "",
        "critical_event_definition": "",
        "escalation_contacts": [],
        "quiet_hours": "",
    }


def _clean_text(value: str | None) -> str:
    """Trim and length-cap a free-text character field."""
    if not value:
        return ""
    return str(value)[:_MAX_TEXT_FIELD].strip()


def _normalize_escalation_contacts(contacts: object) -> str:
    """Validate the escalation-contacts list and serialise it to JSON.

    Each contact is reduced to ``{name, role, phone, min_severity}`` with safe
    string lengths and a whitelisted severity. Invalid entries are dropped, the
    whole list is capped, and the result is stored as a JSON string."""
    if not isinstance(contacts, list):
        return "[]"
    cleaned: list[dict] = []
    for raw in contacts[:_MAX_CONTACTS]:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name") or "")[:120].strip()
        phone = str(raw.get("phone") or "")[:64].strip()
        if not name and not phone:
            continue
        role = str(raw.get("role") or "")[:120].strip()
        severity = raw.get("min_severity")
        if severity not in _CONTACT_SEVERITIES:
            severity = "critical"
        cleaned.append(
            {
                "name": name,
                "role": role,
                "phone": phone,
                "min_severity": severity,
            }
        )
    return json.dumps(cleaned, ensure_ascii=False)


def _row_to_conversation(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["alert_mode_enabled"] = bool(data.get("alert_mode_enabled", 0))
    data["tracking_enabled"] = bool(data.get("tracking_enabled", 0))
    data["accuracy_level"] = int(data.get("accuracy_level", 4) or 4)
    data["response_length"] = data.get("response_length") or "long"
    data["image_detail"] = data.get("image_detail") or "high"
    data["title_source"] = data.get("title_source") or "default"
    # --- Ghost Character (structured persona) -----------------------------
    data["agent_name"] = data.get("agent_name") or ""
    data["role_mission"] = data.get("role_mission") or ""
    data["site_type"] = data.get("site_type") or ""
    data["focus_priorities"] = data.get("focus_priorities") or ""
    data["ignore_scope"] = data.get("ignore_scope") or ""
    data["site_baseline"] = data.get("site_baseline") or ""
    data["persona_tone"] = data.get("persona_tone") or ""
    data["dry_humor"] = bool(data.get("dry_humor", 0))
    data["proactivity"] = data.get("proactivity") or ""
    data["operator_profile"] = data.get("operator_profile") or ""
    data["critical_event_definition"] = data.get("critical_event_definition") or ""
    raw_contacts = data.get("escalation_contacts")
    try:
        parsed = json.loads(raw_contacts) if raw_contacts else []
    except (TypeError, ValueError):
        parsed = []
    data["escalation_contacts"] = parsed if isinstance(parsed, list) else []
    data["quiet_hours"] = data.get("quiet_hours") or ""
    return data


def list_conversations(
    db: sqlite3.Connection,
    user_id: str,
    origin_ip: str | None = None,
) -> list[dict]:
    base_select = (
        "SELECT c.id, c.user_id, c.title, c.system_prompt, c.message_count, "
        "       c.created_at, c.updated_at, c.alert_mode_enabled, "
        "       c.tracking_enabled, c.accuracy_level, "
        "       c.response_length, c.image_detail, c.title_source, "
        "       c.lead_name, c.lead_email, c.lead_phone, "
        "       c.agent_name, c.role_mission, c.site_type, "
        "       c.focus_priorities, c.ignore_scope, c.site_baseline, "
        "       c.persona_tone, c.dry_humor, c.proactivity, "
        "       c.operator_profile, c.critical_event_definition, "
        "       c.escalation_contacts, c.quiet_hours, "
        "       COALESCE((SELECT COUNT(*) FROM conversation_cameras cc "
        "                 WHERE cc.conversation_id = c.id), 0) AS camera_count "
        "FROM conversations c WHERE c.user_id = ? "
    )
    if origin_ip is not None:
        # IP-scoped listing (trial sessions): only conversations created from
        # this same client IP are visible.
        rows = db.execute(
            base_select + "AND c.origin_ip = ? ORDER BY c.updated_at DESC",
            (user_id, origin_ip),
        ).fetchall()
    else:
        rows = db.execute(
            base_select + "ORDER BY c.updated_at DESC",
            (user_id,),
        ).fetchall()
    return [_row_to_conversation(r) for r in rows]


def get_conversation(
    db: sqlite3.Connection, conversation_id: str, user_id: str | None = None
) -> dict | None:
    base_select = (
        "SELECT c.id, c.user_id, c.title, c.system_prompt, c.message_count, "
        "       c.created_at, c.updated_at, c.alert_mode_enabled, "
        "       c.tracking_enabled, c.accuracy_level, "
        "       c.response_length, c.image_detail, c.title_source, "
        "       c.lead_name, c.lead_email, c.lead_phone, "
        "       c.agent_name, c.role_mission, c.site_type, "
        "       c.focus_priorities, c.ignore_scope, c.site_baseline, "
        "       c.persona_tone, c.dry_humor, c.proactivity, "
        "       c.operator_profile, c.critical_event_definition, "
        "       c.escalation_contacts, c.quiet_hours, "
        "       COALESCE((SELECT COUNT(*) FROM conversation_cameras cc "
        "                 WHERE cc.conversation_id = c.id), 0) AS camera_count "
        "FROM conversations c "
    )
    if user_id:
        row = db.execute(
            base_select + "WHERE c.id = ? AND c.user_id = ?",
            (conversation_id, user_id),
        ).fetchone()
    else:
        row = db.execute(
            base_select + "WHERE c.id = ?",
            (conversation_id,),
        ).fetchone()
    return _row_to_conversation(row) if row else None


def update_conversation(
    db: sqlite3.Connection,
    conversation_id: str,
    title: str | None = None,
    system_prompt: str | None = None,
    accuracy_level: int | None = None,
    response_length: str | None = None,
    image_detail: str | None = None,
    title_source: str | None = None,
    *,
    agent_name: str | None = None,
    role_mission: str | None = None,
    site_type: str | None = None,
    focus_priorities: str | None = None,
    ignore_scope: str | None = None,
    site_baseline: str | None = None,
    persona_tone: str | None = None,
    dry_humor: bool | None = None,
    proactivity: str | None = None,
    operator_profile: str | None = None,
    critical_event_definition: str | None = None,
    escalation_contacts: object | None = None,
    quiet_hours: str | None = None,
) -> dict | None:
    now = datetime.now(timezone.utc).isoformat()
    updates: list[str] = []
    params: list[object] = []

    if title is not None:
        updates.append("title = ?")
        params.append(title)
    if title_source is not None:
        updates.append("title_source = ?")
        params.append(title_source)
    if system_prompt is not None:
        updates.append("system_prompt = ?")
        params.append(system_prompt)
    if accuracy_level is not None:
        updates.append("accuracy_level = ?")
        params.append(accuracy_level)
    if response_length is not None:
        updates.append("response_length = ?")
        params.append(response_length)
    if image_detail is not None:
        updates.append("image_detail = ?")
        params.append(image_detail)

    # --- Ghost Character (structured persona) -----------------------------
    if agent_name is not None:
        updates.append("agent_name = ?")
        params.append(_clean_text(agent_name)[:120])
    if role_mission is not None:
        updates.append("role_mission = ?")
        params.append(_clean_text(role_mission))
    if site_type is not None:
        updates.append("site_type = ?")
        params.append(_clean_text(site_type)[:80])
    if focus_priorities is not None:
        updates.append("focus_priorities = ?")
        params.append(_clean_text(focus_priorities))
    if ignore_scope is not None:
        updates.append("ignore_scope = ?")
        params.append(_clean_text(ignore_scope))
    if site_baseline is not None:
        updates.append("site_baseline = ?")
        params.append(_clean_text(site_baseline))
    if persona_tone is not None:
        updates.append("persona_tone = ?")
        params.append(persona_tone if persona_tone in _PERSONA_TONES else "")
    if dry_humor is not None:
        updates.append("dry_humor = ?")
        params.append(1 if dry_humor else 0)
    if proactivity is not None:
        updates.append("proactivity = ?")
        params.append(proactivity if proactivity in _PROACTIVITY else "")
    if operator_profile is not None:
        updates.append("operator_profile = ?")
        params.append(operator_profile if operator_profile in _OPERATOR_PROFILES else "")
    if critical_event_definition is not None:
        updates.append("critical_event_definition = ?")
        params.append(_clean_text(critical_event_definition))
    if escalation_contacts is not None:
        updates.append("escalation_contacts = ?")
        params.append(_normalize_escalation_contacts(escalation_contacts))
    if quiet_hours is not None:
        updates.append("quiet_hours = ?")
        params.append(_clean_text(quiet_hours)[:64])

    if not updates:
        return get_conversation(db, conversation_id)

    updates.append("updated_at = ?")
    params.append(now)
    params.append(conversation_id)

    db.execute(
        f"UPDATE conversations SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    db.commit()
    return get_conversation(db, conversation_id)


def delete_conversation(db: sqlite3.Connection, conversation_id: str) -> bool:
    cursor = db.execute(
        "DELETE FROM conversations WHERE id = ?", (conversation_id,)
    )
    db.commit()
    deleted = cursor.rowcount > 0
    if deleted:
        logger.info("Deleted conversation %s", conversation_id)
    return deleted


def increment_message_count(db: sqlite3.Connection, conversation_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?",
        (now, conversation_id),
    )
    db.commit()
