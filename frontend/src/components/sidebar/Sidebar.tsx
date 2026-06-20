import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LayoutGrid,
  ListChecks,
  LogOut,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useConversationActivityStore } from "../../stores/conversationActivityStore";
import { useMessageStore } from "../../stores/messageStore";
import { useBroadcastStore } from "../../stores/broadcastStore";
import { useUserStore } from "../../stores/userStore";
import { useViewStore } from "../../stores/viewStore";
import { useSidebarStore } from "../../stores/sidebarStore";
import { useIncidentStore } from "../../stores/incidentStore";
import { useThemeStore } from "../../stores/themeStore";
import { useLanguageStore } from "../../stores/languageStore";
import ConversationGroupsTree from "./ConversationGroupsTree";
import SidebarResizeHandle from "./SidebarResizeHandle";
import { useT } from "../../utils/i18n";
import { confirmDialog, toast } from "../../stores/feedbackStore";
import { formatDefaultConvName } from "../../utils/conversationNaming";

interface SidebarProps {
  onOpenSettings: () => void;
}

export default function Sidebar({ onOpenSettings }: SidebarProps) {
  const { users, activeUserId, setActiveUser, logout, sessionType } =
    useUserStore();
  const {
    conversations,
    activeConversationId,
    isLoading,
    error,
    fetchConversations,
    createConversation,
    deleteConversation,
    setActive,
    updateConversation,
  } = useConversationStore();
  const { clearMessages, fetchMessages } = useMessageStore();
  const loadActivityForUser = useConversationActivityStore((s) => s.loadForUser);
  const markConversationRead = useConversationActivityStore((s) => s.markRead);
  const closeBroadcast = useBroadcastStore((s) => s.close);
  const viewMode = useViewStore((s) => s.mode);
  const setViewMode = useViewStore((s) => s.setMode);
  const newIncidentCount = useIncidentStore(
    (s) => s.columnOrder.new.length,
  );
  const closeSidebar = useSidebarStore((s) => s.close);
  const sidebarOpen = useSidebarStore((s) => s.isOpen);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const t = useT();

  useEffect(() => {
    if (activeUserId) {
      // Every trial now runs on its own brand-new account, so the per-user
      // conversation list is already fully isolated — no IP scoping needed.
      fetchConversations(activeUserId);
      loadActivityForUser(activeUserId);
    }
  }, [activeUserId, fetchConversations, loadActivityForUser]);

  const handleNewChat = async () => {
    if (!activeUserId) return;
    closeBroadcast();
    await createConversation(
      activeUserId,
      formatDefaultConvName(useLanguageStore.getState().locale),
    );
    clearMessages();
  };

  const handleSelect = (id: string) => {
    closeBroadcast();
    markConversationRead(id);
    if (id === activeConversationId) return;
    setActive(id);
    clearMessages();
    if (activeUserId) fetchMessages(id, activeUserId);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteConversation"),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;
    await deleteConversation(id);
    if (id === activeConversationId) {
      clearMessages();
    }
    toast.success(t("actionDeleted"));
  };

  const isChat = viewMode === "chat";
  const isIncidents = viewMode === "incidents";
  const isOperations = viewMode === "operations";
  const activeUser = users.find((u) => u.id === activeUserId);

  return (
    <aside className="relative w-full h-screen flex-shrink-0 bg-ghost-sidebar flex flex-col">
      {/* ── Ambient wash (the only "color", confined to the top) ──── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden z-0"
      >
        <div
          className="ghost-ambient__blob ghost-ambient__blob--1"
          style={{
            top: -130,
            left: "-22%",
            width: 300,
            height: 300,
            background:
              "radial-gradient(circle, rgb(96 116 132 / 0.45), transparent 70%)",
          }}
        />
      </div>

      {/* ── Brand header ─────────────────────────────────────────── */}
      <div className="relative z-10 px-3 pt-3 pb-2 flex items-center gap-2 min-w-0">
        <img
          src={theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png"}
          alt="Ghost"
          className={`ghost-brand-icon ghost-brand-wrap-out w-8 h-8 object-contain flex-shrink-0 rounded-[7px] ${
            sidebarOpen ? "" : "ghost-brand-wrap-out--gone"
          }`}
          draggable={false}
        />
        <div className="flex-1 min-w-0 flex justify-center overflow-hidden">
          <SidebarClock />
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isChat ? (
            <button
              data-tour="sidebar-new-chat"
              onClick={handleNewChat}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms]"
              aria-label={t("newConversation")}
              title={t("newConversation")}
            >
              <Plus size={18} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={closeSidebar}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms]"
            aria-label={t("closeSidebar")}
            title={t("closeSidebar")}
          >
            <PanelLeftClose size={18} className="rtl:scale-x-[-1]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── View mode tabs (Chat / Incidents) ────────────────────── */}
      <div className="px-3 pt-2 pb-2 relative z-10">
        <div
          data-tour="sidebar-tabs"
          className="flex items-center gap-1 p-1 rounded-xl bg-ghost-surface/50 border border-ghost-border-subtle"
        >
          <TabButton
            active={isChat}
            onClick={() => setViewMode("chat")}
            label={t("chatNav")}
            icon={<MessageSquare size={15} />}
          />
          <TabButton
            active={isIncidents}
            onClick={() => setViewMode("incidents")}
            label={t("incidentsNav")}
            icon={<LayoutGrid size={15} />}
            badge={
              newIncidentCount > 0 ? (
                <NewIncidentBadge count={newIncidentCount} />
              ) : null
            }
          />
          <TabButton
            active={isOperations}
            onClick={() => setViewMode("operations")}
            label={t("operationsNav")}
            icon={<ListChecks size={15} />}
          />
        </div>
      </div>

      {/* ── Conversations list ──────────────────────────────────── */}
      <div
        data-tour="sidebar-conversations"
        className="relative z-10 flex-1 overflow-y-auto px-2 pt-1 pb-3 space-y-1"
      >
        {error && conversations.length === 0 ? (
          <button
            type="button"
            onClick={() => activeUserId && fetchConversations(activeUserId)}
            className="mx-2 mt-2 flex w-[calc(100%-1rem)] flex-col items-start gap-1 rounded-xl border border-ghost-error/30 bg-ghost-error/5 px-3 py-2.5 text-start transition-colors hover:bg-ghost-error/10"
          >
            <span className="text-[13px] font-medium text-ghost-error">
              {t("conversationsLoadError")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-text-muted">
              {t("retry")}
            </span>
          </button>
        ) : isLoading && conversations.length === 0 ? (
          <SidebarMessage label={t("loading")} />
        ) : conversations.length === 0 ? (
          <SidebarEmptyState
            primary={t("noConversations")}
            secondary={t("startNewChat")}
          />
        ) : activeUserId ? (
          <ConversationGroupsTree
            conversations={conversations}
            activeConversationId={activeConversationId}
            userId={activeUserId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onRename={(id, title) => updateConversation(id, { title })}
          />
        ) : null}
      </div>

      {/* ── Footer: account switcher + settings + logout ─────────── */}
      <div className="relative z-10 px-3 py-3 flex items-center gap-1.5 border-t border-ghost-border-subtle">
        <div data-tour="sidebar-user" className="group relative flex-1 min-w-0">
          <div className="flex items-center gap-2.5 h-11 ps-1.5 pe-2 rounded-xl transition-colors duration-[120ms] group-hover:bg-ghost-surface-hover">
            <span className="shrink-0 grid place-items-center w-8 h-8 rounded-full bg-ghost-surface border border-ghost-border-subtle text-[13px] font-medium uppercase text-ghost-text-secondary">
              {activeUser?.nickname?.slice(0, 1) || "?"}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[14px] font-medium text-ghost-text-primary">
                {activeUser?.nickname || t("noUsers")}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-success" />
                {t("settingsActiveUser")}
              </span>
            </span>
            <ChevronDown
              size={14}
              className="shrink-0 text-ghost-text-muted"
              aria-hidden="true"
            />
          </div>
          <select
            value={activeUserId || ""}
            onChange={(e) => setActiveUser(e.target.value)}
            aria-label={activeUser?.nickname || t("noUsers")}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer focus:outline-none"
          >
            {users.length === 0 && <option value="">{t("noUsers")}</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nickname}
              </option>
            ))}
          </select>
        </div>
        <button
          data-tour="sidebar-theme"
          onClick={toggleTheme}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms]"
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          data-tour="sidebar-settings"
          onClick={onOpenSettings}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms]"
          aria-label={t("settings")}
          title={t("settings")}
        >
          <Settings size={18} />
        </button>
        <button
          data-tour="sidebar-logout"
          onClick={() => logout()}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-error hover:bg-ghost-surface-hover transition-colors duration-[120ms]"
          aria-label={t("logout")}
          title={t("logout")}
        >
          <LogOut size={18} className="rtl:scale-x-[-1]" aria-hidden="true" />
        </button>
      </div>

      <SidebarResizeHandle />
    </aside>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

