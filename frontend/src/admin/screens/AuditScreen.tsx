import { useCallback, useEffect, useState } from "react";

import { auditApi, type AuditEntry, type AuditListResponse } from "../api";
import { Banner, Button, Card, MonoLabel, Spinner } from "../ui";

const PAGE = 100;

// Human-readable Hebrew labels for the audit action codes.
const ACTION_LABELS: Record<string, string> = {
  admin_login_success: "כניסת מנהל",
  admin_login_failed: "כניסה נכשלה",
  admin_login_locked: "חשבון ננעל",
  admin_mfa_failed: "2FA נכשל",
  admin_logout: "יציאת מנהל",
  permission_denied: "גישה נדחתה",
  user_updated: "עדכון משתמש",
  user_status_changed: "שינוי סטטוס",
  user_soft_deleted: "מחיקת משתמש",
  user_restored: "שחזור משתמש",
  user_magic_link_issued: "הונפק קישור כניסה",
  user_impersonated: "התחזות למשתמש",
  user_impersonate_denied: "התחזות נדחתה",
};

function actionHe(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AuditScreen() {
  const [data, setData] = useState<AuditListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await auditApi.list({ search, limit: PAGE, offset });
    if (res.ok && res.data) setData(res.data);
    else setError(res.error?.message ?? "טעינת היומן נכשלה");
    setLoading(false);
  }, [search, offset]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const total = data?.total ?? 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ghost-text-muted">
          תיעוד מלא של כל פעולה רגישה במערכת. שורה לכל פעולה — מי ביצע, על מי, מתי ומאיזו כתובת.
        </p>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="חיפוש בפעולה / מבצע / יעד…"
          className="w-64 rounded-lg border border-ghost-border-subtle bg-ghost-bg-secondary px-3 py-2 text-sm text-ghost-text-primary outline-none placeholder:text-ghost-text-muted focus:border-ghost-text-secondary"
        />
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1.4fr_1.4fr_1fr_0.8fr] items-center gap-2 border-b border-ghost-border-subtle px-4 py-2.5">
          {["זמן", "פעולה", "מבצע", "יעד", "סטטוס"].map((h) => (
            <MonoLabel key={h}>{h}</MonoLabel>
          ))}
        </div>

        {loading && (
          <div className="p-8">
            <Spinner label="טוען יומן…" />
          </div>
        )}

        {!loading && data?.items.length === 0 && (
          <div className="p-8 text-center text-sm text-ghost-text-muted">אין רשומות.</div>
        )}

        {!loading &&
          data?.items.map((e: AuditEntry) => (
            <div
              key={e.id}
              className="grid grid-cols-[1.2fr_1.4fr_1.4fr_1fr_0.8fr] items-center gap-2 border-b border-ghost-border-subtle/50 px-4 py-2.5 text-sm last:border-0"
            >
              <span className="text-ghost-text-muted" dir="ltr">
                {fmt(e.created_at)}
              </span>
              <span className="text-ghost-text-primary" title={e.reason ?? undefined}>
                {actionHe(e.action)}
              </span>
              <span className="truncate text-ghost-text-secondary" dir="ltr">
                {e.actor_label ?? "—"}
              </span>
              <span className="truncate font-mono text-[11px] text-ghost-text-muted" dir="ltr">
                {e.target_type ? `${e.target_type}:${(e.target_id ?? "").slice(0, 8)}` : "—"}
              </span>
              <span
                className={`text-xs ${
                  e.status === "success"
                    ? "text-ghost-success"
                    : e.status === "denied" || e.status === "failure"
                      ? "text-ghost-error"
                      : "text-ghost-text-secondary"
                }`}
              >
                {e.status}
              </span>
            </div>
          ))}
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-ghost-text-muted">
            {offset + 1}–{Math.min(offset + PAGE, total)} מתוך {total}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              הקודם
            </Button>
            <Button variant="ghost" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
              הבא
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
