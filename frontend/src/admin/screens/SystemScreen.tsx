import { useEffect, useState } from "react";

import { systemApi, type SystemHealth } from "../api";
import { Banner, Card, MonoLabel, Spinner } from "../ui";

const CHECK_LABELS: Record<string, string> = {
  database: "מסד נתונים",
  vector_store: "מנוע זיכרון (ChromaDB)",
  master_key: "מפתח הצפנה",
};

const STATUS: Record<string, { he: string; tone: "success" | "error" | "info"; dot: string }> = {
  ok: { he: "המערכת תקינה", tone: "success", dot: "bg-ghost-success" },
  warning: { he: "יש דברים לבדוק", tone: "info", dot: "bg-ghost-text-secondary" },
  critical: { he: "נדרשת התערבות", tone: "error", dot: "bg-ghost-error" },
};

export default function SystemScreen() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = () =>
      systemApi.health().then((res) => {
        if (res.ok && res.data) setData(res.data);
        else setError(res.error?.message ?? "טעינת בריאות המערכת נכשלה");
        setLoading(false);
      });
    fetchHealth();
    const t = setInterval(fetchHealth, 15000); // live refresh every 15s
    return () => clearInterval(t);
  }, []);

  if (loading) return <Spinner label="בודק בריאות מערכת…" />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return null;

  const st = STATUS[data.status] ?? STATUS.warning;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {/* Overall status */}
      <Card className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${st.dot}`} />
          <div>
            <div className="text-lg font-medium text-ghost-text-primary">{st.he}</div>
            <MonoLabel>Environment · {data.environment}</MonoLabel>
          </div>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-ghost-text-muted">
          {data.status}
        </span>
      </Card>

      {/* Dependency checks */}
      <Card className="overflow-hidden">
        <div className="border-b border-ghost-border-subtle px-4 py-2.5">
          <MonoLabel>Dependencies</MonoLabel>
        </div>
        {Object.entries(data.checks).map(([k, ok]) => (
          <div
            key={k}
            className="flex items-center justify-between border-b border-ghost-border-subtle/50 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="text-ghost-text-primary">{CHECK_LABELS[k] ?? k}</span>
            <span className={`flex items-center gap-2 ${ok ? "text-ghost-success" : "text-ghost-error"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-ghost-success" : "bg-ghost-error"}`} />
              {ok ? "תקין" : "תקלה"}
            </span>
          </div>
        ))}
      </Card>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <MonoLabel>USERS</MonoLabel>
          <div className="mt-2 text-2xl font-medium text-ghost-text-primary">
            {data.counts.total_users ?? "—"}
          </div>
        </Card>
        <Card className="p-4">
          <MonoLabel>MIGRATIONS</MonoLabel>
          <div className="mt-2 text-2xl font-medium text-ghost-text-primary">
            {data.counts.migrations_applied ?? "—"}
          </div>
        </Card>
        <Card className="p-4">
          <MonoLabel>LLM CALLS</MonoLabel>
          <div className="mt-2 text-2xl font-medium text-ghost-text-primary">
            {data.counts.llm_calls ?? "—"}
          </div>
        </Card>
        <Card className="p-4">
          <MonoLabel>ERRORS 24H</MonoLabel>
          <div
            className={`mt-2 text-2xl font-medium ${
              data.errors.last_24h > 0 ? "text-ghost-error" : "text-ghost-text-primary"
            }`}
          >
            {data.errors.last_24h}
          </div>
        </Card>
      </div>

      {/* Alert queue */}
      {data.queue && (
        <Card className="p-5">
          <MonoLabel>Alert queue</MonoLabel>
          <div className="mt-3 flex gap-6 text-sm text-ghost-text-secondary">
            <span>בתור: {data.queue.queue_size ?? 0}</span>
            <span>בעיבוד: {data.queue.inflight ?? 0}</span>
            <span className={data.queue.consecutive_failures ? "text-ghost-error" : ""}>
              כשלים רצופים: {data.queue.consecutive_failures ?? 0}
            </span>
          </div>
        </Card>
      )}

      <p className="text-center text-xs text-ghost-text-muted">מתעדכן אוטומטית כל 15 שניות</p>
    </div>
  );
}
