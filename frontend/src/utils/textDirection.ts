const HEBREW_RANGE = /[\u0590-\u05FF]/;

export function detectDirection(text: string): "rtl" | "ltr" {
  const stripped = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!stripped) return "rtl";
  return HEBREW_RANGE.test(stripped[0]) ? "rtl" : "ltr";
}
