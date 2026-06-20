import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, FileText, Loader2, Video } from "lucide-react";
import { useTaskStore } from "../../stores/taskStore";
import { useUserStore } from "../../stores/userStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useLiveStore } from "../../stores/liveStore";
import { assignmentFor } from "../../utils/conversationGroups";
import { useT } from "../../utils/i18n";
import {
  downloadTaskReportPdf,
  type ReportPdfContext,
} from "../../utils/taskReportPdf";
import { taskTypeSummary } from "../../utils/taskSchedule";
import type { TaskReport } from "../../types/api";

interface TaskReportCardProps {
  reportId: string;
  conversationId: string;
  /** The persisted chat-card text — fallback display while the full report
   *  record is still being fetched. */
  fallbackContent: string;
}

interface ParsedFallback {
  taskName: string | null;
  trigger: string | null;
  summary: string | null;
  timestamp: string | null;
}

function parseFallback(content: string): ParsedFallback {
  const taskMatch = content.match(/\u{1F4CC}\s*(?:משימה|Task)[:\s]*(.+)/u);
  const triggerMatch = content.match(/\u{1F514}\s*(?:טריגר|Trigger)[:\s]*(.+)/u);
  const summaryMatch = content.match(/\u{1F4DD}\s*(?:סיכום|Summary)[:\s]*(.+)/u);
  const timeMatch = content.match(/\u{1F550}\s*(?:זמן|Time)[:\s]*(.+)/u);
  return {
    taskName: taskMatch?.[1]?.trim() ?? null,
    trigger: triggerMatch?.[1]?.trim() ?? null,
    summary: summaryMatch?.[1]?.trim() ?? null,
    timestamp: timeMatch?.[1]?.trim() ?? null,
  };
}

