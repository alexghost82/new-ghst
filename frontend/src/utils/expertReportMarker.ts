/**
 * Ghost Expert report marker.
 *
 * The backend persists an assistant message of the form
 * `[[GHOST_EXPERT_REPORT:<report_id>]]` once the Expert recommendation set is
 * generated. The frontend renders the in-chat report card (PDF download + "set
 * up as drafts") in place of that marker. Kept in sync with
 * ``EXPERT_REPORT_MARKER`` in backend/app/routes/expert.py.
 */

export const EXPERT_REPORT_RE = /\[\[GHOST_EXPERT_REPORT:([0-9a-fA-F-]+)\]\]/;

/** Client-only transient marker while the recommendation set is generating. */
export const EXPERT_PREPARING_MARKER = "[[GHOST_EXPERT_PREPARING]]";

export function expertReportIdOf(content: string): string | null {
  const m = EXPERT_REPORT_RE.exec(content);
  return m ? m[1] : null;
}

export function isExpertPreparing(content: string): boolean {
  return content.startsWith(EXPERT_PREPARING_MARKER);
}
