const OPENAI_PATTERN = /open\s?ai/gi;

/**
 * Replaces all occurrences of "OpenAI" / "open ai" / "openai" (case-insensitive)
 * with "Ghost" in user-facing text. Ensures the brand name never leaks to the UI.
 *
 * Defensive: callers occasionally pass non-string values (e.g. FastAPI's
 * ``detail`` object when an error path forgets to unwrap it). Coerce to a
 * string and bail out gracefully rather than throwing ``text.replace is not
 * a function`` mid-render.
 */
export function sanitizeBrand(text: unknown): string {
  if (typeof text === "string") {
    return text.replace(OPENAI_PATTERN, "Ghost");
  }
  if (text == null) return "";
  try {
    return String(text).replace(OPENAI_PATTERN, "Ghost");
  } catch {
    return "";
  }
}

const REFUSAL_PATTERNS = [
  /\bi[''`]?m\s+sorry,?\s+(?:but\s+)?i\s+can(?:not|'t)\s+(?:assist|help|do that|comply)\b/i,
  /\bi\s+can(?:not|'t)\s+assist\s+with\s+that\b/i,
  /\bi\s+(?:cannot|can't|won't)\s+help\s+with\s+that\b/i,
  /\bi[''`]?m\s+(?:not\s+able|unable)\s+to\s+(?:help|assist|comply|fulfill|do that)\b/i,
  /\bunfortunately,?\s+i\s+(?:cannot|can't|am\s+unable)\b/i,
  /\bi\s+(?:cannot|can't)\s+(?:generate|create|produce)\s+(?:content|that)\b/i,
  /\bthis\s+(?:goes\s+against|violates)\s+my\s+(?:guidelines|policy|usage\s+policy)\b/i,
  /\bmy\s+(?:usage\s+)?policy\s+prevents\b/i,
  /\bi\s+apologize,?\s+but\s+i\s+(?:cannot|can't|am\s+unable)\b/i,
  /\bas\s+an?\s+ai\s+(?:language\s+)?(?:model|assistant)\b/i,
  /\bi[''`]?m\s+sorry,?\s+but\s+i\s+can(?:not|'t)\b.{0,80}\b(?:identify|describe|people|person|image)\b/i,
  /אני\s+(?:לא\s+יכול|מצטער)\s+לעזור\s+עם\s+(?:זה|הבקשה)/,
  /כמודל\s+שפה/,
  /בתור\s+(?:מודל|עוזר)\s+(?:שפה|בינה\s+מלאכותית)/,
];

export const GHOST_REFUSAL_MSG_HE =
  "Ghost לא הצליח לעבד את הבקשה הזו. נסה לנסח אותה אחרת, או שלח בקשה חדשה.";

export const GHOST_REFUSAL_MSG_EN =
  "Ghost couldn't process this request. Try rephrasing it, or send a new message.";

/**
 * Safety-net: detects generic AI refusal / apology responses that the backend
 * may have failed to intercept and replaces them with a Ghost-branded message.
 * Returns the original text unchanged if no refusal is detected.
 */
export function sanitizeRefusal(
  text: string,
  locale: "he" | "en" = "he",
): string {
  if (!text) return text;
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(text)) {
      return locale === "en" ? GHOST_REFUSAL_MSG_EN : GHOST_REFUSAL_MSG_HE;
    }
  }
  return text;
}
