import { useEffect, useState } from "react";

import { costsApi, errorsApi, usageApi } from "../api";
import { useAdminStore } from "../store";
import { ROLE_LABELS_HE } from "../roles";
import { Card, MonoLabel } from "../ui";

/**
 * Owner dashboard. KPI tiles read live aggregates: user counts + activity from
 * the usage endpoint, month-to-date cost from the cost ledger, and the 24h
 * error count from the error ledger. Each fetch degrades to "—" independently
 * so a partially-available backend never blanks the whole screen.
 */
export default function OverviewScreen() {
  const admin = useAdminStore((s) => s.admin);
  const can = useAdminStore((s) => s.can);

  const [totalUsers, setTotalUsers] = useState<string | number>("—");
  const [activeToday, setActiveToday] = useState<string | number>("—");
  const [costMtd, setCostMtd] = useState<string>("—");
  const [errors24h, setErrors24h] = useState<string | number>("—");

  useEffect(() => {
    if (can("usage.read")) {
      usageApi.overview().then((r) => {
        if (r.ok && r.data) {
          setTotalUsers(r.data.metrics.total_users);
          setActiveToday(r.data.metrics.active_today);
        }
      });
    }
    if (can("costs.read")) {
      costsApi.overview().then((r) => {
        if (r.ok && r.data) setCostMtd(`$${r.data.month_to_date_usd.toFixed(2)}`);
      });
    }
    if (can("errors.read")) {
      errorsApi.summary().then((r) => {
        if (r.ok && r.data) setErrors24h(r.data.last_24h);
      });
    }
  }, [can]);

  const kpis = [
    { he: "סך המשתמשים", tag: "TOTAL USERS", value: totalUsers },
    { he: "פעילים היום", tag: "ACTIVE TODAY", value: activeToday },
    { he: "עלות החודש", tag: "COST · MTD", value: costMtd },
    { he: "שגיאות (24ש')", tag: "ERRORS · 24H", value: errors24h },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card className="p-5">
        <MonoLabel>Signed in as</MonoLabel>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base text-ghost-text-primary" dir="ltr">
            {admin?.email}
          </span>
          <span className="text-sm text-ghost-text-muted">
            · {ROLE_LABELS_HE[admin?.role ?? "viewer"] ?? admin?.role}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ghost-text-secondary">
          ברוך הבא לקונסולת הניהול של Ghost. מכאן תוכל לראות ולנהל את כל פעילות
          המערכת — משתמשים, פעולות, שימוש, עלויות ושגיאות. כל פעולה רגישה מתועדת
          ביומן הביקורת.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.tag} className="p-4">
            <MonoLabel>{k.tag}</MonoLabel>
            <div className="mt-2 text-2xl font-medium text-ghost-text-primary">
              {k.value}
            </div>
            <div className="mt-1 text-xs text-ghost-text-muted">{k.he}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <MonoLabel>What needs attention</MonoLabel>
        <p className="mt-2 text-sm text-ghost-text-muted">
          כאן יוצגו התראות ותובנות שדורשות תשומת לב — חריגות עלות, משתמשים
          שיצרו עומס חריג, ותהליכים שנכשלו. ייטען בשלבי הניטור.
        </p>
      </Card>
    </div>
  );
}
