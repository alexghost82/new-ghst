import { useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { LayoutGrid, Radar } from "lucide-react";
import { useIncidentStore } from "../../stores/incidentStore";
import { useUserStore } from "../../stores/userStore";
import type { IncidentStatus } from "../../types/api";
import { useT } from "../../utils/i18n";
import IncidentColumn from "./IncidentColumn";
import IncidentCard from "./IncidentCard";
import IncidentFilters from "./IncidentFilters";
import IncidentKPIBar from "./IncidentKPIBar";

const STATUSES: IncidentStatus[] = [
  "new",
  "handling",
  "investigation",
  "closed",
];

function asStatus(value: unknown): IncidentStatus | null {
  if (typeof value !== "string") return null;
  return STATUSES.includes(value as IncidentStatus)
    ? (value as IncidentStatus)
    : null;
}

/**
 * Top-level page for the incident pipeline. Owns the DnD context and
 * coordinates per-column rendering. Fetches the initial set on mount
 * and refreshes the KPI bar every 30 seconds.
 */
export default function IncidentBoard() {
  const t = useT();
  const activeUserId = useUserStore((s) => s.activeUserId);
  const users = useUserStore((s) => s.users);
  const fetchUsers = useUserStore((s) => s.fetchUsers);
  const fetchIncidents = useIncidentStore((s) => s.fetchIncidents);
  const fetchKPI = useIncidentStore((s) => s.fetchKPI);
  const moveIncident = useIncidentStore((s) => s.moveIncident);
  const setDragging = useIncidentStore((s) => s.setDragging);
  const draggingId = useIncidentStore((s) => s.draggingId);
  const incidents = useIncidentStore((s) => s.incidents);
  const loading = useIncidentStore((s) => s.loading);
  const columnOrder = useIncidentStore((s) => s.columnOrder);

  useEffect(() => {
    if (!activeUserId) return;
    fetchIncidents(activeUserId);
    fetchKPI(activeUserId, 24);
    if (users.length === 0) fetchUsers();
  }, [activeUserId, fetchIncidents, fetchKPI, fetchUsers, users.length]);

  useEffect(() => {
    if (!activeUserId) return;
    const interval = setInterval(() => {
      fetchKPI(activeUserId, 24);
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeUserId, fetchKPI]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setDragging(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!activeUserId) return;
    const id = String(e.active.id);
    const incident = incidents[id];
    if (!incident) return;

    let target: IncidentStatus | null = null;
    const overData = e.over?.data?.current as
      | { status?: unknown; type?: string }
      | undefined;
    if (overData?.type === "column") {
      target = asStatus(overData.status);
    } else if (overData?.type === "incident") {
      target = asStatus(overData.status);
    }
    if (!target || target === incident.status) return;

    moveIncident(id, activeUserId, target);
  };

  const totalIncidents = Object.keys(incidents).length;
  const draggingIncident = draggingId ? incidents[draggingId] : null;

  return (
    <main className="ghost-incident-board flex-1 flex flex-col bg-ghost-bg min-w-0 h-screen overflow-hidden">
      <header className="relative px-6 pt-6 pb-4 flex items-end justify-between gap-5 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
              Ghost // Incidents
            </span>
            <span
              className="font-mono text-[11px] tabular-nums text-ghost-text-muted"
              title={String(totalIncidents)}
            >
              {String(totalIncidents).padStart(3, "0")}
            </span>
          </div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight text-ghost-text-primary truncate">
            {t("incidentBoardTitle")}
          </h1>
        </div>
        <IncidentFilters />
        <span
          className="absolute bottom-0 left-6 right-6 h-px bg-ghost-border-subtle"
          aria-hidden="true"
        />
      </header>

      <div className="px-6 pt-4 pb-1">
        <IncidentKPIBar />
      </div>

      <div className="flex-1 min-h-0 px-5 pt-4 pb-5">
        {loading && totalIncidents === 0 ? (
          <BoardLoadingState label={t("loading")} />
        ) : totalIncidents === 0 ? (
          <BoardEmptyState
            title={t("noIncidentsBoard")}
            hint={t("incidentBoardEmptyHint")}
          />
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
          >
            <div className="grid grid-cols-4 gap-4 h-full min-h-0">
              {STATUSES.map((status) => (
                <IncidentColumn key={status} status={status} />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {draggingIncident ? (
                <div className="opacity-95 rotate-[1deg] scale-[1.02]">
                  <IncidentCard
                    incident={draggingIncident}
                    draggingOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Suppress unused linter warning for columnOrder which only triggers re-renders */}
      <span className="sr-only" aria-hidden="true">
        {Object.values(columnOrder).flat().length}
      </span>
    </main>
  );
}

function BoardLoadingState({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <span className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl border border-ghost-border-subtle bg-ghost-surface">
        <span className="absolute inset-0 rounded-xl border border-ghost-text-muted/20 animate-ping" />
        <Radar size={20} className="text-ghost-text-secondary" />
      </span>
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ghost-text-muted">
        {label}
      </span>
    </div>
  );
}

function BoardEmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="relative max-w-lg w-full px-10 py-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 text-center">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-ghost-border-subtle bg-ghost-surface mb-5">
          <LayoutGrid size={22} className="text-ghost-text-secondary" />
        </span>
        <p className="text-[16px] font-semibold text-ghost-text-primary leading-snug">
          {title}
        </p>
        <p className="mt-2 max-w-sm mx-auto text-[13.5px] text-ghost-text-secondary leading-relaxed">
          {hint}
        </p>
      </div>
    </div>
  );
}
