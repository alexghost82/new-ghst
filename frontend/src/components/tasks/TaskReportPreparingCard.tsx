import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";

interface TaskReportPreparingCardProps {
  status: "pending" | "failed";
}

/** Transient in-chat card shown while a PDF reporting-alert task is generating
 *  its report (``pending``) or after generation failed (``failed``). Visually
 *  matches {@link TaskReportCard} so the swap to the final downloadable report
 *  is seamless. Brand: monochrome tokens, ``ghost-error`` used only as a real
 *  failure status. */
export default function TaskReportPreparingCard({
  status,
}: TaskReportPreparingCardProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const failed = status === "failed";

  return (
    <div
      className={`max-w-[420px] rounded-2xl border overflow-hidden ${
        failed
          ? "border-ghost-error/40 bg-ghost-error/5"
          : "border-ghost-border-subtle bg-ghost-surface/60"
      }`}
      dir={dir}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle/60">
        <FileText
          size={14}
          className="text-ghost-text-secondary flex-shrink-0"
        />
        <span className="text-[13px] font-semibold text-ghost-text-primary">
          {t("taskReportCardTitle")}
        </span>
        <span className="ms-auto font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
          Ghost // Report
        </span>
      </div>

      {failed ? (
        <div className="px-4 py-4 space-y-1.5">
          <p className="flex items-start gap-2 text-[13px] text-ghost-error leading-relaxed">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{t("taskReportFailed")}</span>
          </p>
          <p className="text-[12px] text-ghost-text-muted leading-relaxed ps-[23px]">
            {t("taskReportFailedHint")}
          </p>
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Loader2
              size={16}
              className="animate-spin text-ghost-text-secondary flex-shrink-0"
            />
            <span className="text-[13px] text-ghost-text-secondary">
              {t("taskReportPreparing")}
            </span>
          </div>
          <div className="mt-3 space-y-2 animate-pulse" aria-hidden="true">
            <div className="h-2.5 rounded-full bg-ghost-border-subtle/60 w-3/4" />
            <div className="h-2.5 rounded-full bg-ghost-border-subtle/60 w-1/2" />
          </div>
        </div>
      )}
    </div>
  );
}
