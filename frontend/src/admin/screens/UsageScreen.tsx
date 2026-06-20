import { useEffect, useState } from "react";

import { usageApi, type UsageOverview } from "../api";
import { Banner, Card, MonoLabel, Spinner } from "../ui";

function Kpi({ tag, he, value }: { tag: string; he: string; value: number | string }) {
  return (
    <Card className="p-4">
      <MonoLabel>{tag}</MonoLabel>
      <div className="mt-2 text-2xl font-medium text-ghost-text-primary">{value}</div>
      <div className="mt-1 text-xs text-ghost-text-muted">{he}</div>
    </Card>
  );
}

export default function UsageScreen() {
  const [data, setData] = useState<UsageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usageApi.overview().then((res) => {
      if (res.ok && res.data) setData(res.data);
      else setError(res.error?.message ?? "טעינת הנתונים נכשלה");
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner label="טוען נתוני שימוש…" />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return null;

  const m = data.metrics;
  const maxSignup = Math.max(1, ...data.signups.map((s) => s.count));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi tag="TOTAL USERS" he="סך המשתמשים" value={m.total_users} />
        <Kpi tag="ACTIVE TODAY" he="פעילים היום" value={m.active_today} />
        <Kpi tag="ACTIVE 7D" he="פעילים השבוע" value={m.active_7d} />
        <Kpi tag="ACTIVE 30D" he="פעילים החודש" value={m.active_30d} />
        <Kpi tag="NEW 7D" he="חדשים השבוע" value={m.new_users_7d} />
        <Kpi tag="DORMANT 30D" he="לא פעילים 30 יום" value={m.dormant_30d} />
        <Kpi tag="CONVERSATIONS" he="סך השיחות" value={m.total_conversations} />
        <Kpi tag="MESSAGES 7D" he="הודעות השבוע" value={m.messages_7d} />
      </div>

      {/* Signups sparkline (bars) */}
      <Card className="p-5">
        <MonoLabel>New users · last 14 days</MonoLabel>
        <div className="mt-4 flex h-28 items-end gap-1" dir="ltr">
          {data.signups.map((s) => (
            <div key={s.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${s.day}: ${s.count}`}>
              <div
                className="w-full rounded-t bg-ghost-text-secondary/70"
                style={{ height: `${(s.count / maxSignup) * 100}%`, minHeight: s.count ? 3 : 0 }}
              />
              <span className="text-[8px] text-ghost-text-muted">{s.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Top users */}
      <Card className="overflow-hidden">
        <div className="border-b border-ghost-border-subtle px-4 py-2.5">
          <MonoLabel>Most active users</MonoLabel>
        </div>
        {data.top_users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between border-b border-ghost-border-subtle/50 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="truncate text-ghost-text-primary">{u.nickname}</span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase text-ghost-text-muted">{u.origin}</span>
              <span className="text-ghost-text-secondary">{u.conversation_count} שיחות</span>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
