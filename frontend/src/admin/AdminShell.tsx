import { useMemo, useState } from "react";

import { useAdminStore } from "./store";
import { ROLE_LABELS_HE } from "./roles";
import { AdminBrand, Button, MonoLabel } from "./ui";
import AuditScreen from "./screens/AuditScreen";
import CostsScreen from "./screens/CostsScreen";
import ErrorsScreen from "./screens/ErrorsScreen";
import OverviewScreen from "./screens/OverviewScreen";
import SystemScreen from "./screens/SystemScreen";
import UsageScreen from "./screens/UsageScreen";
import UsersScreen from "./screens/UsersScreen";

interface NavItem {
  id: string;
  he: string;
  tag: string;
  permission: string;
}

const NAV: NavItem[] = [
  { id: "overview", he: "סקירה", tag: "OVERVIEW", permission: "system.read" },
  { id: "users", he: "משתמשים", tag: "USERS", permission: "users.read" },
  { id: "audit", he: "יומן פעולות", tag: "AUDIT", permission: "audit.read" },
  { id: "usage", he: "שימוש", tag: "USAGE", permission: "usage.read" },
  { id: "costs", he: "עלויות", tag: "COSTS", permission: "costs.read" },
  { id: "errors", he: "שגיאות", tag: "ERRORS", permission: "errors.read" },
  { id: "system", he: "בריאות מערכת", tag: "SYSTEM", permission: "system.read" },
];

export default function AdminShell() {
  const admin = useAdminStore((s) => s.admin);
  const can = useAdminStore((s) => s.can);
  const logout = useAdminStore((s) => s.logout);

  const visibleNav = useMemo(() => NAV.filter((n) => can(n.permission)), [can]);
  const [view, setView] = useState<string>(visibleNav[0]?.id ?? "overview");

  const renderView = () => {
    switch (view) {
      case "overview":
        return <OverviewScreen />;
      case "users":
        return <UsersScreen />;
      case "audit":
        return <AuditScreen />;
      case "usage":
        return <UsageScreen />;
      case "costs":
        return <CostsScreen />;
      case "errors":
        return <ErrorsScreen />;
      case "system":
        return <SystemScreen />;
      default:
        return <OverviewScreen />;
    }
  };

  const activeLabel = NAV.find((n) => n.id === view)?.he ?? "סקירה";

  return (
    <div dir="rtl" className="flex h-screen bg-ghost-bg font-he text-ghost-text-primary">
      {/* Sidebar */}
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-l border-ghost-border-subtle bg-ghost-sidebar">
        <div className="flex items-center gap-3 px-5 py-5">
          <AdminBrand size={26} />
          <div className="flex flex-col">
            <MonoLabel>Ghost // Admin</MonoLabel>
            <span className="text-sm text-ghost-text-secondary">קונסולת ניהול</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {visibleNav.map((item) => {
            const active = item.id === view;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm transition-colors ${
                  active
                    ? "bg-ghost-surface/60 text-ghost-text-primary"
                    : "text-ghost-text-secondary hover:bg-ghost-surface/30 hover:text-ghost-text-primary"
                }`}
              >
                <span>{item.he}</span>
                <span className="font-mono text-[8px] tracking-[0.18em] text-ghost-text-muted">
                  {item.tag}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Admin identity + logout */}
        <div className="border-t border-ghost-border-subtle px-4 py-4">
          <div className="mb-3 flex flex-col gap-0.5">
            <span className="truncate text-sm text-ghost-text-primary" dir="ltr">
              {admin?.email}
            </span>
            <MonoLabel>{ROLE_LABELS_HE[admin?.role ?? "viewer"] ?? admin?.role}</MonoLabel>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => logout(false)}>
            יציאה
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-ghost-border-subtle px-6 py-4">
          <h1 className="text-lg font-medium text-ghost-text-primary">{activeLabel}</h1>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ghost-success" />
            <MonoLabel>Live · Production console</MonoLabel>
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{renderView()}</div>
      </main>
    </div>
  );
}
