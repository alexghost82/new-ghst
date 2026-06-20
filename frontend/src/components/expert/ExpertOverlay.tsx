import { useEffect } from "react";
import { useExpertStore } from "../../stores/expertStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import GhostIcon from "../shared/GhostIcon";

const INTRO_MS = 2200;

/**
 * Full-screen smoked Apple-glass overlay for Ghost Expert mode.
 *
 * Visible only during the dramatic "intro" (when the operator types `expert`)
 * and the "thinking" phase (while a frame is pulled and the recommendation set
 * is generated). The interrogation itself happens in the normal chat with the
 * overlay dismissed, so the composer stays usable.
 */
export default function ExpertOverlay() {
  const active = useExpertStore((s) => s.active);
  const phase = useExpertStore((s) => s.phase);
  const beginInterrogation = useExpertStore((s) => s.beginInterrogation);
  const dir = useLanguageStore((s) => s.dir);
  const t = useT();

  const visible = active && (phase === "intro" || phase === "thinking");
  const thinking = phase === "thinking";

  useEffect(() => {
    if (phase !== "intro") return;
    const timer = window.setTimeout(() => beginInterrogation(), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [phase, beginInterrogation]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center ghost-fade-in"
      dir={dir}
      aria-live="polite"
      role="status"
    >
      {/* Smoked Apple-glass scrim with drifting ambient clouds. */}
      <div className="absolute inset-0 backdrop-blur-2xl backdrop-saturate-150 bg-ghost-bg/45" />
      <div className="ghost-ambient ghost-ambient--page absolute inset-0" aria-hidden>
        <div className="ghost-ambient__grid" />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--1"
          style={{
            background:
              "radial-gradient(circle, rgb(96 116 132 / 0.42), transparent 70%)",
          }}
        />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--2"
          style={{
            background:
              "radial-gradient(circle, rgb(56 92 96 / 0.38), transparent 70%)",
          }}
        />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--3"
          style={{
            background:
              "radial-gradient(circle, rgb(104 116 78 / 0.34), transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-[520px]">
        <span className={`relative ${thinking ? "animate-pulse" : ""}`}>
          <GhostIcon size={72} className="mb-6" />
        </span>
        <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-ghost-text-muted mb-4">
          {t("expertOverlayKicker")}
        </span>
        <h2 className="font-raanana text-[22px] font-semibold leading-tight text-ghost-text-primary">
          {thinking
            ? t("expertOverlayThinkingTitle")
            : t("expertOverlayIntroTitle")}
        </h2>
        <p className="mt-2 text-[14px] text-ghost-text-secondary leading-relaxed">
          {thinking
            ? t("expertOverlayThinkingSub")
            : t("expertOverlayIntroSub")}
        </p>
        {thinking && (
          <div
            className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-ghost-border-subtle/50"
            aria-hidden
          >
            <span className="block h-full w-1/2 rounded-full bg-ghost-text-secondary/70 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
