import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  CircleCheck,
  Clock,
  FileText,
  Paperclip,
  Search,
  Sparkles,
  Tag,
  User,
  X,
} from "lucide-react";
import { useIncidentStore } from "../../stores/incidentStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import { sanitizeBrand } from "../../utils/sanitize";
import type {
  IncidentEvent,
  IncidentStatus,
  IncidentSummaryResult,
} from "../../types/api";
import SeverityBadge from "./SeverityBadge";
import IncidentTimeline from "./IncidentTimeline";
import IncidentNotes from "./IncidentNotes";
import IncidentEvidence from "./IncidentEvidence";
import IncidentInvestigationChat from "./IncidentInvestigationChat";
import { formatLocalTime, relativeDuration } from "./incidentTime";

type Tab = "overview" | "timeline" | "evidence" | "investigation";

const STATUS_ORDER: IncidentStatus[] = [
  "new",
  "handling",
  "investigation",
  "closed",
];

export default function IncidentWorkspace() {
  const t = useT();
  const incidentId = useIncidentStore((s) => s.activeIncidentId);
  const closeWorkspace = useIncidentStore((s) => s.closeWorkspace);
  const incident = useIncidentStore((s) =>
    incidentId ? s.incidents[incidentId] : undefined,
  );
  const fetchIncidentDetail = useIncidentStore(
    (s) => s.fetchIncidentDetail,
  );
  const timeline = useIncidentStore((s) =>
    incidentId ? (s.timeline[incidentId] ?? []) : [],
  );
  const notes = useIncidentStore((s) =>
    incidentId ? (s.notes[incidentId] ?? []) : [],
  );
  const evidence = useIncidentStore((s) =>
    incidentId ? (s.evidence[incidentId] ?? []) : [],
  );
  const summary: IncidentSummaryResult | undefined = useIncidentStore((s) =>
    incidentId ? s.summaryDrafts[incidentId] : undefined,
  );

  const moveIncident = useIncidentStore((s) => s.moveIncident);
  const assignIncident = useIncidentStore((s) => s.assignIncident);
  const requestClose = useIncidentStore((s) => s.requestClose);
  const refreshSummary = useIncidentStore((s) => s.refreshSummary);

  const users = useUserStore((s) => s.users);
  const activeUserId = useUserStore((s) => s.activeUserId);

  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!incidentId || !activeUserId) return;
    fetchIncidentDetail(incidentId, activeUserId);
  }, [incidentId, activeUserId, fetchIncidentDetail]);

  useEffect(() => {
    setTab("overview");
  }, [incidentId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWorkspace();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeWorkspace]);

  const handleMove = (target: IncidentStatus) => {
    if (!incidentId || !activeUserId || !incident) return;
    if (incident.status === target) return;
    // Both DnD and this button funnel through the store, which already
    // intercepts ``target === 'closed'`` and opens the global modal.
    moveIncident(incidentId, activeUserId, target);
  };

  const handleAssign = (assigneeId: string | null) => {
    if (!incidentId || !activeUserId) return;
    assignIncident(incidentId, activeUserId, assigneeId);
  };

  const handleCloseRequest = () => {
    if (!incidentId) return;
    requestClose(incidentId);
  };

  const handleRefreshSummary = async () => {
    if (!incidentId || !activeUserId) return;
    setRefreshing(true);
    await refreshSummary(incidentId, activeUserId);
    setRefreshing(false);
  };

  const nextStatus = useMemo<IncidentStatus | null>(() => {
    if (!incident) return null;
    const idx = STATUS_ORDER.indexOf(incident.status);
    if (idx < 0 || idx === STATUS_ORDER.length - 1) return null;
    return STATUS_ORDER[idx + 1];
  }, [incident]);

  if (!incidentId || !incident) return null;

  const assignee = incident.assigned_to
    ? users.find((u) => u.id === incident.assigned_to)
    : undefined;
  const rel = relativeDuration(incident.created_at);
  const summaryText = sanitizeBrand(
    summary?.summary ?? incident.summary ?? "",
  );
  const aiReasoning = sanitizeBrand(incident.ai_reasoning || "");

  return (
    <aside
      role="dialog"
      aria-modal="true"
      className="fixed inset-y-0 end-0 z-[90] w-full sm:w-[640px] max-w-full bg-ghost-bg-secondary border-s border-ghost-border-subtle shadow-2xl flex flex-col"
      style={{ animation: "ghostWorkspaceSlideIn 220ms ease-out" }}
    >
      <style>{`
        @keyframes ghostWorkspaceSlideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        html[dir="rtl"] @keyframes ghostWorkspaceSlideIn {
          from { transform: translateX(-40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <header className="px-5 py-4 border-b border-ghost-border-subtle">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={incident.severity} size="sm" />
              <span className="text-[10px] uppercase tracking-wider text-ghost-text-muted">
                {t("incidentWorkspaceTitle")}
              </span>
            </div>
            <h2 className="text-base font-bold text-ghost-text-primary mt-1.5 leading-tight">
              {incident.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-ghost-text-muted mt-1 flex-wrap">
              {incident.source_camera_label && (
                <span className="inline-flex items-center gap-1">
                  <Camera size={11} />
                  {incident.source_camera_label}
                </span>
              )}
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock size={11} />
                {formatLocalTime(incident.created_at)}
                {" · "}
                {rel.key === "sNow"
                  ? t("sNow")
                  : t(rel.key).replace("{n}", String(rel.value))}
              </span>
              {incident.tags.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Tag size={11} />
                  {incident.tags.join(", ")}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={closeWorkspace}
            className="p-1.5 rounded-lg text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover"
            aria-label={t("closePreview")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <select
            value={incident.assigned_to ?? ""}
            onChange={(e) => handleAssign(e.target.value || null)}
            className="bg-ghost-surface border border-ghost-border-subtle rounded-lg px-2 py-1.5 text-small text-ghost-text-primary focus:outline-none focus:border-ghost-text-primary/45"
          >
            <option value="">{t("unassign")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nickname}
              </option>
            ))}
          </select>

          {nextStatus && incident.status !== "closed" && (
            <button
              onClick={() => handleMove(nextStatus)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-surface border border-ghost-border-subtle text-small text-ghost-text-primary hover:bg-ghost-surface-hover"
            >
              <ArrowRight size={12} />
              {nextStatus === "handling"
                ? t("moveToHandling")
                : nextStatus === "investigation"
                  ? t("moveToInvestigation")
                  : t("closeIncident")}
            </button>
          )}

          {incident.status !== "closed" && (
            <button
              onClick={handleCloseRequest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-small text-green-500 hover:bg-green-500/20"
            >
              <CircleCheck size={12} />
              {t("closeIncident")}
            </button>
          )}

          {assignee && (
            <span className="ms-auto inline-flex items-center gap-1.5 text-xs text-ghost-text-muted">
              <User size={11} />
              {assignee.nickname}
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav
        className="flex items-stretch gap-0 border-b border-ghost-border-subtle bg-ghost-surface/30"
        role="tablist"
      >
        <TabButton
          active={tab === "overview"}
          onClick={() => setTab("overview")}
          icon={<Sparkles size={13} />}
          label={t("incidentOverview")}
        />
        <TabButton
          active={tab === "timeline"}
          onClick={() => setTab("timeline")}
          icon={<Clock size={13} />}
          label={t("incidentTimeline")}
          count={timeline.length}
        />
        <TabButton
          active={tab === "evidence"}
          onClick={() => setTab("evidence")}
          icon={<Paperclip size={13} />}
          label={t("incidentEvidence")}
          count={evidence.length}
        />
        <TabButton
          active={tab === "investigation"}
          onClick={() => setTab("investigation")}
          icon={<Search size={13} />}
          label={t("incidentInvestigation")}
        />
      </nav>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {tab === "overview" && (
          <OverviewTab
            incident={incident}
            summary={summaryText}
            aiReasoning={aiReasoning}
            keyObservations={summary?.key_observations}
            onRefreshSummary={handleRefreshSummary}
            refreshing={refreshing}
          />
        )}
        {tab === "timeline" && (
          <div className="space-y-4">
            <IncidentTimeline items={timeline} />
            <div className="border-t border-ghost-border-subtle pt-3">
              <h4 className="text-[10px] uppercase tracking-wider text-ghost-text-muted mb-2 font-semibold">
                {t("incidentNotes")}
              </h4>
              <IncidentNotes incidentId={incidentId} notes={notes} />
            </div>
          </div>
        )}
        {tab === "evidence" && (
          <IncidentEvidence incidentId={incidentId} evidence={evidence} />
        )}
        {tab === "investigation" && (
          <IncidentInvestigationChat incidentId={incidentId} />
        )}
      </div>

      {/* Close modal is rendered globally via <IncidentCloseModal/> in App.tsx
          so that DnD, status-step buttons and this workspace's "Close
          incident" button all funnel through the same gate. */}
    </aside>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

function TabButton({ active, onClick, icon, label, count }: TabButtonProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-small font-medium border-b-2 transition-colors ${
        active
          ? "border-ghost-text-primary text-ghost-text-primary"
          : "border-transparent text-ghost-text-muted hover:text-ghost-text-secondary"
      }`}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[10px] tabular-nums opacity-60">({count})</span>
      )}
    </button>
  );
}

