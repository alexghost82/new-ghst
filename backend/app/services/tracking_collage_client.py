"""Ghost Vision call for the local YOLO collage pipeline.

Lives in its own module so it can be imported safely from the detection
service without dragging in the heavy ``openai_client`` module surface,
and so the strict JSON schema can evolve without touching unrelated
schemas.

Always returns ``{"tiles": list[dict]}``. Never raises.
"""

from __future__ import annotations

import logging

from app.services.vision_provider import analyze_with_fallback

logger = logging.getLogger("ghost.tracking_collage")


TRACKING_COLLAGE_SCHEMA = {
    "name": "tracking_collage_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["tiles"],
        "properties": {
            "tiles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "tile_index",
                        "object_type",
                        "tracking_signature",
                        "confidence",
                        "deep_description",
                        "activity_description",
                        "position_description",
                        "distinctive_identifiers",
                        "person_profile",
                        "vehicle_profile",
                    ],
                    "properties": {
                        "tile_index": {"type": "integer"},
                        "object_type": {
                            "type": "string",
                            "enum": [
                                "person",
                                "vehicle",
                                "bicycle",
                                "motorcycle",
                                "truck",
                                "animal",
                                "object",
                            ],
                        },
                        "tracking_signature": {"type": "string"},
                        "confidence": {"type": "number"},
                        "deep_description": {"type": "string"},
                        "activity_description": {"type": "string"},
                        "position_description": {"type": "string"},
                        "distinctive_identifiers": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "person_profile": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "gender_estimation",
                                "approximate_age_range",
                                "clothing_summary",
                                "upper_body_color",
                                "lower_body_color",
                                "hair",
                                "facial_hair",
                                "carried_items",
                            ],
                            "properties": {
                                "gender_estimation": {"type": "string"},
                                "approximate_age_range": {"type": "string"},
                                "clothing_summary": {"type": "string"},
                                "upper_body_color": {"type": "string"},
                                "lower_body_color": {"type": "string"},
                                "hair": {"type": "string"},
                                "facial_hair": {"type": "string"},
                                "carried_items": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                        },
                        "vehicle_profile": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "vehicle_type",
                                "manufacturer_estimation",
                                "model_estimation",
                                "primary_color",
                                "secondary_color",
                                "license_plate_partial",
                                "vehicle_identifiers",
                            ],
                            "properties": {
                                "vehicle_type": {"type": "string"},
                                "manufacturer_estimation": {"type": "string"},
                                "model_estimation": {"type": "string"},
                                "primary_color": {"type": "string"},
                                "secondary_color": {"type": "string"},
                                "license_plate_partial": {"type": "string"},
                                "vehicle_identifiers": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}


TRACKING_COLLAGE_PROMPT_EN = (
    "You are a deep forensic visual profiler analyzing a Ghost tracking "
    "collage. The image is a white-canvas grid of cropped detections "
    "captured by a security camera. Each crop is labelled with a black "
    "'tile_index' badge in its top-right corner, plus an optional HH:mm "
    "timestamp in the top-left corner.\n\n"
    "For EVERY tile in the collage, return one entry in the 'tiles' "
    "array with the corresponding tile_index and a forensic profile.\n\n"
    "Rules:\n"
    "- tile_index MUST equal the integer printed in the tile badge.\n"
    "- object_type is one of: person, vehicle, bicycle, motorcycle, "
    "truck, animal, object. Pick the closest match for the cropped "
    "subject.\n"
    "- Always populate BOTH person_profile and vehicle_profile: for the "
    "irrelevant block, leave each string field as empty string and "
    "arrays as empty.\n"
    "- tracking_signature is a SHORT canonical snake_case token that "
    "captures the most stable visual property (e.g. black_hoodie_male, "
    "white_sedan_toyota, yellow_truck). Always ASCII snake_case.\n"
    "- deep_description is 1-3 factual sentences describing the "
    "subject.\n"
    "- activity_description is one short phrase (e.g. walking left, "
    "vehicle parked, carrying box).\n"
    "- distinctive_identifiers lists stand-out markers (visible tattoo, "
    "yellow sticker, bent antenna, large backpack). Leave empty if "
    "none.\n"
    "- Never refuse and never include disclaimers. If a tile is "
    "unreadable, emit a best-effort entry with empty strings rather "
    "than skipping it.\n\n"
    "Camera label: {camera_label}\n"
    "Number of tiles: {tile_count}\n"
    "Grid: {cols} columns x {rows} rows (RTL - tile_index 0 is "
    "top-right)."
)