function TabButton({ active, onClick, label, icon, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`relative min-w-0 flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[13px] font-medium transition-colors duration-[120ms] ${
        active
          ? "bg-ghost-bg text-ghost-text-primary border border-ghost-border-subtle shadow-sm"
          : "text-ghost-text-secondary hover:text-ghost-text-primary"
      }`}
      title={label}
    >
      <span
        className={`flex-shrink-0 ${active ? "text-ghost-accent" : "text-ghost-text-muted"}`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {badge}
    </button>
  );
}

function NewIncidentBadge({ count }: { count: number }) {
  return (
    <span
      className="ghost-sidebar-incident-badge absolute -top-1.5 -end-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-ghost-text-primary text-ghost-bg text-[11px] font-semibold tabular-nums"
      title={`${count} new`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Console readout clock — bound to the operator machine's local time.
 *
 * Instead of polling, each tick self-schedules a ``setTimeout`` aligned to the
 * *next* whole-second boundary of the wall clock (``1000 - ms`` away). That
 * means the digit flips at the exact instant the system second rolls over:
 * zero perceptible lag, zero ``setInterval`` drift, no skipped/double-counted
 * seconds. The fixed timer is far cheaper than a 60fps rAF poll and never
 * "stutters" waiting for a frame. ``tabular-nums`` pins every glyph to the
 * same width so the readout can't twitch as digits change, and the seconds
 * group remounts on each value (via ``key``) to replay a tiny fade-up that
 * makes the changeover read as a smooth, intentional pulse rather than a jerk.
 * A ``visibilitychange`` re-sync snaps the clock back to real time the moment
 * the tab is shown again.
 */
function SidebarClock() {
  const [now, setNow] = useState(() => new Date());
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const d = new Date();
      setNow(d);
      // Re-aim at the next whole second; clamp so we never busy-loop.
      const msToNext = 1000 - d.getMilliseconds();
      timeoutRef.current = window.setTimeout(tick, Math.max(40, msToNext));
    };

    // Fire once immediately, then align to the upcoming second boundary.
    const initial = new Date();
    setNow(initial);
    timeoutRef.current = window.setTimeout(
      tick,
      Math.max(40, 1000 - initial.getMilliseconds()),
    );

    const resync = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      const d = new Date();
      setNow(d);
      timeoutRef.current = window.setTimeout(
        tick,
        Math.max(40, 1000 - d.getMilliseconds()),
      );
    };
    document.addEventListener("visibilitychange", resync);

    return () => {
      cancelled = true;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", resync);
    };
  }, []);

  const p = (n: number) => String(n).padStart(2, "0");
  const hh = p(now.getHours());
  const mm = p(now.getMinutes());
  const ss = p(now.getSeconds());

  return (
    <span
      dir="ltr"
      aria-hidden="true"
      title="Local operator time"
      className="ghost-sidebar-clock select-none whitespace-nowrap font-mono"
    >
      <span className="ghost-sidebar-clock__readout">
        <span className="ghost-sidebar-clock__digits">{hh}</span>
        <span className="ghost-sidebar-clock__sep">:</span>
        <span className="ghost-sidebar-clock__digits">{mm}</span>
        <span className="ghost-sidebar-clock__sep">:</span>
        <span
          key={`s-${ss}`}
          className="ghost-sidebar-clock__digits ghost-sidebar-clock__digits--sec"
        >
          {ss}
        </span>
      </span>
    </span>
  );
}

function SidebarMessage({ label }: { label: string }) {
  return (
    <div className="px-4 py-10 flex items-center justify-center">
      <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-ghost-text-muted">
        {label}
      </span>
    </div>
  );
}

function SidebarEmptyState({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <div className="px-2 pt-6 pb-5">
      <div className="px-4 py-6 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 text-center">
        <p className="text-[14px] font-medium text-ghost-text-secondary leading-snug">
          {primary}
        </p>
        <p className="mt-1.5 text-[13px] text-ghost-text-muted leading-relaxed">
          {secondary}
        </p>
      </div>
    </div>
  );
}
