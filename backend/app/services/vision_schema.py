"""JSON Schema for structured scene analysis.

This schema is used as a fallback when the streaming chat completion produces a
refusal. With ``strict: true`` and every field marked required, the model is
forced to fill every slot — it cannot emit a refusal sentence in place of the
expected JSON object.

All optional values are typed as a union with ``"null"`` so the schema stays
``strict``-compatible while still allowing "not visible" answers.
"""

from __future__ import annotations

from typing import Any


def _str_or_null() -> dict[str, Any]:
    return {"type": ["string", "null"]}


def _int_or_null() -> dict[str, Any]:
    return {"type": ["integer", "null"]}


_PERSON_PROPERTIES: dict[str, Any] = {
    "id": {"type": "integer"},
    "age_category": {
        "type": "string",
        "enum": ["child", "teen", "young_adult", "adult", "older_adult", "unclear"],
    },
    "gender_presentation": {
        "type": "string",
        "enum": ["male_presenting", "female_presenting", "unclear"],
    },
    "build": {
        "type": "string",
        "enum": ["slim", "average", "heavy", "athletic", "unclear"],
    },
    "hair": _str_or_null(),
    "head_covering": _str_or_null(),
    "clothing_upper": {"type": "string"},
    "clothing_lower": {"type": "string"},
    "footwear": _str_or_null(),
    "accessories": {
        "type": "array",
        "items": {"type": "string"},
    },
    "carrying": _str_or_null(),
    "posture": {"type": "string"},
    "action": {"type": "string"},
    "direction": _str_or_null(),
    "position_in_frame": {"type": "string"},
    "interaction": _str_or_null(),
    "description": {"type": "string"},
}

_PERSON_REQUIRED = list(_PERSON_PROPERTIES.keys())


_VEHICLE_PROPERTIES: dict[str, Any] = {
    "id": {"type": "integer"},
    "type": {
        "type": "string",
        "enum": [
            "sedan",
            "suv",
            "pickup",
            "van",
            "truck",
            "motorcycle",
            "bicycle",
            "scooter",
            "other",
        ],
    },
    "color": {"type": "string"},
    "make_model_estimate": _str_or_null(),
    "license_plate": _str_or_null(),
    "license_plate_confidence": {
        "type": "string",
        "enum": ["clear", "partial", "not_visible"],
    },
    "position": {"type": "string"},
    "orientation": _str_or_null(),
    "motion_state": {
        "type": "string",
        "enum": ["parked", "moving", "reversing", "unclear"],
    },
    "occupants_visible": {"type": "boolean"},
    "cargo": _str_or_null(),
    "condition": _str_or_null(),
    "description": {"type": "string"},
}

_VEHICLE_REQUIRED = list(_VEHICLE_PROPERTIES.keys())


_ENVIRONMENT_PROPERTIES: dict[str, Any] = {
    "location_type": {
        "type": "string",
        "enum": [
            "indoor_residential",
            "indoor_commercial",
            "indoor_industrial",
            "outdoor_residential",
            "outdoor_commercial",
            "outdoor_industrial",
            "parking_area",
            "street",
            "perimeter",
            "unclear",
        ],
    },
    "lighting": {"type": "string"},
    "weather": _str_or_null(),
    "time_of_day_estimate": {
        "type": "string",
        "enum": ["day", "dusk", "night", "unclear"],
    },
    "visible_text_or_signage": _str_or_null(),
    "infrastructure_notes": _str_or_null(),
    "ground_surface": _str_or_null(),
    "anomalies": {
        "type": "array",
        "items": {"type": "string"},
    },
}

_ENVIRONMENT_REQUIRED = list(_ENVIRONMENT_PROPERTIES.keys())


VISION_ANALYSIS_SCHEMA: dict[str, Any] = {
    "name": "scene_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "scene_overview",
            "people_count",
            "people",
            "vehicles_count",
            "vehicles",
            "environment",
            "notes",
        ],
        "properties": {
            "scene_overview": {
                "type": "string",
                "description": (
                    "One short paragraph summarising the frame: location type, "
                    "time of day, overall activity level."
                ),
            },
            "people_count": {"type": "integer"},
            "people": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": _PERSON_REQUIRED,
                    "properties": _PERSON_PROPERTIES,
                },
            },
            "vehicles_count": {"type": "integer"},
            "vehicles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": _VEHICLE_REQUIRED,
                    "properties": _VEHICLE_PROPERTIES,
                },
            },
            "environment": {
                "type": "object",
                "additionalProperties": False,
                "required": _ENVIRONMENT_REQUIRED,
                "properties": _ENVIRONMENT_PROPERTIES,
            },
            "notes": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Free-form short observations relevant to site awareness — "
                    "movement patterns, anomalies, follow-up suggestions."
                ),
            },
        },
    },
}