export default function TaskReportCard({
  reportId,
  conversationId,
  fallbackContent,
}: TaskReportCardProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);
  const { activeUserId } = useUserStore();
  const report = useTaskStore((s): TaskReport | null => {
    for (const list of Object.values(s.reports)) {
      const found = list.find((r) => r.id === reportId);
      if (found) return found;
    }
    return null;
  });
  const fetchReports = useTaskStore((s) => s.fetchReports);
  const tasks = useTaskStore((s) => s.tasks);
  const conversations = useConversationStore((s) => s.conversations);
  const groupAreas = useConversationGroupsStore((s) => s.areas);
  const groupGroups = useConversationGroupsStore((s) => s.groups);
  const savedCameras = useLiveStore((s) => s.savedCameras);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!report && activeUserId && conversationId) {
      void fetchReports(conversationId, activeUserId);
    }
  }, [report, activeUserId, conversationId, fetchReports]);

  // Full conversation path + camera + task metadata, resolved from client
  // stores (areas/groups and camera labels never live on the report row).
  // Reused both on screen and inside the downloadable PDF.
  const pdfContext = useMemo<ReportPdfContext>(() => {
    const convId = report?.conversation_id || conversationId;
    const assignment = assignmentFor(convId, {
      areas: groupAreas,
      groups: groupGroups,
    });
    const area = assignment.areaId
      ? (groupAreas.find((a) => a.id === assignment.areaId)?.name ?? null)
      : null;
    const group = assignment.groupId
      ? (groupGroups.find((g) => g.id === assignment.groupId)?.name ?? null)
      : null;
    const conv = conversations.find((c) => c.id === convId);
    const cams = (savedCameras[convId] ?? [])
      .map((c) => c.label)
      .filter(Boolean);
    const task = report
      ? (tasks[convId] ?? []).find((t2) => t2.id === report.task_id)
      : undefined;
    const typeSummary = task ? taskTypeSummary(task, locale) : null;
    return {
      area,
      group,
      conversationTitle: conv?.title ?? null,
      cameraNames:
        cams.length > 0
          ? cams
          : report?.camera_label
            ? [report.camera_label]
            : [],
      taskName: report?.task_name ?? task?.name ?? null,
      taskType: typeSummary?.type ?? null,
      scheduleSummary: typeSummary?.schedule ?? null,
      locale,
    };
  }, [
    report,
    conversationId,
    conversations,
    groupAreas,
    groupGroups,
    savedCameras,
    tasks,
    locale,
  ]);

  const fallback = parseFallback(fallbackContent);
  const taskName = report?.task_name || fallback.taskName;
  const trigger = report?.matched_phrase || fallback.trigger;
  const summary = report?.summary || fallback.summary;
  const timestamp = report
    ? new Date(report.created_at).toLocaleString()
    : fallback.timestamp;

  const handleDownload = async () => {
    if (!report || downloading) return;
    setDownloading(true);
    try {
      await downloadTaskReportPdf(report, pdfContext);
    } catch (err) {
      console.error("[taskReport] PDF download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="max-w-[420px] rounded-2xl border border-ghost-border-subtle bg-ghost-surface/60 overflow-hidden"
      dir={dir}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle/60">
        <FileText size={14} className="text-ghost-text-secondary flex-shrink-0" />
        <span className="text-[13px] font-semibold text-ghost-text-primary">
          {t("taskReportCardTitle")}
        </span>
        <span className="ms-auto font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
          Ghost // Report
        </span>
      </div>

      {(pdfContext.area ||
        pdfContext.group ||
        pdfContext.conversationTitle ||
        (pdfContext.cameraNames?.length ?? 0) > 0) && (
        <div className="px-4 pt-2.5 flex flex-col gap-1">
          {(pdfContext.area ||
            pdfContext.group ||
            pdfContext.conversationTitle) && (
            <div className="flex items-center gap-1 flex-wrap text-[11px] text-ghost-text-muted min-w-0">
              {[pdfContext.area, pdfContext.group, pdfContext.conversationTitle]
                .filter(Boolean)
                .map((seg, i, arr) => (
                  <span key={`${i}-${seg}`} className="inline-flex items-center gap-1 min-w-0">
                    <span className="truncate max-w-[140px]">{seg}</span>
                    {i < arr.length - 1 && (
                      <span className="text-ghost-text-muted/60">›</span>
                    )}
                  </span>
                ))}
            </div>
          )}
          {(pdfContext.cameraNames?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-ghost-text-muted">
              <Video size={11} className="flex-shrink-0" />
              <span className="truncate" dir="ltr">
                {(pdfContext.cameraNames ?? []).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {report?.frame_path && (
        <div className="px-4 pt-3">
          <div className="rounded-xl overflow-hidden border border-ghost-border-subtle ghost-visint-frame">
            <img
              src={report.frame_path}
              alt={t("taskReportCardTitle")}
              className="ghost-visint-image w-full h-auto block"
              draggable={false}
            />
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        {taskName && (
          <div className="flex items-start gap-2">
            <CalendarClock
              size={13}
              className="text-ghost-text-muted flex-shrink-0 mt-0.5"
            />
            <p className="text-[13px] text-ghost-text-primary leading-relaxed min-w-0">
              <span className="text-ghost-text-muted">{t("taskReportTask")}: </span>
              {taskName}
            </p>
          </div>
        )}
        {trigger && (
          <p className="text-[13px] text-ghost-text-primary leading-relaxed">
            <span className="text-ghost-text-muted">{t("taskReportTrigger")}: </span>
            {trigger}
          </p>
        )}
        {summary && (
          <p className="text-[13px] text-ghost-text-secondary leading-relaxed">
            <span className="text-ghost-text-muted">{t("taskReportSummary")}: </span>
            {summary}
          </p>
        )}
        {timestamp && (
          <p className="text-[12px] text-ghost-text-muted tabular-nums" dir="ltr">
            {timestamp}
          </p>
        )}
      </div>

      <div className="px-4 pb-3.5">
        <button
          onClick={handleDownload}
          disabled={!report || downloading}
          className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-ghost-accent text-ghost-bg text-[13px] font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {downloading ? t("taskReportDownloading") : t("taskReportDownload")}
        </button>
      </div>
    </div>
  );
}
