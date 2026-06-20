import { useEffect, useState } from "react";

import { costsApi, type CostsOverview } from "../api";
import { Banner, Card, MonoLabel, Spinner } from "../ui";

function money(v: number): string {
  return `$${v.toFixed(2)}`;
}

function Kpi({ tag, he, value }: { tag: string; he: string; value: string }) {
  return (
    <Card className="p-4">
      <MonoLabel>{tag}</MonoLabel>
      <div className="mt-2 text-2xl font-medium text-ghost-text-primary">{value}</div>
      <div className="mt-1 text-xs text-ghost-text-muted">{he}</div>
    </Card>
  );
}

export default function CostsScreen() {
  const [data, setData] = useState<CostsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    costsApi.overview().then((res) => {
      if (res.ok && res.data) setData(res.data);
      else setError(res.error?.message ?? "טעינת העלויות נכשלה");
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner label="טוען עלויות…" />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return null;

  const maxDaily = Math.max(0.0001, ...data.daily.map((d) => d.cost_usd));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {!data.tracking_active && (
        <Banner tone="info">
          עדיין לא נאספו נתוני עלות. המעקב מתחיל אוטומטית מהקריאה הבאה למודל (צ'אט, התראות, הטמעות).
          הנתונים יופיעו כאן תוך זמן קצר.
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi tag="MONTH TO DATE" he="מתחילת החודש" value={money(data.month_to_date_usd)} />
        <Kpi tag="TODAY" he="היום" value={money(data.today_usd)} />
        <Kpi tag="LAST 7D" he="7 ימים אחרונים" value={money(data.last_7d_usd)} />
        <Kpi tag="CALLS" he="קריאות מודל" value={String(data.total_calls)} />
      </div>

      {/* Daily cost */}
      <Card className="p-5">
        <MonoLabel>Cost · last 14 days</MonoLabel>
        <div className="mt-4 flex h-28 items-end gap-1" dir="ltr">
          {data.daily.map((d) => (
            <div
              key={d.day}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${d.day}: ${money(d.cost_usd)}`}
            >
              <div
                className="w-full rounded-t bg-ghost-text-secondary/70"
                style={{ height: `${(d.cost_usd / maxDaily) * 100}%`, minHeight: d.cost_usd ? 3 : 0 }}
              />
              <span className="text-[8px] text-ghost-text-muted">{d.day.slice(8)}</span>
            </div>
          ))}
          {data.daily.length === 0 && (
            <span className="text-sm text-ghost-text-muted">אין נתונים עדיין</span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By model */}
        <Card className="overflow-hidden">
          <div className="border-b border-ghost-border-subtle px-4 py-2.5">
            <MonoLabel>By model</MonoLabel>
          </div>
          {data.by_model.length === 0 && (
            <div className="px-4 py-3 text-sm text-ghost-text-muted">—</div>
          )}
          {data.by_model.map((m) => (
            <div
              key={m.model}
              className="flex items-center justify-between border-b border-ghost-border-subtle/50 px-4 py-2.5 text-sm last:border-0"
            >
              <span className="font-mono text-xs text-ghost-text-primary" dir="ltr">
                {m.model}
              </span>
              <span className="flex items-center gap-3 text-ghost-text-secondary">
                <span className="text-xs text-ghost-text-muted">{m.calls} קריאות</span>
                <span>{money(m.cost_usd)}</span>
              </span>
            </div>
          ))}
        </Card>

        {/* By action */}
        <Card className="overflow-hidden">
          <div className="border-b border-ghost-border-subtle px-4 py-2.5">
            <MonoLabel>By feature</MonoLabel>
          </div>
          {data.by_action.length === 0 && (
            <div className="px-4 py-3 text-sm text-ghost-text-muted">—</div>
          )}
          {data.by_action.map((a) => (
            <div
              key={a.action}
              className="flex items-center justify-between border-b border-ghost-border-subtle/50 px-4 py-2.5 text-sm last:border-0"
            >
              <span className="text-ghost-text-primary">{a.action}</span>
              <span className="flex items-center gap-3 text-ghost-text-secondary">
                <span className="text-xs text-ghost-text-muted">{a.calls}</span>
                <span>{money(a.cost_usd)}</span>
              </span>
            </div>
          ))}
        </Card>
      </div>

      {data.top_users.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-ghost-border-subtle px-4 py-2.5">
            <MonoLabel>Top spend by user</MonoLabel>
          </div>
          {data.top_users.map((u) => (
            <div
              key={u.user_id}
              className="flex items-center justify-between border-b border-ghost-border-subtle/50 px-4 py-2.5 text-sm last:border-0"
            >
              <span className="text-ghost-text-primary">{u.nickname ?? u.user_id.slice(0, 8)}</span>
              <span className="text-ghost-text-secondary">{money(u.cost_usd)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
