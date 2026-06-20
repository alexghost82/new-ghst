import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Loader2,
  Sparkles,
  Bell,
  CalendarClock,
  Check,
} from "lucide-react";
import type { ExpertReport } from "../../types/api";
import { api } from "../../api/client";
import { useLanguageStore } from "../../stores/languageStore";
import { useUserStore } from "../../stores/userStore";
import { useExpertStore } from "../../stores/expertStore";
import { useTaskStore } from "../../stores/taskStore";
import { useAlertStore } from "../../stores/alertStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useT } from "../../utils/i18n";
import { downloadExpertReportPdf } from "../../utils/expertReportPdf";

interface ExpertReportCardProps {
  reportId: string;
  conversationId: string;
}

export default function ExpertReportCard({
  reportId,
  conversationId,
}: ExpertReportCardProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);
  const activeUserId = useUserStore((s) => s.activeUserId);
  const cachedReport = useExpertStore((s) => s.reports[reportId]);
  const cacheReport = useExpertStore((s) => s.cacheReport);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchRules = useAlertStore((s) => s.fetchRules);
  const conversations = useConversationStore((s) => s.conversations);

  const [report, setReport] = useState<ExpertReport | null>(
    cachedReport ?? null,
  );
  const [downloading, setDownloading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<boolean>(!!cachedReport?.applied);
  const [applyError, setApplyError] = useState(false);

  // Hydrate from the server when the report isn't cached (e.g. after refresh).
  useEffect(() => {
    if (report || !activeUserId) return;
    let cancelled = false;
    void (async () => {
      const res = await api.getExpertReport(
        conversationId,
        reportId,
        activeUserId,
      );
      if (!cancelled && res.ok && res.data) {
        setReport(res.data);
        setApplied(!!res.data.applied);
        cacheReport(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [report, activeUserId, conversationId, reportId, cacheReport]);

  const conversationTitle = useMemo(
    () => conversations.find((c) => c.id === conversationId)?.title ?? null,
    [conversations, conversationId],
  );

  const handleDownload = async () => {
    if (!report || downloading) return;
    setDownloading(true);
    try {
      await downloadExpertReportPdf(report, { conversationTitle, locale });
    } catch (err) {
      console.error("[expertReport] PDF download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleApply = async () => {
    if (!report || !activeUserId || applying || applied) return;
    setApplying(true);
    setApplyError(false);
    const res = await api.applyExpert(conversationId, activeUserId, reportId);
    setApplying(false);
    if (res.ok) {
      setApplied(true);
      // Surface the freshly-created inactive drafts in the side panels.
      void fetchTasks(conversationId, activeUserId);
      void fetchRules(conversationId, activeUserId);
    } else {
      setApplyError(true);
    }
  };

  const taskCount = report?.tasks?.length ?? 0;
  const alertCount = report?.alerts?.length ?? 0;

  return (
    <div
      className="max-w-[440px] rounded-2xl border border-ghost-border-subtle bg-ghost-surface/60 overflow-hidden"
      dir={dir}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle/60">
        <Sparkles size={14} className="text-ghost-text-secondary flex-shrink-0" />
        <span className="text-[13px] font-semibold text-ghost-text-primary">
          {t("expertReportTitle")}
        </span>
        <span className="ms-auto font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
          Ghost // Expert
        </span>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        <p className="text-[12.5px] font-medium text-ghost-text-primary">
          {t("expertReportReady")}
        </p>
        {report?.summary && (
          <p className="text-[13px] text-ghost-text-secondary leading-relaxed">
            {report.summary}
          </p>
        )}
        <div className="flex items-center gap-3 pt-0.5">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ghost-text-secondary">
            <CalendarClock size={13} className="text-ghost-text-muted" />
            {taskCount} {t("expertReportTasksLabel")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ghost-text-secondary">
            <Bell size={13} className="text-ghost-text-muted" />
            {alertCount} {t("expertReportAlertsLabel")}
          </span>
        </div>
      </div>

      <div className="px-4 pb-3 flex flex-col gap-2">
        <button
          onClick={handleDownload}
          disabled={!report || downloading}
          className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl border border-ghost-border-subtle bg-ghost-bg/40 text-ghost-text-primary text-[13px] font-medium hover:bg-ghost-surface-hover transition-colors duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {downloading
            ? t("expertReportDownloading")
            : t("expertReportDownload")}
        </button>

        {applied ? (
          <div className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-ghost-success/15 text-ghost-success text-[13px] font-medium">
            <Check size={14} />
            {t("expertReportApplied")}
          </div>
        ) : (
          <button
            onClick={handleApply}
            disabled={!report || applying}
            className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-ghost-accent text-ghost-bg text-[13px] font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {applying ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {applying ? t("expertReportApplying") : t("expertReportApply")}
          </button>
        )}

        <p className="text-[11px] text-ghost-text-muted leading-relaxed">
          {t("expertReportApplyNote")}
        </p>
        {applyError && (
          <p className="text-[12px] text-ghost-error">
            {t("expertReportApplyError")}
          </p>
        )}
      </div>
    </div>
  );
}
