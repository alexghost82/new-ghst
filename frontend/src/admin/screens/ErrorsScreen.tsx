import { useCallback, useEffect, useState } from "react";

import { errorsApi, type ErrorEvent, type ErrorsSummary } from "../api";
import { Banner, Card, MonoLabel, Spinner } from "../ui";

const SEV_FILTERS = [
  { id: "", he: "הכל" },
  { id: "critical", he: "קריטי" },
  { id: "high", he: "גבוה" },
  { id: "warning", he: "אזהרה" },
  { id: "info", he: "מידע" },
];

function sevColor(s: string): string {
  switch (s) {
    case "critical":
      return "text-ghost-error";
    case "high":
      return "text-ghost-error";
    case "warning":
      return "text-ghost-text-secondary";
    default:
      return "text-ghost-text-muted";
  }
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

export default function ErrorsScreen() {
  const [summary, setSummary] = useState<ErrorsSummary | null>(null);
  const [items, setItems] = useState<ErrorEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, l] = await Promise.all([errorsApi.summary(), errorsApi.list({ severity, limit: 100 })]);
    if (s.ok && s.data) setSummary(s.data);
    if (l.ok && l.data) {
      setItems(l.data.items);
      setTotal(l.data.total);
    } else {
      setError(l.error?.message ?? "טעינת השגיאות נכשלה");
    }
    setLoading(false);
  }, [severity]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <MonoLabel>LAST 24H</MonoLabel>
            <div className="mt-2 text-2xl font-medium text-ghost-text-primary">{summary.last_24h}</div>
            <div className="mt-1 text-xs text-ghost-text-muted">שגיאות ב-24 שעות</div>
          </Card>
          <Card className="p-4">
            <MonoLabel>LAST 7D</MonoLabel>
            <div className="mt-2 text-2xl font-medium text-ghost-text-primary">{summary.last_7d}</div>
            <div className="mt-1 text-xs text-ghost-text-muted">שגיאות בשבוע</div>
          </Card>
          <Card className="p-4">
            <MonoLabel>CRITICAL</MonoLabel>
            <div className="mt-2 text-2xl font-medium text-ghost-error">
              {summary.by_severity.critical ?? 0}
            </div>
            <div className="mt-1 text-xs text-ghost-text-muted">קריטיות (סה"כ)</div>
          </Card>
          <Card className="p-4">
            <MonoLabel>HIGH</MonoLabel>
            <div className="mt-2 text-2xl font-medium text-ghost-text-primary">
              {summary.by_severity.high ?? 0}
            </div>
            <div className="mt-1 text-xs text-ghost-text-muted">חומרה גבוהה (סה"כ)</div>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {SEV_FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            onClick={() => setSeverity(f.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              severity === f.id
                ? "border-ghost-text-secondary bg-ghost-surface/60 text-ghost-text-primary"
                : "border-ghost-border-subtle text-ghost-text-secondary hover:text-ghost-text-primary"
            }`}
          >
            {f.he}
          </button>
        ))}
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_0.7fr_1.4fr_2.5fr] items-center gap-2 border-b border-ghost-border-subtle px-4 py-2.5">
          {["זמן", "חומרה", "מקור/נתיב", "הודעה"].map((h) => (
            <MonoLabel key={h}>{h}</MonoLabel>
          ))}
        </div>

        {loading && (
          <div className="p-8">
            <Spinner label="טוען שגיאות…" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="p-8 text-center text-sm text-ghost-text-muted">
            אין שגיאות מתועדות. זה דבר טוב.
          </div>
        )}

        {!loading &&
          items.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[1fr_0.7fr_1.4fr_2.5fr] items-center gap-2 border-b border-ghost-border-subtle/50 px-4 py-2.5 text-sm last:border-0"
            >
              <span className="text-ghost-text-muted" dir="ltr">
                {fmt(e.created_at)}
              </span>
              <span className={`text-xs font-medium ${sevColor(e.severity)}`}>{e.severity}</span>
              <span className="truncate font-mono text-[11px] text-ghost-text-secondary" dir="ltr">
                {e.source}
                {e.route ? ` · ${e.route}` : ""}
              </span>
              <span className="truncate text-ghost-text-primary" title={e.message} dir="ltr">
                {e.message}
              </span>
            </div>
          ))}
      </Card>
      {total > items.length && (
        <span className="text-xs text-ghost-text-muted">מוצגות {items.length} מתוך {total}</span>
      )}
    </div>
  );
}
