import {
  BellRing,
  CalendarClock,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import { taskScheduleDetail, taskTypeLabel } from "../../utils/taskSchedule";
import type { OperationRow } from "./useOperationsRows";

interface OperationsTableProps {
  rows: OperationRow[];
  onEdit: (row: OperationRow) => void;
  onDelete: (row: OperationRow) => void;
  onToggleActive: (row: OperationRow) => void;
}

function formatTimestamp(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale === "he" ? "he-IL" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HeaderCell({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-start font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted font-medium whitespace-nowrap ${className}`}
    >
      {label}
    </th>
  );
}

export default function OperationsTable({
  rows,
  onEdit,
  onDelete,
  onToggleActive,
}: OperationsTableProps) {
  const t = useT();
  const locale = useLanguageStore((s) => s.locale);

  return (
    <div className="h-full overflow-auto rounded-2xl border border-ghost-border-subtle bg-ghost-surface/20">
      <table className="w-full border-collapse text-start">
        <thead className="sticky top-0 z-10 bg-ghost-bg-secondary/95 backdrop-blur-sm">
          <tr className="border-b border-ghost-border-subtle">
            <HeaderCell label={t("opColType")} />
            <HeaderCell label={t("opColName")} />
            <HeaderCell label={t("opColConversation")} />
            <HeaderCell label={t("opColLocation")} />
            <HeaderCell label={t("opColStatus")} />
            <HeaderCell label={t("opColSchedule")} />
            <HeaderCell label={t("opColNextRun")} />
            <HeaderCell label={t("opColLastResult")} />
            <HeaderCell label={t("opColActions")} className="text-end" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isTask = row.kind === "task";
            const name = isTask ? row.task.name : row.rule.description;
            const detail = isTask ? row.task.prompt_text : "";

            const scheduleLabel = isTask
              ? `${taskTypeLabel(row.task.schedule_type, locale)} · ${
                  taskScheduleDetail(row.task, locale) || "—"
                }`
              : "—";

            const nextRun = isTask
              ? row.task.schedule_type === "once" &&
                !row.task.is_active &&
                row.task.last_run_at
                ? t("taskDone")
                : (formatTimestamp(row.task.next_run_at, locale) ?? "—")
              : "—";

            let lastResult: string;
            let lastResultTone = "text-ghost-text-secondary";
            if (isTask) {
              if (row.runError) {
                lastResult = t("taskRunError");
                lastResultTone = "text-ghost-error";
              } else {
                lastResult =
                  formatTimestamp(row.task.last_run_at, locale) ??
                  t("taskNever");
              }
            } else {
              lastResult = row.alertModeEnabled
                ? t("opAlertArmed")
                : t("opAlertDisarmed");
              lastResultTone = row.alertModeEnabled
                ? "text-ghost-success"
                : "text-ghost-text-muted";
            }

            const triggers = isTask ? (row.task.triggers ?? []) : [];

            return (
              <tr
                key={`${row.kind}-${row.id}`}
                className={`border-b border-ghost-border-subtle/60 transition-colors duration-[100ms] hover:bg-ghost-surface-hover/50 ${
                  row.isActive ? "" : "opacity-60"
                }`}
              >
                {/* Type */}
                <td className="px-3 py-3 align-top">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${
                      isTask
                        ? "border-ghost-border-subtle text-ghost-text-secondary bg-ghost-surface/50"
                        : "border-ghost-error/40 text-ghost-error bg-ghost-error/10"
                    }`}
                  >
                    {isTask ? (
                      <CalendarClock size={12} />
                    ) : (
                      <BellRing size={12} />
                    )}
                    {isTask ? t("opTypeTask") : t("opTypeAlert")}
                  </span>
                </td>

                {/* Name + detail */}
                <td className="px-3 py-3 align-top min-w-[200px] max-w-[340px]">
                  <p className="text-body font-medium text-ghost-text-primary leading-snug break-words">
                    {name}
                  </p>
                  {detail && (
                    <p className="mt-0.5 text-small text-ghost-text-muted leading-relaxed break-words line-clamp-2">
                      {detail}
                    </p>
                  )}
                  {isTask && triggers.length > 0 && (
                    <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.16em] uppercase text-ghost-text-muted">
                      <ShieldCheck size={11} />
                      {t("opTriggers")}: {triggers.length}
                    </span>
                  )}
                </td>

                {/* Conversation */}
                <td className="px-3 py-3 align-top min-w-[130px] max-w-[200px]">
                  <span className="text-small text-ghost-text-secondary break-words">
                    {row.conversationTitle || "—"}
                  </span>
                </td>

                {/* Area / Group */}
                <td className="px-3 py-3 align-top min-w-[130px]">
                  {row.areaName || row.groupName ? (
                    <span className="inline-flex flex-col gap-0.5">
                      {row.areaName && (
                        <span className="text-small text-ghost-text-secondary break-words">
                          {row.areaName}
                        </span>
                      )}
                      {row.groupName && (
                        <span className="text-[11px] text-ghost-text-muted break-words">
                          {row.groupName}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-small text-ghost-text-muted">
                      {t("opUnassigned")}
                    </span>
                  )}
                </td>

                {/* Status toggle */}
                <td className="px-3 py-3 align-top">
                  <button
                    onClick={() => onToggleActive(row)}
                    className={`inline-flex items-center gap-2 group/status`}
                    aria-label={row.isActive ? t("opActive") : t("opPaused")}
                    title={row.isActive ? t("opActive") : t("opPaused")}
                  >
                    <span
                      className={`w-10 h-6 rounded-full relative transition-colors duration-[160ms] flex-shrink-0 ${
                        row.isActive
                          ? "bg-ghost-success/80"
                          : "bg-ghost-border-subtle"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-[160ms] ${
                          row.isActive ? "end-0.5" : "start-0.5"
                        }`}
                      />
                    </span>
                    <span
                      className={`text-[11px] font-medium whitespace-nowrap ${
                        row.isActive
                          ? "text-ghost-text-secondary"
                          : "text-ghost-text-muted"
                      }`}
                    >
                      {row.isActive ? t("opActive") : t("opPaused")}
                    </span>
                  </button>
                </td>

                {/* Schedule */}
                <td className="px-3 py-3 align-top min-w-[120px]">
                  <span className="text-small text-ghost-text-secondary break-words">
                    {scheduleLabel}
                  </span>
                </td>

                {/* Next run */}
                <td className="px-3 py-3 align-top min-w-[110px]">
                  <span
                    className="text-small text-ghost-text-secondary tabular-nums whitespace-nowrap"
                    dir="ltr"
                  >
                    {nextRun}
                  </span>
                </td>

                {/* Last result */}
                <td className="px-3 py-3 align-top min-w-[110px]">
                  <span
                    className={`text-small tabular-nums whitespace-nowrap ${lastResultTone}`}
                    dir={isTask && !row.runError ? "ltr" : undefined}
                  >
                    {lastResult}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(row)}
                      className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                      aria-label={t("opEdit")}
                      title={t("opEdit")}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(row)}
                      className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-ghost-text-muted hover:text-ghost-error hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                      aria-label={t("opDelete")}
                      title={t("opDelete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
