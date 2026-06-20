import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useOnboardingStore } from "../../stores/onboardingStore";
import {
  TOTAL_CHAPTERS,
  chapterIndexOf,
  getChapter,
  localized,
  stepAt,
} from "../../onboarding/tourSteps";
import { useTourAnchor, type AnchorRect } from "../../onboarding/useTourAnchor";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";

const CARD_WIDTH = 360;
const GAP = 14;
const MARGIN = 16;
const SPOT_PAD = 8;

type Placement = "top" | "bottom" | "left" | "right" | "center";

interface CardPos {
  top: number;
  left: number;
}

function computeCardPosition(
  rect: AnchorRect | null,
  cardW: number,
  cardH: number,
  hint: Placement,
): CardPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect || hint === "center") {
    return {
      top: Math.max(MARGIN, vh / 2 - cardH / 2),
      left: Math.max(MARGIN, vw / 2 - cardW / 2),
    };
  }

  const candidates: Record<Exclude<Placement, "center">, CardPos> = {
    bottom: {
      top: rect.top + rect.height + GAP,
      left: rect.left + rect.width / 2 - cardW / 2,
    },
    top: {
      top: rect.top - cardH - GAP,
      left: rect.left + rect.width / 2 - cardW / 2,
    },
    right: {
      top: rect.top + rect.height / 2 - cardH / 2,
      left: rect.left + rect.width + GAP,
    },
    left: {
      top: rect.top + rect.height / 2 - cardH / 2,
      left: rect.left - cardW - GAP,
    },
  };

  const order = ([hint, "bottom", "top", "right", "left"] as Placement[]).filter(
    (v, i, a) => v !== "center" && a.indexOf(v) === i,
  ) as Exclude<Placement, "center">[];

  const fits = (p: CardPos) =>
    p.left >= MARGIN &&
    p.left + cardW <= vw - MARGIN &&
    p.top >= MARGIN &&
    p.top + cardH <= vh - MARGIN;

  for (const key of order) {
    if (fits(candidates[key])) return candidates[key];
  }

  const fallback = candidates[order[0]];
  return {
    top: Math.min(Math.max(MARGIN, fallback.top), vh - cardH - MARGIN),
    left: Math.min(Math.max(MARGIN, fallback.left), vw - cardW - MARGIN),
  };
}

export default function OnboardingOverlay() {
  const status = useOnboardingStore((s) => s.status);
  const chapterId = useOnboardingStore((s) => s.currentChapterId);
  const stepIndex = useOnboardingStore((s) => s.currentStepIndex);
  const next = useOnboardingStore((s) => s.next);
  const prev = useOnboardingStore((s) => s.prev);
  const exit = useOnboardingStore((s) => s.exit);
  const finish = useOnboardingStore((s) => s.finish);

  const locale = useLanguageStore((s) => s.locale);
  const t = useT();

  const running = status === "running";
  const step = running ? stepAt(chapterId, stepIndex) : null;
  const chapter = getChapter(chapterId);
  const ci = chapterIndexOf(chapterId);
  const stepCount = chapter?.steps.length ?? 1;
  const isFirstOverall = ci <= 0 && stepIndex === 0;
  const isLastOverall =
    ci === TOTAL_CHAPTERS - 1 && stepIndex === stepCount - 1;

  const rect = useTourAnchor(step?.target ?? null);

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<CardPos>({ top: -9999, left: -9999 });
  const cardW = Math.min(CARD_WIDTH, window.innerWidth - MARGIN * 2);
  const placement = (step?.placement ?? "bottom") as Placement;

  useLayoutEffect(() => {
    if (!step) return;
    const cardH = cardRef.current?.offsetHeight ?? 220;
    setCardPos(computeCardPosition(rect, cardW, cardH, placement));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, step?.id, locale]);

  useEffect(() => {
    if (!step) return;
    const reposition = () => {
      const cardH = cardRef.current?.offsetHeight ?? 220;
      setCardPos(computeCardPosition(rect, cardW, cardH, placement));
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, step?.id]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      } else if (e.key === "ArrowRight") {
        next();
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (isLastOverall) finish();
        else next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, step?.id, isLastOverall]);

  if (!running || !step) return null;

  const overallPct = Math.round(((ci + 1) / TOTAL_CHAPTERS) * 100);
  const counter =
    locale === "he"
      ? `פרק ${ci + 1}/${TOTAL_CHAPTERS} · שלב ${stepIndex + 1}/${stepCount}`
      : `Chapter ${ci + 1}/${TOTAL_CHAPTERS} · Step ${stepIndex + 1}/${stepCount}`;

  const showSpot = !!rect;

  return (
    <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 ${showSpot ? "" : "bg-black/60"}`}
        onClick={(e) => e.stopPropagation()}
      />

      {showSpot && rect && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.85)",
            transition:
              "top 220ms cubic-bezier(0.22,1,0.36,1), left 220ms cubic-bezier(0.22,1,0.36,1), width 220ms cubic-bezier(0.22,1,0.36,1), height 220ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      )}

      <div
        ref={cardRef}
        className="absolute rounded-2xl border border-ghost-border-subtle bg-ghost-bg-secondary shadow-2xl p-5 fade-in"
        style={{
          top: cardPos.top,
          left: cardPos.left,
          width: cardW,
          transition:
            "top 200ms cubic-bezier(0.22,1,0.36,1), left 200ms cubic-bezier(0.22,1,0.36,1)",
        }}
        dir={locale === "he" ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ghost-accent">
            {chapter ? localized(chapter.title, locale) : ""}
          </span>
          <button
            onClick={exit}
            className="p-1 -m-1 rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label={t("onbExit")}
            title={t("onbExit")}
          >
            <X size={15} />
          </button>
        </div>

        <h3 className="text-[16px] font-semibold text-ghost-text-primary leading-snug">
          {localized(step.title, locale)}
        </h3>
        <p className="mt-1.5 text-[13.5px] text-ghost-text-secondary leading-relaxed">
          {localized(step.body, locale)}
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-ghost-text-muted mb-1.5">
            <span>{counter}</span>
            <span className="tabular-nums">{overallPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-ghost-surface overflow-hidden">
            <div
              className="h-full bg-ghost-accent rounded-full transition-[width] duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={exit}
            className="text-[12.5px] text-ghost-text-muted hover:text-ghost-text-secondary transition-colors duration-[100ms]"
          >
            {t("onbExit")}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={isFirstOverall}
              className="px-3 h-9 rounded-lg text-[13px] font-medium text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("onbBack")}
            </button>
            <button
              onClick={() => (isLastOverall ? finish() : next())}
              className="px-4 h-9 rounded-lg text-[13px] font-semibold bg-ghost-accent text-ghost-bg hover:bg-ghost-accent-hover transition-colors duration-[100ms]"
            >
              {isLastOverall ? t("onbFinish") : t("onbNext")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
