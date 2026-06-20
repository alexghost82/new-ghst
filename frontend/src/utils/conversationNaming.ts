import type { Locale } from "../stores/languageStore";
import { t } from "./i18n";

/**
 * Default title a brand-new conversation is born with: a localized prefix plus
 * the date and time it was opened, e.g. "new conv 9-5-26 14:01" (en) or
 * "שיחה חדשה 9-5-26 14:01" (he). The date is ``D-M-YY`` (no leading zeros) and
 * the time is ``HH:MM`` (zero-padded), matching the operator-requested format.
 *
 * This title is stored as data (``title_source='default'`` on the server) and
 * remains eligible to be replaced by an auto-generated summary once Ghost
 * starts replying — unless the conversation lives in an area/group or the
 * operator renames it.
 */
export function formatDefaultConvName(locale: Locale, date: Date = new Date()): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const prefix = t(locale, "defaultConvNamePrefix");
  return `${prefix} ${d}-${m}-${yy} ${hh}:${min}`;
}