def render_scene_analysis_markdown(analysis: dict[str, Any]) -> str:
    """Render a structured analysis dict as conversational prose, matching
    Ghost's human-voice style (no section headers, no empty categories).

    Used only on the refusal-fallback path; the streaming path produces this
    voice directly from the model. The two paths must feel identical to the
    operator — no one should be able to tell a reply came from the fallback.
    """

    paragraphs: list[str] = []

    overview = (analysis.get("scene_overview") or "").strip()
    if overview:
        paragraphs.append(overview)

    people = [p for p in (analysis.get("people") or []) if p]
    if people:
        people_paragraphs: list[str] = []
        if len(people) == 1:
            people_paragraphs.append(_format_person(people[0]))
        else:
            lines = [f"- {_format_person(p)}" for p in people]
            people_paragraphs.append("\n".join(lines))
        paragraphs.extend(pp for pp in people_paragraphs if pp.strip())

    vehicles = [v for v in (analysis.get("vehicles") or []) if v]
    if vehicles:
        vehicle_paragraphs: list[str] = []
        if len(vehicles) == 1:
            vehicle_paragraphs.append(_format_vehicle(vehicles[0]))
        else:
            lines = [f"- {_format_vehicle(v)}" for v in vehicles]
            vehicle_paragraphs.append("\n".join(lines))
        paragraphs.extend(vp for vp in vehicle_paragraphs if vp.strip())

    env_sentence = _format_environment_sentence(analysis.get("environment") or {})
    if env_sentence:
        paragraphs.append(env_sentence)

    notes = [str(n).strip() for n in (analysis.get("notes") or []) if str(n).strip()]
    if notes:
        paragraphs.append(" ".join(notes))

    body = "\n\n".join(p for p in paragraphs if p and p.strip())
    return (body + "\n") if body else ""


def _format_person(p: dict[str, Any]) -> str:
    """Prefer the model's free-form description (it carries the natural voice).

    Only assemble a sentence from structured fields when the description is
    missing or too thin — we don't want labelled English fragments like
    "Hair: short dark. Wearing dark gray hoodie." leaking into a human reply.
    """
    desc = (p.get("description") or "").strip()
    if len(desc) >= 25:
        return desc

    parts: list[str] = []
    if desc:
        parts.append(desc)

    age = p.get("age_category")
    gender = p.get("gender_presentation")
    build = p.get("build")
    descriptors: list[str] = []
    if age and age != "unclear":
        descriptors.append(age.replace("_", " "))
    if gender and gender != "unclear":
        descriptors.append(gender.replace("_", " "))
    if build and build != "unclear":
        descriptors.append(f"{build} build")
    if descriptors:
        parts.append(", ".join(descriptors) + ".")

    clothing_bits = [
        x.strip()
        for x in (p.get("clothing_upper"), p.get("clothing_lower"), p.get("footwear"))
        if x and str(x).strip()
    ]
    if clothing_bits:
        parts.append("Wearing " + ", ".join(clothing_bits) + ".")

    carrying = (p.get("carrying") or "").strip()
    accessories = [a for a in (p.get("accessories") or []) if a]
    holding_bits: list[str] = []
    if carrying:
        holding_bits.append(carrying)
    holding_bits.extend(accessories)
    if holding_bits:
        parts.append("With " + ", ".join(holding_bits) + ".")

    action = (p.get("action") or "").strip()
    posture = (p.get("posture") or "").strip()
    motion = " / ".join(x for x in (posture, action) if x)
    if motion:
        parts.append(motion + ".")

    position = (p.get("position_in_frame") or "").strip()
    if position:
        parts.append(position + ".")

    return " ".join(parts).strip()


def _format_vehicle(v: dict[str, Any]) -> str:
    """Same approach as ``_format_person`` — favour the free-form description
    when the model gave us one, only stitch labels otherwise."""
    desc = (v.get("description") or "").strip()
    if len(desc) >= 25:
        return desc

    parts: list[str] = []
    if desc:
        parts.append(desc)

    color = (v.get("color") or "").strip()
    vtype = (v.get("type") or "").strip()
    make = (v.get("make_model_estimate") or "").strip()
    head_bits = [b for b in (color, vtype, make) if b]
    if head_bits:
        parts.append(" ".join(head_bits) + ".")

    plate = (v.get("license_plate") or "").strip()
    plate_conf = v.get("license_plate_confidence")
    if plate and plate_conf == "clear":
        parts.append(f"Plate {plate}.")
    elif plate and plate_conf == "partial":
        parts.append(f"Plate partially readable, {plate}.")
    elif plate:
        parts.append(f"Plate {plate}.")

    position = (v.get("position") or "").strip()
    if position:
        parts.append(position + ".")

    motion = v.get("motion_state")
    if motion and motion != "unclear":
        parts.append(motion.capitalize() + ".")

    cargo = (v.get("cargo") or "").strip()
    if cargo:
        parts.append(f"Carrying {cargo}.")

    return " ".join(parts).strip()


def _format_environment_sentence(env: dict[str, Any]) -> str:
    """Compose a short, human-sounding sentence about the surroundings.

    Skips every field that's empty or marked ``unclear`` — silence is fine,
    and we never want the fallback to emit "no signage" / "no anomalies" style
    fillers.
    """
    bits: list[str] = []

    location = env.get("location_type")
    if location and location != "unclear":
        bits.append(location.replace("_", " "))

    tod = env.get("time_of_day_estimate")
    if tod and tod != "unclear":
        bits.append(tod)

    lighting = (env.get("lighting") or "").strip()
    if lighting:
        bits.append(lighting)

    weather = (env.get("weather") or "").strip()
    if weather:
        bits.append(weather)

    head = ", ".join(bits).strip()
    extras: list[str] = []

    ground = (env.get("ground_surface") or "").strip()
    if ground:
        extras.append(ground)

    infra = (env.get("infrastructure_notes") or "").strip()
    if infra:
        extras.append(infra)

    signage = (env.get("visible_text_or_signage") or "").strip()
    if signage:
        extras.append(signage)

    anomalies = [str(a).strip() for a in (env.get("anomalies") or []) if str(a).strip()]
    if anomalies:
        extras.append(", ".join(anomalies))

    pieces: list[str] = []
    if head:
        pieces.append(head + ".")
    pieces.extend(e if e.endswith(".") else e + "." for e in extras)
    return " ".join(pieces).strip()
