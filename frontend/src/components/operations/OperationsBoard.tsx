import { useMemo, useState } from "react";
import { BellRing, CalendarClock, ListChecks, Loader2 } from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import { useTaskStore } from "../../stores/taskStore";
import { useAlertStore } from "../../stores/alertStore";
import { useT } from "../../utils/i18n";
import { useOperationsRows, type OperationRow } from "./useOperationsRows";
import OperationsFilters, {
  EMPTY_OPERATIONS_FILTER,
  type OperationsFilterState,
} from "./OperationsFilters";
import OperationsTable from "./OperationsTable";
import OperationModal, { type OperationModalState } from "./OperationModal";

export default function OperationsBoard() {
  const t = useT();
  const { activeUserId, sessionType } = useUserStore();
  const { updateTask, deleteTask } = useTaskStore();
  const { updateRule, deleteRule } = useAlertStore();
  const { rows, loading } = useOperationsRows();

  const [filter, setFilter] = useState<OperationsFilterState>(
    EMPTY_OPERATIONS_FILTER,
  );
  const [modal, setModal] = useState<OperationModalState | null>(null);

  const isTrial = sessionType === "trial";

  const patchFilter = (patch: Partial<OperationsFilterState>) =>
    setFilter((s) => ({ ...s, ...patch }));

  const filtered = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (filter.type !== "all" && row.kind !== filter.type) return false;
      if (filter.status === "active" && !row.isActive) return false;
      if (filter.status === "paused" && row.isActive) return false;
      if (filter.areaId !== "all" && row.areaId !== filter.areaId) return false;
      if (filter.groupId !== "all" && row.groupId !== filter.groupId)
        return false;
      if (
        filter.conversationId !== "all" &&
        row.conversationId !== filter.conversationId
      )
        return false;
      if (q) {
        const text =
          row.kind === "task"
            ? `${row.task.name} ${row.task.prompt_text}`
            : row.rule.description;
        const hay =
          `${text} ${row.conversationTitle} ${row.areaName ?? ""} ${
            row.groupName ?? ""
          }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Active operations first, then tasks before alerts, then by name.
    return next.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === "task" ? -1 : 1;
      const an = a.kind === "task" ? a.task.name : a.rule.description;
      const bn = b.kind === "task" ? b.task.name : b.rule.description;
      return an.localeCompare(bn);
    });
  }, [rows, filter]);

  const activeCount = useMemo(
    () => rows.filter((r) => r.isActive).length,
    [rows],
  );

  const handleToggleActive = (row: OperationRow) => {
    if (!activeUserId) return;
    if (row.kind === "task") {
      void updateTask(row.task.id, activeUserId, { is_active: !row.isActive });
    } else {
      void updateRule(row.rule.id, activeUserId, { is_active: !row.isActive });
    }
  };

  const handleDelete = (row: OperationRow) => {
    if (!activeUserId) return;
    const name = row.kind === "task" ? row.task.name : row.rule.description;
    if (!window.confirm(t("opDeleteConfirm").replace("{name}", name))) return;
    if (row.kind === "task") {
      void deleteTask(row.task.id, activeUserId);
    } else {
      void deleteRule(row.rule.id, activeUserId);
    }
  };

  const totalLabel = String(rows.length).padStart(3, "0");

  return (
    <main className="flex-1 flex flex-col bg-ghost-bg min-w-0 h-screen overflow-hidden">
      <header className="relative px-6 pt-6 pb-4 flex items-end justify-between gap-5 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
              Ghost // Operations
            </span>
            <span
              className="font-mono text-[11px] tabular-nums text-ghost-text-muted"
              title={String(rows.length)}
            >
              {totalLabel}
            </span>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-success" />
                {activeCount} {t("opActive")}
              </span>
            )}
          </div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight text-ghost-text-primary truncate">
            {t("operationsTitle")}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal({ mode: "add", kind: "task" })}
            disabled={isTrial}
            title={isTrial ? t("taskTrialBlocked") : t("opAddTask")}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border border-ghost-border-subtle bg-ghost-surface text-[13px] font-medium text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CalendarClock size={15} />
            {t("opAddTask")}
          </button>
          <button
            onClick={() => setModal({ mode: "add", kind: "alert" })}
            title={t("opAddAlert")}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border border-ghost-border-subtle bg-ghost-surface text-[13px] font-medium text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms]"
          >
            <BellRing size={15} />
            {t("opAddAlert")}
          </button>
        </div>

        <span
          className="absolute bottom-0 left-6 right-6 h-px bg-ghost-border-subtle"
          aria-hidden="true"
        />
      </header>

      <div className="px-6 pt-4 pb-1">
        <OperationsFilters value={filter} onChange={patchFilter} />
      </div>

      <div className="flex-1 min-h-0 px-5 pt-4 pb-5">
        {loading && rows.length === 0 ? (
          <BoardLoadingState label={t("loading")} />
        ) : filtered.length === 0 ? (
          <BoardEmptyState
            title={
              rows.length === 0 ? t("opEmptyTitle") : t("opNoMatchTitle")
            }
            hint={rows.length === 0 ? t("opEmptyHint") : t("opNoMatchHint")}
          />
        ) : (
          <OperationsTable
            rows={filtered}
            onEdit={(row) => setModal({ mode: "edit", row })}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        )}
      </div>

      {modal && (
        <OperationModal state={modal} onClose={() => setModal(null)} />
      )}
    </main>
  );
}

function BoardLoadingState({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <span className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl border border-ghost-border-subtle bg-ghost-surface">
        <span className="absolute inset-0 rounded-xl border border-ghost-text-muted/20 animate-ping" />
        <Loader2 size={20} className="text-ghost-text-secondary animate-spin" />
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
          <ListChecks size={22} className="text-ghost-text-secondary" />
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