interface OverviewTabProps {
  incident: IncidentEvent;
  summary: string;
  aiReasoning: string;
  keyObservations?: string[];
  onRefreshSummary: () => void;
  refreshing: boolean;
}

function OverviewTab({
  incident,
  summary,
  aiReasoning,
  keyObservations,
  onRefreshSummary,
  refreshing,
}: OverviewTabProps) {
  const t = useT();
  return (
    <div className="space-y-5">
      {incident.preview_image_path && (
        <div className="rounded-xl overflow-hidden border border-ghost-border-subtle">
          <img
            src={incident.preview_image_path}
            alt={incident.title}
            className="w-full h-auto block"
            style={{ filter: "grayscale(0.5) contrast(1.05)" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {aiReasoning && (
        <section>
          <h4 className="text-[10px] uppercase tracking-wider text-ghost-text-muted mb-1.5 font-semibold flex items-center gap-1.5">
            <FileText size={11} />
            {t("aiReasoningLabel")}
          </h4>
          <p className="text-small text-ghost-text-secondary leading-relaxed whitespace-pre-wrap">
            {aiReasoning}
          </p>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-[10px] uppercase tracking-wider text-ghost-text-muted font-semibold flex items-center gap-1.5">
            {incident.status === "closed" ? (
              <CircleCheck size={11} className="text-green-500" />
            ) : (
              <Sparkles size={11} />
            )}
            {incident.status === "closed"
              ? t("closedSummaryLabel")
              : t("incidentSummary")}
          </h4>
          {/* Once closed, the operator's written summary is the canonical
              record — block the AI refresh button so it can't overwrite. */}
          {incident.status !== "closed" && (
            <button
              onClick={onRefreshSummary}
              disabled={refreshing}
              className="text-xs text-ghost-text-secondary hover:opacity-80 disabled:opacity-40"
            >
              {refreshing ? t("loading") : t("refreshSummary")}
            </button>
          )}
        </div>
        {summary ? (
          <p
            className={`text-small text-ghost-text-primary leading-relaxed whitespace-pre-wrap ${
              incident.status === "closed"
                ? "rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2"
                : ""
            }`}
          >
            {summary}
          </p>
        ) : (
          <p className="text-small text-ghost-text-muted opacity-70">—</p>
        )}
        {keyObservations && keyObservations.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-small text-ghost-text-secondary space-y-1">
            {keyObservations.map((obs, idx) => (
              <li key={idx}>{sanitizeBrand(obs)}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-[10px] uppercase tracking-wider text-ghost-text-muted mb-1.5 font-semibold">
          {t("openedAt")} / {t("closedAt")}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-small text-ghost-text-secondary">
          <div className="bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2">
            <p className="text-[10px] text-ghost-text-muted uppercase">
              {t("openedAt")}
            </p>
            <p className="tabular-nums">
              {new Date(incident.created_at).toLocaleString()}
            </p>
          </div>
          <div className="bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2">
            <p className="text-[10px] text-ghost-text-muted uppercase">
              {t("closedAt")}
            </p>
            <p className="tabular-nums">
              {incident.closed_at
                ? new Date(incident.closed_at).toLocaleString()
                : "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
