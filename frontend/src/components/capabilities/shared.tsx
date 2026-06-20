import { useEffect, useRef, useState } from "react";
import type { DemoKey } from "../../data/capabilities";
import DemoChatThread from "./demos/DemoChatThread";
import DemoLiveCameraStage from "./demos/DemoLiveCameraStage";
import DemoSidebarTree from "./demos/DemoSidebarTree";
import DemoSystemPromptEditor from "./demos/DemoSystemPromptEditor";
import DemoMemoryPanel from "./demos/DemoMemoryPanel";
import DemoSiteIntelligence from "./demos/DemoSiteIntelligence";
import DemoBroadcast from "./demos/DemoBroadcast";
import DemoAlerts from "./demos/DemoAlerts";

// ── Quiet "fade up" reveal — same motion used across the marketing pages ──────
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition:
          "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
        transitionDelay: `${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="min-w-0 font-mono text-[10px] sm:text-[11px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance">
        {children}
      </span>
      <span className="flex-1 h-px bg-ghost-border-subtle" />
    </div>
  );
}

// Per-demo frame body height (the desktop max); demos that own their own
// sizing are left auto. DemoFrame scales this down on narrow viewports so the
// embeds don't dominate a phone screen with a long scroll.
export const FRAME_HEIGHT: Partial<Record<DemoKey, number>> = {
  chat: 480,
  history: 480,
  broadcast: 480,
  siteScan: 480,
  organize: 480,
};

export function DemoFor({ demo }: { demo: DemoKey }) {
  switch (demo) {
    case "chat":
      return <DemoChatThread variant="free" />;
    case "history":
      return <DemoChatThread variant="history" />;
    case "broadcast":
      return <DemoBroadcast />;
    case "siteScan":
      return <DemoSiteIntelligence />;
    case "cameras":
      return <DemoLiveCameraStage />;
    case "organize":
      return (
        <div className="h-full bg-ghost-sidebar flex justify-center overflow-hidden">
          <DemoSidebarTree />
        </div>
      );
    case "systemPrompt":
      return <DemoSystemPromptEditor />;
    case "memory":
      return (
        <div className="flex justify-center py-6 bg-ghost-bg">
          <DemoMemoryPanel />
        </div>
      );
    case "alerts":
      return <DemoAlerts />;
    default:
      return null;
  }
}

export function DemoFrame({
  demo,
  tag,
  className = "",
}: {
  demo: DemoKey;
  tag: string;
  className?: string;
}) {
  const height = FRAME_HEIGHT[demo];
  return (
    <div
      className={`rounded-2xl border border-ghost-border-subtle bg-ghost-surface/20 overflow-hidden shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 px-4 h-9 border-b border-ghost-border-subtle/70 bg-ghost-bg/60">
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-ghost-text-muted/30" />
          <span className="w-2.5 h-2.5 rounded-full bg-ghost-text-muted/30" />
          <span className="w-2.5 h-2.5 rounded-full bg-ghost-text-muted/30" />
        </span>
        <span className="ms-auto font-sans text-[10px] font-medium tracking-[0.12em] uppercase text-ghost-text-muted">
          {tag}
        </span>
      </div>
      <div
        style={
          height
            ? { height: `clamp(${Math.round(height * 0.75)}px, 80vw, ${height}px)` }
            : undefined
        }
        className="relative"
      >
        <DemoFor demo={demo} />
      </div>
    </div>
  );
}
