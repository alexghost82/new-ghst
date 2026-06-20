import { useEffect } from "react";
import {
  X,
  Check,
  Play,
  RotateCcw,
  ArrowRight,
  Compass,
  PanelLeft,
  PanelTop,
  Cctv,
  MessageSquarePlus,
  MessagesSquare,
  Brain,
  ShieldAlert,
  Settings,
  LayoutGrid,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { TOUR_CHAPTERS, TOTAL_CHAPTERS, localized } from "../../onboarding/tourSteps";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";

const ICONS: Record<string, LucideIcon> = {
  Compass,
  PanelLeft,
  PanelTop,
  Cctv,
  MessageSquarePlus,
  MessagesSquare,
  Brain,
  ShieldAlert,
  Settings,
  LayoutGrid,
  GraduationCap,
};

export default function OnboardingHub() {
  const hubOpen = useOnboardingStore((s) => s.hubOpen);
  const closeHub = useOnboardingStore((s) => s.closeHub);
  const startChapter = useOnboardingStore((s) => s.startChapter);
  const startTour = useOnboardingStore((s) => s.startTour);
  const restart = useOnboardingStore((s) => s.restart);
  const completedChapterIds = useOnboardingStore((s) => s.completedChapterIds);
  const tourStatus = useOnboardingStore((s) => s.status);

  const locale = useLanguageStore((s) => s.locale);
  const t = useT();

  useEffect(() => {
    if (!hubOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHub();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [hubOpen, closeHub]);

  if (!hubOpen) return null;

  const completedCount = completedChapterIds.length;
  const pct = Math.round((completedCount / TOTAL_CHAPTERS) * 100);
  const allDone = completedCount >= TOTAL_CHAPTERS || tourStatus === "completed";

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="absolute inset-0 bg-black/55" onClick={closeHub} />
      <div className="relative bg-ghost-bg-secondary border border-ghost-border-subtle rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col fade-in overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-ghost-border-subtle">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-ghost-accent/12 text-ghost-accent flex items-center justify-center">
                <GraduationCap size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-semibold text-ghost-text-primary leading-tight">
                  {t("onbHubTitle")}
                </h2>
                <p className="text-[12.5px] text-ghost-text-muted mt-0.5">
                  {t("onbHubSubtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={closeHub}
              className="p-1.5 rounded-lg text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
              aria-label={t("onbClose")}
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11.5px] text-ghost-text-muted mb-1.5">
              <span>
                {completedCount}/{TOTAL_CHAPTERS} · {t("onbProgress")}
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-ghost-surface overflow-hidden">
              <div
                className="h-full bg-ghost-accent rounded-full transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {TOUR_CHAPTERS.map((chapter, idx) => {
            const Icon = ICONS[chapter.icon] ?? Compass;
            const done = completedChapterIds.includes(chapter.id);
            return (
              <button
                key={chapter.id}
                onClick={() => startChapter(chapter.id)}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
              >
                <span
                  className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    done
                      ? "bg-ghost-success/15 text-ghost-success"
                      : "bg-ghost-surface text-ghost-text-secondary"
                  }`}
                >
                  {done ? <Check size={17} /> : <Icon size={17} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[10.5px] tabular-nums text-ghost-text-muted">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[14px] font-medium text-ghost-text-primary truncate">
                      {localized(chapter.title, locale)}
                    </span>
                  </span>
                  <span className="block text-[12px] text-ghost-text-muted truncate mt-0.5">
                    {localized(chapter.summary, locale)}
                  </span>
                </span>
                <span className="flex-shrink-0 text-ghost-text-muted group-hover:text-ghost-text-primary transition-colors duration-[100ms]">
                  <ArrowRight size={15} className="rtl:scale-x-[-1]" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-ghost-border-subtle flex items-center gap-2">
          <button
            onClick={restart}
            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl text-[13px] font-medium text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          >
            <RotateCcw size={15} />
            {t("onbRestart")}
          </button>
          <button
            onClick={startTour}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-[13.5px] font-semibold bg-ghost-accent text-ghost-bg hover:bg-ghost-accent-hover transition-colors duration-[100ms]"
          >
            <Play size={15} />
            {allDone ? t("onbReplay") : t("onbContinue")}
          </button>
        </div>
      </div>
    </div>
  );
}
