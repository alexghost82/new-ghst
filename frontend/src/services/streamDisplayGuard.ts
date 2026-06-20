import { sanitizeRefusal } from "../utils/sanitize";

/**
 * Live refusal guard for the *streaming* display layer (defense-in-depth on top
 * of the backend's own refusal interception in ``_stream_text_guarded`` /
 * ``_stream_with_refusal_guard``).
 *
 * The backend already withholds a trailing safe window on the text path, so a
 * refusal phrase normally never reaches the client there. This client-side
 * guard exists to cover the gaps the backend can't fully close mid-stream:
 *  - the vision path (tokens flow freely after the first ~240 chars), and
 *  - the rare text case where a refusal appears *after* a clean prefix was
 *    already flushed.
 *
 * Design goal: ZERO added latency for clean replies. We do NOT mirror the
 * backend's blind 240-char tail (that would lag every visible reply). Instead:
 *  1. If the full accumulated text already matches a complete refusal, return
 *     the Ghost-branded replacement immediately.
 *  2. Otherwise reveal everything EXCEPT a suffix that looks like it might be
 *     the *beginning* of a refusal (a refusal "opener", possibly only partially
 *     streamed). That suspect tail stays hidden until it either completes into a
 *     real refusal (→ replaced) or the stream finishes (the consumer flushes the
 *     full text through ``sanitizeRefusal`` at commit, so nothing is lost).
 *
 * Worst case for a clean reply that merely *contains* an opener-like fragment
 * (e.g. "I cannot stress enough how clear this is") is a brief display delay of
 * that fragment until commit — never data loss, never a leaked refusal.
 */

/**
 * Lowercased fragments that begin a known refusal/apology phrase. Mirrors the
 * spirit of ``REFUSAL_PATTERNS`` in ``utils/sanitize.ts`` but as plain literal
 * openers so we can also detect a *partially* streamed opener at the tail.
 */
const REFUSAL_OPENERS: readonly string[] = [
  // English
  "i'm sorry",
  "i am sorry",
  "im sorry",
  "i cannot",
  "i can't",
  "i can not",
  "i cant",
  "i won't",
  "i wont",
  "unfortunately,",
  "i apologize",
  "i apologise",
  "as an ai",
  "as a language model",
  "i'm not able",
  "i am not able",
  "i'm unable",
  "i am unable",
  "my usage policy",
  "my policy",
  "this goes against",
  "this violates",
  // Hebrew
  "אני לא יכול",
  "אני לא מסוגל",
  "אני מצטער",
  "כמודל שפה",
  "בתור מודל",
  "בתור עוזר",
  "לצערי",
];

/**
 * Index in ``lower`` from which content should be withheld because it looks
 * like the start (full or partial) of a refusal. Returns -1 when nothing is
 * suspicious.
 */
function suspiciousStart(lower: string): number {
  let cut = -1;
  for (const opener of REFUSAL_OPENERS) {
    const idx = lower.indexOf(opener);
    if (idx !== -1) {
      if (cut === -1 || idx < cut) cut = idx;
      continue;
    }
    // No full opener present — check whether the tail is a prefix of one
    // (an opener still being streamed token-by-token).
    const maxK = Math.min(opener.length - 1, lower.length);
    for (let k = maxK; k > 0; k -= 1) {
      if (lower.endsWith(opener.slice(0, k))) {
        const idx2 = lower.length - k;
        if (cut === -1 || idx2 < cut) cut = idx2;
        break;
      }
    }
  }
  return cut;
}

/**
 * Returns the text that is safe to display for the current ``accumulated``
 * streaming buffer. See module docs for the guarantees.
 */
export function getSafeStreamingDisplay(
  accumulated: string,
  locale: "he" | "en" = "he",
): string {
  if (!accumulated) return accumulated;

  // A fully-formed refusal anywhere in the text → branded replacement now.
  const sanitized = sanitizeRefusal(accumulated, locale);
  if (sanitized !== accumulated) return sanitized;

  // Hide a suspect (possibly partial) refusal opener until it resolves.
  const cut = suspiciousStart(accumulated.toLowerCase());
  if (cut === -1) return accumulated;
  return accumulated.slice(0, cut);
}
