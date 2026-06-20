import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, ScanEye } from "lucide-react";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";

interface SiteScanProgressCardProps {
  status: "pending" | "failed";
}

// Fixed, always-relevant environment-scan stages. Cosmetic: a shuffled cycle
// runs while the real report streams, reflecting what an environment analysis
// would be doing — never a literal backend progress signal.
const STAGES: Record<"he" | "en", string[]> = {
  he: [
    "מאתחל מנוע ניתוח סביבתי…",
    "קולט פריים מהמצלמה…",
    "מסווג סוג סביבה ותת-סביבה…",
    "מפרק ישויות ואובייקטים בזירה…",
    "ממפה אזורי בקרה וצירי תנועה…",
    "מנתח אותות חלשים (Weak Signals)…",
    "מגבש התראות קריטיות בזמן אמת…",
    "בונה צ'קליסטים ונהלי עבודה…",
    "מחבר Intelligence Deliverables…",
    "מרכיב את דוח ה-PDF…",
  ],
  en: [
    "Initializing environment analysis engine…",
    "Capturing the camera frame…",
    "Classifying environment and sub-environment…",
    "Breaking down entities and objects in the scene…",
    "Mapping control zones and movement axes…",
    "Analyzing weak signals…",
    "Compiling real-time critical alerts…",
    "Building checklists and operating procedures…",
    "Assembling intelligence deliverables…",
    "Composing the PDF report…",
  ],
};

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Transient in-chat card shown while a Sitelligence report is generating
 *  (``pending``) or after generation failed (``failed``). Visually matches
 *  {@link SiteReportCard} so the swap to the final downloadable report is
 *  seamless. Brand: monochrome ghost-* tokens; ``ghost-error`` only as a real
 *  failure status. */
export default function SiteScanProgressCard({
  status,
}: SiteScanProgressCardProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);
  const failed = status === "failed";

  // Shuffle once per mount so the order feels organic but never repeats a stage
  // back-to-back; cycle through it on an interval.
  const stages = useMemo(
    () => shuffled(STAGES[locale === "en" ? "en" : "he"]),
    [locale],
  );
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);

  useEffect(() => {
    if (failed) return;
    const id = window.setInterval(() => {
      idxRef.current = (idxRef.current + 1) % stages.length;
      setIdx(idxRef.current);
    }, 2100);
    return () => window.clearInterval(id);
  }, [failed, stages.length]);

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
        <FileText size={14} className="text-ghost-text-secondary flex-shrink-0" />
        <span className="text-[13px] font-semibold text-ghost-text-primary">
          {t("siteReportCardTitle")}
        </span>
        <span className="ms-auto font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
          Ghost // Sitelligence
        </span>
      </div>

      {failed ? (
        <div className="px-4 py-4 space-y-1.5">
          <p className="flex items-start gap-2 text-[13px] text-ghost-error leading-relaxed">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{t("siteScanFailed")}</span>
          </p>
          <p className="text-[12px] text-ghost-text-muted leading-relaxed ps-[23px]">
            {t("siteScanFailedHint")}
          </p>
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <ScanEye
              size={14}
              className="text-ghost-text-secondary flex-shrink-0"
            />
            <span className="text-[12px] font-medium text-ghost-text-primary">
              {t("siteScanTitle")}
            </span>
          </div>

          <div className="flex items-center gap-2.5 min-h-[20px]">
            <Loader2
              size={15}
              className="animate-spin text-ghost-text-secondary flex-shrink-0"
            />
            <span
              key={idx}
              className="text-[13px] text-ghost-text-secondary leading-relaxed ghost-fade-in min-w-0"
            >
              {stages[idx]}
            </span>
          </div>

          {/* Indeterminate progress shimmer — purely cosmetic. */}
          <div className="mt-3.5 h-1 rounded-full bg-ghost-border-subtle/50 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-ghost-text-muted/60 ghost-scan-sweep" />
          </div>
        </div>
      )}
    </div>
  );
}