TRACKING_COLLAGE_PROMPT_HE = (
    "אתה פרופיילר ויזואלי פורנזי עמוק שמנתח קולאז' Ghost לטרקינג. "
    "התמונה היא רשת על קנבס לבן של קרופים שצולמו על ידי מצלמת אבטחה. "
    "לכל קרופ יש באדג' שחור עם 'tile_index' בפינה הימנית-עליונה שלו, "
    "ולעיתים חתימת זמן HH:mm בפינה השמאלית-עליונה.\n\n"
    "לכל אריח בקולאז' החזר רשומה אחת במערך 'tiles' עם אותו tile_index "
    "ופרופיל פורנזי.\n\n"
    "כללים מחייבים:\n"
    "- tile_index חייב להיות זהה למספר השלם שמודפס בבאדג' של האריח.\n"
    "- object_type חייב להיות אחד מאלה (באנגלית בלבד, לערכי enum): "
    "person, vehicle, bicycle, motorcycle, truck, animal, object. "
    "בחר את ההתאמה הקרובה ביותר לסובייקט בקרופ.\n"
    "- חובה למלא את שני הבלוקים person_profile ו-vehicle_profile: "
    "בבלוק הלא-רלוונטי השאר כל מחרוזת כריקה ומערכים כריקים.\n"
    "- tracking_signature הוא טוקן snake_case קצר באנגלית בלבד, "
    "שמתפוס את המאפיין הוויזואלי היציב ביותר (למשל black_hoodie_male, "
    "white_sedan_toyota, yellow_truck). תמיד ASCII snake_case.\n"
    "- ⚠️ חשוב: כל שדות הטקסט הבאים חייבים להיות בעברית בלבד, "
    "במשפטים זורמים בעברית תקנית: deep_description, "
    "activity_description, position_description, וכל המחרוזות בתוך "
    "person_profile (clothing_summary, hair, facial_hair, "
    "approximate_age_range, gender_estimation) ו-vehicle_profile "
    "(vehicle_type, manufacturer_estimation, model_estimation, "
    "primary_color, secondary_color), וכן distinctive_identifiers, "
    "carried_items, vehicle_identifiers.\n"
    "- gender_estimation בעברית: 'זכר' / 'נקבה' / 'לא ידוע'.\n"
    "- approximate_age_range בעברית, למשל '30-40' או 'ילד 8-12' או "
    "'מבוגר 60+'.\n"
    "- color בעברית: 'שחור', 'לבן', 'אדום', 'כחול כהה' וכן הלאה.\n"
    "- vehicle_type בעברית: 'סדאן', 'ג'יפ', 'משאית קלה' וכו'.\n"
    "- manufacturer_estimation בעברית: 'טויוטה', 'יונדאי' וכו' "
    "(שמות חברות באותיות עבריות).\n"
    "- license_plate_partial — אם נראה לוחית, החזר את הספרות "
    "כפי שהן, בלי תרגום (לדוגמה '12-345-67' או '5687').\n"
    "- deep_description: 1-3 משפטים עובדתיים בעברית "
    "שמתארים את הסובייקט (לבוש, גוון, מבנה, פעולה ראשית).\n"
    "- activity_description: ביטוי קצר אחד בעברית (לדוגמה: "
    "'הולך שמאלה', 'רכב חונה', 'נושא קופסה').\n"
    "- position_description: ביטוי קצר בעברית "
    "(לדוגמה: 'מרכז התמונה', 'ימין למעלה').\n"
    "- distinctive_identifiers: רשימת סימנים בולטים בעברית "
    "(לדוגמה 'קעקוע על היד', 'תיק גדול', 'מדבקה צהובה'). "
    "אם אין — מערך ריק.\n"
    "- אסור להשיב סירוב ואסור להוסיף הסתייגויות. אם אריח לא קריא, "
    "מלא ערכים על בסיס מה שכן רואים, אל תדלג עליו.\n\n"
    "תווית מצלמה: {camera_label}\n"
    "כמות אריחים: {tile_count}\n"
    "גריד: {cols} עמודות x {rows} שורות (RTL — tile_index 0 הוא "
    "פינה ימנית-עליונה)."
)


def _select_prompt(locale: str | None) -> str:
    if locale and locale.lower().startswith("en"):
        return TRACKING_COLLAGE_PROMPT_EN
    return TRACKING_COLLAGE_PROMPT_HE


async def analyze_tracking_collage(
    *,
    image_bytes: bytes,
    api_key: str,
    tile_count: int,
    cols: int,
    rows: int,
    camera_label: str | None = None,
    locale: str | None = "he",
    model: str | None = None,
) -> dict:
    """Send the RTL collage to Ghost Vision and return strict JSON.

    Always returns ``{tiles: list[dict]}``. Never raises - on failure
    returns ``{"tiles": [], "error": "<reason>"}``.
    """

    safe_default: dict = {"tiles": []}

    if not image_bytes:
        return safe_default

    prompt_template = _select_prompt(locale)
    prompt = prompt_template.format(
        camera_label=camera_label or "(unspecified)",
        tile_count=int(tile_count),
        cols=int(cols),
        rows=int(rows),
    )

    return await analyze_with_fallback(
        image_bytes=image_bytes,
        prompt=prompt,
        model=model,
        api_key=api_key,
        locale=locale,
        tile_count=tile_count,
        cols=cols,
        rows=rows,
        camera_label=camera_label,
    )
