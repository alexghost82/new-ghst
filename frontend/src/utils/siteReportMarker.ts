/**
 * Sentinels for the Sitelligence report flow, shared across the message store,
 * the chat bubble renderer, and the PDF generator.
 *
 * - SITE_REPORT_MARKER: prepended (store-only) to the persisted assistant
 *   message that carries a full Sitelligence report, so the chat renders a
 *   download card (and the long report text never shows as a raw bubble) both
 *   live and after a page refresh. Kept in sync with the backend
 *   ``_SITE_REPORT_MARKER`` in chat_service.py.
 * - SITE_PREPARING_MARKER: client-only transient marker for the in-chat
 *   "scanning the environment" progress card while the report streams.
 */

export const SITE_REPORT_MARKER = "[[GHOST_SITE_REPORT]]";
export const SITE_PREPARING_MARKER = "[[GHOST_SITE_PREPARING]]";

export function isSiteReport(content: string): boolean {
  return content.startsWith(SITE_REPORT_MARKER);
}

export function stripSiteReportMarker(content: string): string {
  return content.startsWith(SITE_REPORT_MARKER)
    ? content.slice(SITE_REPORT_MARKER.length).replace(/^\s+/, "")
    : content;
}

export function isSitePreparing(content: string): boolean {
  return content.startsWith(SITE_PREPARING_MARKER);
}
