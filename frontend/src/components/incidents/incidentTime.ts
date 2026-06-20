import type { TranslationKey } from "../../utils/i18n";

/**
 * Compact "time since" formatter used by incident cards. Returns the
 * translation key + numeric value so callers can run it through useT()
 * without leaking English/Hebrew literals.
 */
export function relativeDuration(
  iso: string,
  reference: number = Date.now(),
): { key: TranslationKey; value: number } {
  let diff = reference - new Date(iso).getTime();
  if (Number.isNaN(diff)) return { key: "sNow", value: 0 };
  diff = Math.max(0, Math.floor(diff / 1000));

  if (diff < 45) return { key: "sNow", value: 0 };
  if (diff < 60 * 90) return { key: "sMinutes", value: Math.round(diff / 60) };
  if (diff < 60 * 60 * 24)
    return { key: "sHours", value: Math.round(diff / 3600) };
  return { key: "sDays", value: Math.round(diff / 86400) };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function formatLocalTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
