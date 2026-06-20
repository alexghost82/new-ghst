import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  CameraOff,
  Cable,
  Cpu,
  MonitorSmartphone,
  ShieldCheck,
  ShieldAlert,
  ScrollText,
  KeyRound,
  EyeOff,
  Server,
  CloudOff,
  Cloud,
  Building2,
  Network,
  Radar,
  MessageSquareText,
  Clock,
  Clock3,
  History,
  Layers,
  FileText,
  Sun,
  Moon,
  Lock,
  Video,
  Plus,
  CalendarClock,
  Plane,
  MessageSquare,
  LayoutGrid,
  PanelLeftClose,
  Settings,
  LogOut,
  Languages,
  Brain,
  SlidersHorizontal,
  ScanEye,
  AudioLines,
  ChevronDown,
  Cctv,
} from "lucide-react";
import { useThemeStore } from "../../stores/themeStore";
import { SECTORS } from "../../data/useCases";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import type { Dir } from "../../stores/languageStore";
import {
  DEFENSE_COPY,
  DEFENSE_SECTOR_CARDS,
  type DefenseCopy,
  type DemoTurnCopy,
  type WatchDefineCopy,
} from "../../site/copy/defense";
import IntelFigure from "../shared/IntelFigure";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface DefenseIntelligencePageProps {
  onBack: () => void;
  onAccess: () => void;
  // Shared marketing-site navigation (drives the persistent sidebar).
  onNavigate: (page: SitePage) => void;
  // Opens the per-sector use-case library from in-body links. Passing a sector
  // id deep-links straight into that sector's page.
  onShowUseCases?: (sectorId?: string) => void;
}

// ── Motion helpers ──────────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

// Quiet "fade up" reveal — the only entrance motion on the page, kept
// deliberately subtle so the surface stays calm (ChatGPT-style restraint).
function Reveal({
  children,
  delay = 0,
  y = 14,
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
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
        ...style,
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

// ── Engine capability card ───────────────────────────────────────────────
// Clean, monochrome card matching the /capabilities design line: quiet border,
// subtle surface, gentle hover-lift. No tactical viewfinder chrome or color
// accents — the page reads as one continuous family with /capabilities.
function EngineCard({
  icon: Icon,
  index,
  title,
  body,
  tag,
}: {
  icon: React.ComponentType<{ size?: number }>;
  index: number;
  title: string;
  body: string;
  tag: string;
}) {
  return (
    <div className="group h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/20 p-5 flex flex-col transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/40 hover:border-ghost-text-muted/30">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-ghost-text-muted tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted">
          {tag}
        </span>
      </div>

      <span className="mt-5 w-11 h-11 flex-shrink-0 rounded-xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]">
        <Icon size={19} />
      </span>

      <h3 className="mt-4 text-[15.5px] font-medium text-ghost-text-primary leading-tight tracking-[-0.01em]">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ghost-text-secondary">
        {body}
      </p>
    </div>
  );
}

// ── Ambient wallpaper backdrop ───────────────────────────────────────────
// Apple-desktop-style soft color fields that drift slowly behind a section.
// Decorative only (aria-hidden), low-opacity, and confined to the section it
// sits inside so the rest of the page stays calm and monochrome.

type AmbientBlob = { className: string; style: React.CSSProperties };

// Dark, desaturated "tactical" palette — gunmetal, olive, petrol and charcoal.
// On the dark surface these read as a smoky, low-signature wash rather than a
// bright Apple aurora; with screen/multiply blend they stay subtle.
const HUE = {
  steel: "rgb(96 116 132 / 0.9)",
  olive: "rgb(104 116 78 / 0.85)",
  petrol: "rgb(56 92 96 / 0.88)",
  charcoal: "rgb(58 66 70 / 0.95)",
  khaki: "rgb(120 106 72 / 0.78)",
} as const;

function blob(
  className: string,
  pos: React.CSSProperties,
  size: number,
  color: string,
): AmbientBlob {
  return {
    className,
    style: {
      ...pos,
      width: size,
      height: size,
      background: `radial-gradient(circle, ${color}, transparent 70%)`,
    },
  };
}

// Per-band blob recipes — placed mostly off the section edges so only the soft
// falloff bleeds in, alternating hue + corner for an organic feel as you scroll.
const BAND = {
  gap: [blob("ghost-ambient__blob--1", { top: -180, right: "-6%" }, 460, HUE.steel)],
  doctrine: [
    blob("ghost-ambient__blob--3", { bottom: -200, left: "-8%" }, 500, HUE.olive),
    blob("ghost-ambient__blob--2", { top: -140, right: "0%" }, 340, HUE.charcoal),
  ],
  capabilities: [
    blob("ghost-ambient__blob--2", { top: -160, left: "-6%" }, 460, HUE.steel),
  ],
  watch: [
    blob("ghost-ambient__blob--1", { top: -150, left: "-4%" }, 400, HUE.petrol),
    blob("ghost-ambient__blob--3", { bottom: -180, right: "-6%" }, 440, HUE.charcoal),
  ],
  pipeline: [
    blob("ghost-ambient__blob--2", { bottom: -200, right: "-6%" }, 500, HUE.steel),
  ],
  usecases: [
    blob("ghost-ambient__blob--1", { top: -170, left: "-6%" }, 460, HUE.olive),
    blob("ghost-ambient__blob--3", { bottom: -190, right: "-4%" }, 420, HUE.charcoal),
  ],
  practice: [
    blob("ghost-ambient__blob--2", { top: -150, right: "-4%" }, 440, HUE.petrol),
  ],
} as const;

// Full-bleed section wrapper matching the /capabilities rhythm: each section
// spans the column, carries its own vertical padding, and centers its content
// in an inner max-w-6xl container. `tone="alt"` paints a secondary background
// band so consecutive "chapters" read as distinct stations. `blobs` is
// intentionally ignored (kept for call-site compatibility).
function AmbientSection({
  className = "",
  id,
  tone = "base",
  children,
}: {
  blobs?: readonly AmbientBlob[];
  className?: string;
  id?: string;
  tone?: "base" | "alt";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative z-10 ${
        tone === "alt" ? "bg-ghost-bg-secondary" : ""
      } ${className}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {children}
      </div>
    </section>
  );
}

// Chapter-style kicker — mono uppercase label that sits directly above a
// .ghost-display heading (no rule line), matching the /capabilities sections.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 font-mono text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance">
      {children}
    </div>
  );
}

// Three bouncing dots — the canonical ChatGPT "thinking" indicator.
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Thinking">
      <span className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse-dot" />
      <span
        className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse-dot"
        style={{ animationDelay: "0.18s" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse-dot"
        style={{ animationDelay: "0.36s" }}
      />
    </span>
  );
}

// Icons + brand-English mono tags, zipped positionally with the bilingual
// copy in DEFENSE_COPY (the visitor-readable strings live in the copy module).
const LAYER_META = [
  { icon: History, tag: "Memory" },
  { icon: Radar, tag: "Live" },
  { icon: Clock, tag: "Watch" },
] as const;

const CAPABILITY_ICONS = [
  MessageSquareText,
  ScrollText,
  Radar,
  Clock,
  Network,
  Layers,
] as const;

const PIPELINE_ICONS = [Camera, Cable, Cpu, MonitorSmartphone] as const;

const DEPLOYMENT_ICONS = [Server, CloudOff, Cable, Cloud, Building2] as const;

const COMPLIANCE_ICONS = [ShieldCheck, ScrollText, KeyRound, EyeOff] as const;

const ENGINE_META = [
  { icon: Cpu, tag: "Core" },
  { icon: History, tag: "Memory" },
  { icon: Radar, tag: "Signal" },
  { icon: Network, tag: "Correlation" },
] as const;

// ── Interface mockup ──────────────────────────────────────────────────────
// A faithful, flat reproduction of the real Ghost operator UI built from the
// same ghost-* tokens as the live app, now with an auto-playing conversation
// (typewriter question → thinking dots → streamed answer) so visitors watch
// the product work, not just look at it.

const SCENE_NIGHT =
  "radial-gradient(120% 90% at 50% 110%, rgb(28 42 38 / 0.9), transparent 60%), radial-gradient(80% 70% at 78% 12%, rgb(48 72 64 / 0.55), transparent 60%), linear-gradient(180deg, #0b1412 0%, #0a0f0e 60%, #060908 100%)";
const SCENE_DOCK =
  "radial-gradient(120% 90% at 30% 110%, rgb(40 44 56 / 0.9), transparent 60%), radial-gradient(70% 60% at 80% 0%, rgb(60 66 86 / 0.5), transparent 60%), linear-gradient(180deg, #0c0f16 0%, #0a0c12 60%, #070809 100%)";

function CameraViewport({
  scene,
  cam,
  time,
  image,
}: {
  scene: string;
  cam: string;
  time: string;
  image?: string;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-white/10"
      style={{ aspectRatio: "16 / 9", background: scene }}
      dir="ltr"
    >
      {image && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "saturate(0.82) contrast(1.06) brightness(0.92)" }}
          />
          {/* Blend the photo into the scene's color palette so it reads as one CCTV system. */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: scene, mixBlendMode: "soft-light", opacity: 0.55 }}
          />
        </>
      )}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)",
        }}
      />
      <span className="absolute top-2 left-2 w-3.5 h-3.5 border-t border-l border-white/40" />
      <span className="absolute top-2 right-2 w-3.5 h-3.5 border-t border-r border-white/40" />
      <span className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b border-l border-white/40" />
      <span className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b border-r border-white/40" />

      <span className="absolute top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.18em] uppercase text-white/85">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f57] animate-pulse" />
        REC
      </span>
      <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] text-white/80">
        <Video size={10} className="flex-shrink-0" />
        <span className="truncate">{cam}</span>
        <span className="text-white/45">·</span>
        <span className="flex-shrink-0">{time}</span>
      </span>
    </div>
  );
}

// Mirrors the real sidebar conversation rows: a circular live-camera avatar,
// title, a relative-time meta cap, and a status subtitle. Statuses map 1:1 to
// ConversationItem.renderStatus (live / alert / cameras / messages).
const MOCK_CONVOS = [
  { name: "Main Gate", status: "live", active: true, time: "now" },
  { name: "Loading Bay", status: "alert", active: false, time: "2m" },
  { name: "Fence Line — East", status: "cams", count: 3, active: false, time: "14m" },
  { name: "Substation 7", status: "cams1", active: false, time: "1h" },
  { name: "Lobby Desk", status: "idle", messages: 8, active: false, time: "3h" },
] as const;

function ConvStatus({ status, count }: { status: string; count?: number }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-ghost-text-secondary">
        <span className="ghost-conv-status-dot" aria-hidden="true" />
        <span className="truncate">Live</span>
      </span>
    );
  }
  if (status === "alert") {
    return (
      <span className="inline-flex items-center gap-1 text-ghost-error">
        <ShieldAlert size={11} strokeWidth={2.2} className="flex-shrink-0" />
        <span className="truncate">Alert mode</span>
      </span>
    );
  }
  if (status === "cams") {
    return (
      <span className="inline-flex items-center gap-1 text-ghost-text-muted">
        <Video size={11} className="flex-shrink-0 opacity-80" />
        <span className="truncate">{count ?? 3} cameras</span>
      </span>
    );
  }
  if (status === "cams1") {
    return (
      <span className="inline-flex items-center gap-1 text-ghost-text-muted">
        <Video size={11} className="flex-shrink-0 opacity-80" />
        <span className="truncate">1 camera</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-ghost-text-muted">
      <MessageSquare size={11} className="flex-shrink-0 opacity-70" />
      <span className="truncate">{count ?? 8} messages</span>
    </span>
  );
}

// A faithful, static replica of the real post-login Sidebar:
// brand header → Chat/Incidents segmented tabs → Drone shortcut →
// conversation rows (circular live-camera avatars + relative-time + status) →
// footer (user picker + settings + logout). Mirrors Sidebar.tsx 1:1.
function MockSidebar({ theme }: { theme: "light" | "dark" }) {
  const ghostIcon = theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png";
  return (
    <aside className="hidden md:flex flex-col w-[256px] flex-shrink-0 bg-ghost-sidebar">
      {/* Brand header */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <img
            src={ghostIcon}
            alt="Ghost"
            className="w-8 h-8 object-contain flex-shrink-0 rounded-[7px]"
            draggable={false}
          />
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
            <Plus size={18} />
          </span>
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
            <PanelLeftClose size={18} />
          </span>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="px-3 pt-2 pb-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-ghost-surface/60">
          <span className="relative flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[14px] font-medium bg-ghost-bg text-ghost-text-primary shadow-sm">
            <MessageSquare size={15} className="text-ghost-text-primary" />
            Chat
          </span>
          <span className="relative flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[14px] font-medium text-ghost-text-secondary">
            <LayoutGrid size={15} className="text-ghost-text-muted" />
            Incidents
          </span>
        </div>
      </div>

      {/* Drone shortcut */}
      <div className="px-3 pb-1">
        <span className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[14px] font-medium text-ghost-text-secondary">
          <Plane size={16} className="text-ghost-text-muted" />
          <span className="flex-1 text-start truncate">Drone Detection</span>
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ghost-text-muted border border-ghost-border-subtle rounded px-1.5 py-0.5">
            LKM
          </span>
        </span>
      </div>

      {/* Conversation rows */}
      <div className="flex-1 overflow-y-auto px-2 pt-1 pb-3 space-y-1">
        {MOCK_CONVOS.map((c) => (
          <div
            key={c.name}
            className={`ghost-conv-item group w-full text-start ps-1.5 pe-2 py-2 relative ${
              c.active ? "ghost-conv-item--active" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`ghost-conv-avatar flex-shrink-0 self-center relative ${
                  c.status === "live" ? "ghost-conv-avatar--live" : ""
                }`}
                aria-hidden="true"
              >
                <span className="ghost-conv-avatar__icon">
                  {c.status === "idle" ? (
                    <CameraOff size={16} strokeWidth={1.75} />
                  ) : (
                    <Camera size={17} strokeWidth={1.75} />
                  )}
                </span>
                {c.status === "live" && (
                  <span className="ghost-conv-live-dot" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    {c.status === "alert" && (
                      <ShieldAlert
                        size={13}
                        className="flex-shrink-0 text-ghost-error animate-pulse"
                        aria-label="Alert mode active"
                      />
                    )}
                    <p
                      className={`text-[14px] truncate leading-snug ${
                        c.active
                          ? "text-ghost-text-primary font-semibold"
                          : "text-ghost-text-primary font-medium"
                      }`}
                    >
                      {c.name}
                    </p>
                  </div>
                  <span className="flex-shrink-0 self-start h-[18px] inline-flex items-center gap-1 text-[11px] leading-none text-ghost-text-muted/90 tabular-nums whitespace-nowrap">
                    <Clock3
                      size={10}
                      strokeWidth={2}
                      className="flex-shrink-0 opacity-70"
                      aria-hidden="true"
                    />
                    <span className="truncate">{c.time}</span>
                  </span>
                </div>

                <div className="ghost-conv-subtitle mt-1 text-[11.5px] leading-none truncate">
                  <ConvStatus
                    status={c.status}
                    count={
                      "count" in c
                        ? c.count
                        : "messages" in c
                          ? c.messages
                          : undefined
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer: user picker + settings + logout */}
      <div className="px-3 py-3 flex items-center gap-2 border-t border-ghost-border-subtle">
        <span
          className="flex-1 min-w-0 inline-flex items-center justify-between text-ghost-text-secondary text-[14px] rounded-lg ps-3 pe-2 py-2 truncate"
          aria-hidden="true"
        >
          <span className="truncate">Operator · North</span>
          <ChevronDown size={14} className="text-ghost-text-muted flex-shrink-0" />
        </span>
        <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
          <Settings size={18} />
        </span>
        <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
          <LogOut size={18} />
        </span>
      </div>
    </aside>
  );
}

// Structural half of the conversation script the hero window auto-plays on a
// loop — camera ids, frames and timestamps (mono chrome, English in both
// locales). The conversational q/a text is zipped in from DEFENSE_COPY.
const DEMO_FRAMES: {
  cam: string;
  frame: { scene: string; time: string; image?: string } | null;
}[] = [
  {
    cam: "Main Gate · CAM-04",
    frame: {
      scene: SCENE_NIGHT,
      time: "02:41:07",
      image: "/ghost-cam-gate-night.png",
    },
  },
  {
    cam: "Main Gate · CAM-04",
    frame: null,
  },
];

type DemoItem = (typeof DEMO_FRAMES)[number] & DemoTurnCopy;

type DemoPhase = "typing" | "thinking" | "streaming" | "hold";

function useChatDemo(reduced: boolean, script: DemoItem[]) {
  const [step, setStep] = useState(0);
  const [qLen, setQLen] = useState(0);
  const [aLen, setALen] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>("typing");

  // Restart the loop from the top when the script changes (locale switch).
  useEffect(() => {
    setStep(0);
    setQLen(0);
    setALen(0);
    setPhase("typing");
  }, [script]);

  useEffect(() => {
    if (reduced) return; // static: full first item shown
    const item = script[step] ?? script[0];
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (qLen < item.q.length) {
        timer = setTimeout(() => setQLen((n) => n + 1), 26);
      } else {
        timer = setTimeout(() => setPhase("thinking"), 520);
      }
    } else if (phase === "thinking") {
      timer = setTimeout(() => setPhase("streaming"), 1150);
    } else if (phase === "streaming") {
      if (aLen < item.a.length) {
        timer = setTimeout(() => setALen((n) => Math.min(n + 2, item.a.length)), 16);
      } else {
        timer = setTimeout(() => setPhase("hold"), 2800);
      }
    } else {
      timer = setTimeout(() => {
        setStep((s) => (s + 1) % script.length);
        setQLen(0);
        setALen(0);
        setPhase("typing");
      }, 240);
    }

    return () => clearTimeout(timer);
  }, [phase, qLen, aLen, step, reduced, script]);

  if (reduced) {
    const item = script[0];
    return {
      item,
      qText: item.q,
      aText: item.a,
      phase: "streaming" as DemoPhase,
      showFrame: true,
    };
  }

  const item = script[step] ?? script[0];
  return {
    item,
    qText: item.q.slice(0, qLen),
    aText: item.a.slice(0, aLen),
    phase,
    showFrame: phase === "streaming" || phase === "hold",
  };
}

function Caret() {
  return (
    <span className="inline-block w-[2px] h-[1.05em] -mb-[0.15em] ms-0.5 bg-ghost-text-primary animate-pulse" />
  );
}

function LiveAppWindow({ demo, dir }: { demo: DemoTurnCopy[]; dir: Dir }) {
  const reduced = usePrefersReducedMotion();
  const theme = useThemeStore((s) => s.theme);
  // Zip the structural frames with the localized conversational turns.
  const script = useMemo<DemoItem[]>(
    () => DEMO_FRAMES.map((f, i) => ({ ...f, ...demo[i] })),
    [demo],
  );
  const { item, qText, aText, phase, showFrame } = useChatDemo(reduced, script);
  const ghostIcon = theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png";

  return (
    <div
      dir="ltr"
      className="rounded-2xl border border-ghost-border-subtle bg-ghost-bg overflow-hidden shadow-[0_1px_3px_rgb(0_0_0/0.10),0_18px_50px_-20px_rgb(0_0_0/0.30)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-ghost-text-muted/30 hover:shadow-[0_1px_3px_rgb(0_0_0/0.12),0_30px_70px_-24px_rgb(0_0_0/0.42)]"
    >
      {/* titlebar */}
      <div className="flex items-center gap-2 h-10 px-3.5 border-b border-ghost-border-subtle bg-ghost-surface/30">
        <span className="flex-1 text-center font-mono text-[11px] tracking-[0.14em] text-ghost-text-muted">
          Ghost — North Sector
        </span>
      </div>

      <div className="flex h-[min(60vh,420px)] sm:h-[508px]">
        <MockSidebar theme={theme} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* chat header — mirrors ChatHeader.tsx */}
          <header className="flex flex-col gap-2 px-4 py-2.5 border-b border-ghost-border-subtle flex-shrink-0">
            <div className="flex items-center justify-between gap-2 min-h-[44px]">
              <div className="flex items-center gap-1 min-w-0">
                <h1 className="text-[16px] font-semibold text-ghost-text-primary truncate">
                  Main Gate
                </h1>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <span className="hidden xs:flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-[13px] font-medium text-ghost-text-secondary">
                  <Languages size={14} />
                  <span className="uppercase tracking-wide">EN</span>
                </span>
                <span className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-ghost-text-secondary">
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </span>
                <span className="hidden xs:flex w-9 h-9 rounded-lg items-center justify-center text-ghost-text-secondary">
                  <ScanEye size={16} />
                </span>
                <span className="hidden xs:flex w-9 h-9 rounded-lg items-center justify-center text-ghost-text-secondary">
                  <Brain size={16} />
                </span>
                <span className="relative w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-primary bg-ghost-surface">
                  <ShieldAlert size={16} />
                  <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full bg-ghost-success animate-pulse" />
                </span>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
                  <SlidersHorizontal size={16} />
                </span>
              </div>
            </div>

            {/* linked-cameras chip row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] text-ghost-text-muted me-0.5">
                Cameras linked to this conversation
              </span>
              <span className="inline-flex items-center gap-1.5 bg-ghost-surface rounded-full px-3 py-1 text-[13px] text-ghost-text-secondary">
                <Cctv size={14} className="text-ghost-text-muted flex-shrink-0" />
                <span className="whitespace-nowrap">Main Gate · CAM-04</span>
              </span>
            </div>
          </header>

          {/* messages — mirrors MessageBubble.tsx; the conversational bubbles
              follow the site locale while the window chrome stays LTR. */}
          <div className="flex-1 overflow-hidden px-4 py-5">
            <div className="mx-auto max-w-chat" dir={dir}>
              {/* user question (typewriter) */}
              <div className="flex justify-end mb-4" dir={dir}>
                <div className="max-w-[70%] bg-ghost-surface rounded-3xl rounded-ee-lg px-[18px] py-3">
                  <p className="text-body text-ghost-text-primary whitespace-pre-wrap">
                    {qText}
                    {phase === "typing" && <Caret />}
                  </p>
                </div>
              </div>

              {/* ghost reply (thinking → streaming) */}
              {phase !== "typing" && (
                <div className="flex justify-start" dir={dir}>
                  <div className="flex-shrink-0 w-8 h-8 me-3 mt-1">
                    <img
                      src={ghostIcon}
                      alt="Ghost"
                      className="w-8 h-8 object-contain flex-shrink-0 rounded-[7px]"
                      draggable={false}
                    />
                  </div>
                  <div className="max-w-full flex-1">
                    <div
                      dir="ltr"
                      className="flex items-center gap-1.5 mb-1 text-[12px] leading-5 text-ghost-text-muted font-medium"
                    >
                      <Video size={12} className="flex-shrink-0" />
                      <span className="truncate">Main Gate ({item.cam})</span>
                    </div>

                    {item.frame && showFrame && (
                      <div className="mb-3 max-w-[340px] fade-in">
                        <CameraViewport
                          scene={item.frame.scene}
                          cam={item.cam}
                          time={item.frame.time}
                          image={item.frame.image}
                        />
                      </div>
                    )}

                    {phase === "thinking" ? (
                      <TypingDots />
                    ) : (
                      <p className="text-body text-ghost-text-primary whitespace-pre-wrap">
                        {aText}
                        {phase === "streaming" && <Caret />}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* composer — mirrors Composer.tsx */}
          <div className="flex-shrink-0 px-4 pb-4 pt-2">
            <div className="max-w-chat mx-auto">
              <div className="flex items-center gap-2 rounded-full bg-ghost-bg border border-ghost-border-subtle px-2.5 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ghost-text-muted">
                  <Plus size={20} strokeWidth={2} />
                </span>
                <span className="flex-1 text-[16px] text-ghost-text-muted truncate">
                  Send a message to Ghost...
                </span>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <span className="hidden sm:flex items-center gap-0.5 select-none text-[14px] text-ghost-text-secondary px-1.5">
                    Thinking
                    <ChevronDown size={16} className="text-ghost-text-muted" />
                  </span>
                  <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-ghost-accent text-ghost-bg">
                    <AudioLines size={16} />
                  </span>
                </div>
              </div>
              <div className="mt-2 text-center text-[12px] text-ghost-text-muted">
                Ghost can make mistakes. Verify important info.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchDefineCard({ copy }: { copy: WatchDefineCopy }) {
  return (
    <div className="h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary">
          <CalendarClock size={15} />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-ghost-text-primary leading-tight">
            {copy.title}
          </p>
          <p
            dir="ltr"
            className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted"
          >
            Watch · natural language
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-ghost-border-subtle bg-ghost-bg/50 px-4 py-3">
        <p className="text-[13.5px] leading-relaxed text-ghost-text-primary">
          {copy.quote}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/50 text-[11px] text-ghost-text-secondary">
          <Clock3 size={11} />
          {copy.chipContinuous}
        </span>
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/50 text-[11px] text-ghost-text-secondary">
          <Camera size={11} />
          {copy.chipCamera}
        </span>
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-ghost-success/40 text-[11px] text-ghost-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-ghost-success" />
          {copy.chipActive}
        </span>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-ghost-text-muted">
        {copy.footnote}
      </p>
    </div>
  );
}

function AlertCard({ check, seen }: { check: string; seen: string }) {
  return (
    <div className="group relative h-full rounded-2xl border border-ghost-error/30 bg-ghost-surface/30 overflow-hidden flex flex-col transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/50 hover:border-ghost-error/60">
      {/* Severity rail — the alert's identity, surfaced on intent. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ghost-error/70 to-transparent opacity-60 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
      />
      {/* Faint corner wash that warms only when the card is engaged. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--ghost-error) / 0.14), transparent 70%)",
        }}
      />

      <div
        dir="ltr"
        className="relative flex items-center gap-2 h-9 px-3.5 border-b border-ghost-border-subtle bg-ghost-surface/40"
      >
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-ghost-error transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
          <ShieldAlert size={12} strokeWidth={2.2} />
        </span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-primary">
          Event
        </span>
        <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-ghost-text-muted">
          Ghost Watch
        </span>
        <span className="ms-auto inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] uppercase text-ghost-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-ghost-error animate-pulse" />
          Live
        </span>
      </div>

      <div className="relative p-3.5 space-y-3 flex-1">
        <CameraViewport
          scene={SCENE_DOCK}
          cam="Loading Bay · CAM-09"
          time="03:12:48"
          image="/ghost-cam-dock-night.png"
        />

        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted mb-1.5">
            Matched check
          </p>
          <div className="rounded-lg border border-ghost-border-subtle bg-ghost-bg/50 px-3 py-2 text-[12.5px] text-ghost-text-primary transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-ghost-text-muted/30">
            {check}
          </div>
        </div>

        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted mb-1.5">
            What Ghost saw
          </p>
          <div className="rounded-lg border-s-2 border border-s-ghost-error/50 border-ghost-border-subtle bg-ghost-bg/50 px-3 py-2 text-[12.5px] leading-relaxed text-ghost-text-secondary transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-s-ghost-error">
            {seen}
          </div>
        </div>
      </div>

      <div
        dir="ltr"
        className="relative flex items-center gap-4 h-9 px-3.5 border-t border-ghost-border-subtle font-mono text-[10px] tracking-[0.14em] uppercase text-ghost-text-muted"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-ghost-success" />
          Signal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-ghost-error" />
          High
        </span>
        <span className="ms-auto tabular-nums">03:12:48</span>
      </div>
    </div>
  );
}

// Icons + mono tags for the watch-section legend; bodies come from the copy
// module, zipped positionally.
const PREVIEW_LEGEND_META = [
  { icon: History, tag: "Memory" },
  { icon: Radar, tag: "Live" },
  { icon: Clock, tag: "Watch" },
] as const;

// AI-generated CCTV imagery for the featured sector cards, keyed by sector id.
// Names/blurbs live in DEFENSE_SECTOR_CARDS (bilingual); the shared SECTORS
// data stays untouched.
const SECTOR_IMAGES: Record<string, string> = {
  construction: "/use-cases/sector-construction.png",
  restaurant: "/use-cases/sector-restaurant.png",
  "gas-station": "/use-cases/sector-gas-station.png",
  greenhouse: "/use-cases/sector-greenhouse.png",
  parking: "/use-cases/sector-parking.png",
  supermarket: "/use-cases/sector-supermarket.png",
  pharmacy: "/use-cases/sector-pharmacy.png",
  clinic: "/use-cases/sector-clinic.png",
  dental: "/use-cases/sector-dental.png",
};

// ── Page ────────────────────────────────────────────────────────────────────

// Spectral "ghosts" that drift up across the screen during the home
// transition. Positions/sizes/timing are hand-tuned for an organic spread.
const GHOST_SPIRITS = [
  { left: "8%", size: 46, delay: "0ms", dur: "1050ms", drift: "-6vw" },
  { left: "22%", size: 30, delay: "120ms", dur: "1150ms", drift: "4vw" },
  { left: "38%", size: 64, delay: "40ms", dur: "1000ms", drift: "-3vw" },
  { left: "54%", size: 38, delay: "200ms", dur: "1180ms", drift: "5vw" },
  { left: "68%", size: 52, delay: "90ms", dur: "1080ms", drift: "-5vw" },
  { left: "82%", size: 28, delay: "160ms", dur: "1120ms", drift: "3vw" },
  { left: "92%", size: 42, delay: "60ms", dur: "1040ms", drift: "-2vw" },
] as const;

export default function DefenseIntelligencePage({
  onBack,
  onAccess,
  onNavigate,
  onShowUseCases,
}: DefenseIntelligencePageProps) {
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  const reducedMotion = usePrefersReducedMotion();
  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c: DefenseCopy = DEFENSE_COPY[locale];
  const sectorCards = DEFENSE_SECTOR_CARDS[locale];
  // A teaser slice of the per-sector use-case library, surfaced on the brief.
  const featuredSectors = SECTORS.slice(0, 9);
  // Drives the "ghost portal" home transition overlay.
  const [ghosting, setGhosting] = useState(false);

  // Clicking the Ghost brand mark returns to the top of the home page with a
  // dramatic "spectral portal" transition (especially vivid in dark mode).
  const goHome = () => {
    if (reducedMotion) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setGhosting(true);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 440);
    window.setTimeout(() => setGhosting(false), 1150);
  };

  return (
    <div
      className={`fixed inset-0 bg-ghost-bg overflow-y-auto overflow-x-clip cursor-default ${
        siteNavCollapsed ? "" : "lg:ps-[260px]"
      }`}
      dir={dir}
    >
      {/* ── Spectral "ghost portal" home transition ── */}
      {ghosting && (
        <div className="ghost-portal" aria-hidden>
          <div className="ghost-portal__veil" />
          <img
            src="/ghost-icon.png"
            alt=""
            draggable={false}
            className="ghost-portal__core"
          />
          {GHOST_SPIRITS.map((s, i) => (
            <img
              key={i}
              src="/ghost-icon.png"
              alt=""
              draggable={false}
              className="ghost-portal__spirit"
              style={{
                left: s.left,
                width: s.size,
                height: s.size,
                animationDelay: s.delay,
                animationDuration: s.dur,
                ["--ghost-drift" as string]: s.drift,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Shared marketing-site navigation ── */}
      <SiteSidebar
        active="defense"
        onNavigate={onNavigate}
        onScrollTop={goHome}
        onBack={onBack}
        onAccess={onAccess}
        accessLabel={c.requestAccess}
        locale={locale}
        dir={dir}
      />

      {/* ── Hero ── */}
      <header className="relative overflow-hidden">
        <div className="ghost-ambient ghost-ambient--page" aria-hidden="true">
          <div className="ghost-ambient__grid" />
          <div className="ghost-ambient__blob ghost-ambient__blob--1" />
          <div className="ghost-ambient__blob ghost-ambient__blob--2" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 text-center">
          <div
            dir="ltr"
            className="animate-splash-in mb-6 inline-flex max-w-full flex-wrap justify-center items-center gap-2 min-h-7 py-1 ps-2.5 pe-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/40"
            style={{ animationDelay: "60ms" }}
          >
            <span className="ghost-alert-dot" />
            <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.16em] sm:tracking-[0.22em] uppercase text-ghost-text-muted">
              Confidential · Defense &amp; National Security Brief
            </span>
          </div>

          <h1
            className="animate-splash-in ghost-display text-[clamp(2.5rem,6vw,4.5rem)] text-balance"
            style={{ animationDelay: "120ms" }}
          >
            <span className="text-ghost-text-primary">{c.heroTitle}</span>
            <br />
            <span className="text-ghost-text-muted">{c.heroTitleSub}</span>
          </h1>

          <p
            className="animate-splash-in mt-6 text-[16px] sm:text-[18px] leading-[1.6] text-ghost-text-secondary max-w-2xl mx-auto text-pretty"
            style={{ animationDelay: "180ms" }}
          >
            {c.heroBody}
          </p>

          <div
            className="animate-splash-in mt-9 flex flex-col sm:flex-row justify-center items-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <button
              onClick={onAccess}
              className="group relative inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold overflow-hidden transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full group-hover:opacity-100"
                style={{ background: "linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.22) 50%, transparent 70%)" }}
              />
              <span className="relative">{c.requestAccess}</span>
              <ArrowRight
                size={16}
                className="relative transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              />
            </button>
            <a
              href="#pipeline"
              className="ghost-glass group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full text-ghost-text-primary text-[15px] font-medium transition-[transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
            >
              <span>{c.viewArchitecture}</span>
              <ArrowRight
                size={16}
                className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0.5 rotate-90"
              />
            </a>
          </div>

          <div
            className="animate-splash-in mt-9 flex flex-wrap items-center justify-center gap-2"
            style={{ animationDelay: "300ms" }}
          >
            {c.trust.map((t) => (
              <span
                key={t}
                dir="ltr"
                className="group inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/30 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted transition-[transform,color,border-color,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:text-ghost-text-secondary hover:border-ghost-text-muted/40 hover:bg-ghost-surface/50"
              >
                <ShieldCheck size={11} className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Hero centerpiece — the live, auto-playing product window */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-6">
          <Reveal delay={80}>
            <LiveAppWindow demo={c.demo} dir={dir} />
          </Reveal>
          <Reveal delay={140}>
            <p
              dir="ltr"
              className="mt-4 text-center font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted"
            >
              Live product · auto-replaying a real operator session
            </p>
          </Reveal>
        </div>
      </header>

      <main className="relative" style={{ overflowX: "clip" }}>
        {/* ── Technology — the engine behind Ghost ── */}
        <AmbientSection blobs={BAND.capabilities}>
          <Reveal>
            <SectionLabel>Technology // The Engine Behind Ghost</SectionLabel>
          </Reveal>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <Reveal delay={70}>
              <div className="group relative aspect-[16/10] rounded-2xl overflow-hidden border border-ghost-border-subtle bg-ghost-surface/30 transition-[border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ghost-text-muted/30">
                <img
                  src="/ghost-logo.png"
                  alt="Ghost"
                  className="w-full h-full object-cover object-[center_30%] select-none transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                  draggable={false}
                />
                <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-ghost-border-subtle/60" />
              </div>
            </Reveal>

            <Reveal delay={120}>
              <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
                {c.engineHeading}
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
                {c.engineBody}
              </p>

              <div className="mt-7 grid sm:grid-cols-2 gap-4">
                {c.enginePoints.map((p, i) => (
                  <Reveal
                    key={p.title}
                    delay={(i % 2) * 80}
                    className="h-full"
                    style={{ perspective: "1100px" }}
                  >
                    <EngineCard
                      icon={ENGINE_META[i].icon}
                      index={i}
                      tag={ENGINE_META[i].tag}
                      title={p.title}
                      body={p.body}
                    />
                  </Reveal>
                ))}
              </div>
            </Reveal>
          </div>
        </AmbientSection>

        {/* ── The gap ── */}
        <AmbientSection blobs={BAND.gap}>
          <Reveal>
            <SectionLabel>The Gap // Footage Is Not Intelligence</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.gapHeading}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.gapBody}
            </p>
          </Reveal>

          {/* Walls of footage — the gap Ghost closes. */}
          <Reveal delay={120} className="mt-10">
            <IntelFigure
              src="/brand/control-room-wall.jpg"
              alt="Operators facing a wall of camera feeds"
              ratio="21/9"
              badge="Footage // Without Answers"
              faceProtect
            />
          </Reveal>
        </AmbientSection>

        {/* ── Three operational layers ── */}
        <AmbientSection tone="alt" blobs={BAND.doctrine}>
          <Reveal>
            <SectionLabel>Doctrine // Three Operational Layers</SectionLabel>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {c.layers.map((l, i) => {
              const Icon = LAYER_META[i].icon;
              const tag = LAYER_META[i].tag;
              return (
                <Reveal key={tag} delay={i * 80}>
                  <article className="group h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6 flex flex-col transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/50 hover:border-ghost-text-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <span className="w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary transition-[transform,color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:text-ghost-accent group-hover:border-ghost-accent/40">
                        <Icon size={16} />
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted transition-colors duration-200 group-hover:text-ghost-text-secondary">
                        {tag}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-semibold text-ghost-text-primary">
                      {l.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-ghost-text-secondary">
                      {l.body}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </AmbientSection>

        {/* ── Operational capabilities ── */}
        <AmbientSection blobs={BAND.capabilities}>
          <Reveal>
            <SectionLabel>Capabilities // Operational</SectionLabel>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {c.capabilities.map((cap, i) => {
              const Icon = CAPABILITY_ICONS[i];
              return (
                <Reveal key={cap.title} delay={(i % 3) * 70}>
                  <article className="group h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6 flex flex-col transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/50 hover:border-ghost-text-muted/30">
                    <span className="w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary mb-4 transition-[transform,color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:text-ghost-accent group-hover:border-ghost-accent/40">
                      <Icon size={16} />
                    </span>
                    <h3 className="text-[16px] font-semibold text-ghost-text-primary">
                      {cap.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-ghost-text-secondary">
                      {cap.body}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>

          {/* Inside the console — operators running Ghost. */}
          <Reveal className="mt-12">
            <SectionLabel>Operations // Inside The Console</SectionLabel>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { src: "/brand/console-desk.jpg", alt: "Operator console", badge: "Console // Desk" },
              { src: "/brand/soc-pair.jpg", alt: "Operators reviewing feeds together", badge: "SOC // Pair" },
              { src: "/brand/operator-standing.jpg", alt: "Operator at the wall", badge: "Operator // Watch" },
              { src: "/brand/night-shift.jpg", alt: "Night-shift operations", badge: "Shift // Night" },
            ].map((img, i) => (
              <Reveal key={img.src} delay={(i % 4) * 60}>
                <IntelFigure
                  src={img.src}
                  alt={img.alt}
                  ratio="4/5"
                  badge={img.badge}
                  faceProtect
                />
              </Reveal>
            ))}
          </div>
        </AmbientSection>

        {/* ── Watch / Alert (defined checks in practice) ── */}
        <AmbientSection blobs={BAND.watch}>
          <Reveal>
            <SectionLabel>Watch // Checks You Define, Deviations You See</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.watchHeading}
            </h2>
          </Reveal>
          <Reveal delay={120} className="mt-8">
            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              <WatchDefineCard copy={c.watchDefine} />
              <AlertCard check={c.alertCheck} seen={c.alertSeen} />
            </div>
          </Reveal>
          <Reveal delay={120} className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PREVIEW_LEGEND_META.map((l, i) => {
                const Icon = l.icon;
                return (
                  <div
                    key={l.tag}
                    className="group flex items-start gap-3 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-4 transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/50 hover:border-ghost-text-muted/30"
                  >
                    <span className="w-8 h-8 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary flex-shrink-0 transition-[transform,color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:text-ghost-accent group-hover:border-ghost-accent/40">
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted">
                        {l.tag}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ghost-text-secondary">
                        {c.previewLegend[i]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </AmbientSection>

        {/* ── How Ghost connects ── */}
        <AmbientSection id="pipeline" tone="alt" className="scroll-mt-24" blobs={BAND.pipeline}>
          <Reveal>
            <SectionLabel>Data Flow // Agentless By Design</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.pipelineHeading}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.pipelineBody}
            </p>
          </Reveal>

          <Reveal delay={120} className="mt-10">
            <div className="ghost-glass rounded-3xl border border-ghost-border-subtle p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-2">
                {c.pipelineStages.map((step, i) => {
                  const Icon = PIPELINE_ICONS[i];
                  const last = i === c.pipelineStages.length - 1;
                  return (
                    <div
                      key={step.label}
                      className="flex flex-col lg:flex-row lg:items-stretch lg:flex-1 gap-4 lg:gap-2"
                    >
                      <div className="group flex-1 rounded-2xl border border-ghost-border-subtle bg-ghost-bg/40 px-5 py-5 flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3 transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/40 hover:border-ghost-text-muted/30">
                        <span className="w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary flex-shrink-0 transition-[transform,color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:text-ghost-accent group-hover:border-ghost-accent/40">
                          <Icon size={19} />
                        </span>
                        <div>
                          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                            Stage {String(i + 1).padStart(2, "0")}
                          </p>
                          <p className="mt-1 text-[15px] font-semibold text-ghost-text-primary">
                            {step.label}
                          </p>
                          <p className="mt-0.5 text-[13px] text-ghost-text-secondary">
                            {step.sub}
                          </p>
                        </div>
                      </div>
                      {!last && (
                        <div className="flex items-center justify-center text-ghost-text-muted lg:px-0.5">
                          <ArrowRight
                            size={18}
                            className="hidden lg:block rtl:rotate-180"
                          />
                          <ArrowRight
                            size={18}
                            className="lg:hidden rotate-90"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </AmbientSection>

        {/* ── Deployment & sovereignty ── */}
        <AmbientSection>
          <Reveal>
            <SectionLabel>Deployment // Sovereignty &amp; Isolation</SectionLabel>
          </Reveal>
          <Reveal className="max-w-2xl mb-8">
            <p className="text-[16px] leading-relaxed text-ghost-text-secondary">
              {c.deployIntro}
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {c.deployments.map((d, i) => {
              const Icon = DEPLOYMENT_ICONS[i];
              return (
                <Reveal key={d.title} delay={(i % 5) * 60}>
                  <div className="group h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5 transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/50 hover:border-ghost-text-muted/30">
                    <span className="w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-secondary mb-4 transition-[transform,color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:text-ghost-text-primary group-hover:border-ghost-text-muted/40">
                      <Icon size={16} />
                    </span>
                    <h4 className="text-[14px] font-semibold text-ghost-text-primary">
                      {d.title}
                    </h4>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ghost-text-secondary">
                      {d.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </AmbientSection>

        {/* ── Security & compliance ── */}
        <AmbientSection tone="alt">
          <Reveal>
            <SectionLabel>Compliance // Security Framework</SectionLabel>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-x-4 sm:gap-x-6 lg:gap-x-10 gap-y-1">
            {c.compliance.map((item, i) => {
              const Icon = COMPLIANCE_ICONS[i];
              return (
                <div
                  key={item.title}
                  className="group flex gap-4 py-5 border-b border-ghost-border-subtle transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ghost-text-muted/30"
                >
                  <span className="mt-0.5 w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface/60 flex items-center justify-center text-ghost-text-secondary flex-shrink-0 transition-[transform,color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:text-ghost-accent group-hover:border-ghost-accent/40">
                    <Icon size={16} />
                  </span>
                  <div>
                    <h4 className="text-[15px] font-medium text-ghost-text-primary transition-colors duration-200 group-hover:text-ghost-accent">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-[14px] leading-relaxed text-ghost-text-secondary">
                      {item.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-[14px] leading-relaxed text-ghost-text-muted max-w-3xl">
            {c.complianceNote}
          </p>
        </AmbientSection>

        {/* ── Built for ── */}
        <AmbientSection>
          <Reveal>
            <SectionLabel>Built For // Operational Domains</SectionLabel>
          </Reveal>
          <div className="flex flex-wrap gap-3">
            {c.verticals.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-ghost-border-subtle bg-ghost-surface/30 text-[14px] text-ghost-text-secondary transition-[transform,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/60 hover:border-ghost-text-muted/40 hover:text-ghost-text-primary"
              >
                <span className="ghost-alert-dot" />
                {v}
              </span>
            ))}
          </div>
        </AmbientSection>

        {/* ── Use cases by sector ── */}
        {onShowUseCases && (
          <AmbientSection blobs={BAND.usecases}>
            <Reveal>
              <SectionLabel>Use Cases // Deployed By Sector</SectionLabel>
            </Reveal>
            <Reveal delay={70} className="max-w-2xl">
              <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
                {c.useCasesHeading}
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
                {c.useCasesBody}
              </p>
            </Reveal>

            <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredSectors.map((s, i) => {
                const Icon = s.icon;
                const card = sectorCards[s.id];
                const name = card?.name ?? s.name;
                const blurb = card?.blurb ?? s.blurb;
                const image = SECTOR_IMAGES[s.id];
                return (
                  <Reveal key={s.id} delay={(i % 3) * 60}>
                    <button
                      onClick={() => onShowUseCases(s.id)}
                      className="group w-full h-full text-start rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 overflow-hidden flex flex-col transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden bg-ghost-bg">
                        {image && (
                          <img
                            src={image}
                            alt={name}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover opacity-85 transition-[transform,opacity] duration-300 group-hover:scale-[1.04] group-hover:opacity-100"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-ghost-bg via-ghost-bg/30 to-transparent" />
                        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                          <span className="w-8 h-8 rounded-lg border border-white/15 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                            <Icon size={15} />
                          </span>
                          <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/80 bg-black/40 backdrop-blur-sm rounded px-1.5 py-1">
                            {s.zones.length} zones
                          </span>
                        </div>
                      </div>
                      <div className="p-5 pt-4 flex flex-col flex-1">
                        <h3 className="text-[15px] font-semibold text-ghost-text-primary">
                          {name}
                        </h3>
                        <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-ghost-text-secondary line-clamp-2">
                          {blurb}
                        </p>
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={120} className="mt-7 flex justify-center">
              <button
                onClick={() => onShowUseCases()}
                className="group inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full border border-ghost-border-subtle bg-ghost-surface/40 text-ghost-text-primary text-[14px] font-medium transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-surface-hover hover:border-ghost-text-muted/40 hover:-translate-y-0.5"
              >
                <span>{c.exploreAll(SECTORS.length)}</span>
                <ArrowRight
                  size={15}
                  className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                />
              </button>
            </Reveal>
          </AmbientSection>
        )}

        {/* ── Talk to your cameras ── */}
        <AmbientSection blobs={BAND.practice}>
          <Reveal>
            <SectionLabel>In Practice // Talk To Your Cameras</SectionLabel>
          </Reveal>
          <Reveal className="ghost-glass rounded-3xl border border-ghost-border-subtle p-6 sm:p-8">
            <div className="space-y-3">
              {c.prompts.map((p, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-3 rounded-2xl border border-ghost-border-subtle bg-ghost-bg/40 px-4 sm:px-5 py-4 transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-surface/40 hover:border-ghost-text-muted/30 hover:translate-x-0.5 rtl:hover:-translate-x-0.5"
                >
                  <span className="mt-0.5 w-8 h-8 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-secondary flex-shrink-0 transition-[transform,color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:text-ghost-accent group-hover:border-ghost-accent/40">
                    <MessageSquareText size={15} />
                  </span>
                  <p className="text-[15px] leading-relaxed text-ghost-text-primary">
                    {p}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </AmbientSection>

        {/* ── Access request ── */}
        <AmbientSection>
          <div className="relative overflow-hidden ghost-glass rounded-3xl border border-ghost-border-subtle px-4 sm:px-6 py-16 sm:py-20">
          <div className="relative z-10 max-w-xl mx-auto text-center">
            <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary mb-6">
              <FileText size={22} />
            </span>
            <h2 className="ghost-display text-[clamp(2.25rem,5vw,3.75rem)] text-ghost-text-primary">
              {c.accessHeading}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ghost-text-secondary">
              {c.accessBody}
            </p>

            <div className="mt-8 flex justify-center">
              <button
                onClick={onAccess}
                className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover active:scale-[0.99] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ghost-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ghost-bg"
              >
                <span>{c.requestAccess}</span>
                <ArrowUpRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                />
              </button>
            </div>

            <p
              dir="ltr"
              className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted"
            >
              <Lock size={11} />
              Confidential · Shared under NDA terms
            </p>
          </div>
          </div>
        </AmbientSection>
      </main>

      {/* ── Classification footer ── */}
      <footer
        className="sticky bottom-0 z-20 bg-ghost-bg/45 backdrop-blur-2xl backdrop-saturate-150 border-t border-ghost-border-subtle/40"
        style={{
          WebkitBackdropFilter: "saturate(160%) blur(26px)",
          backdropFilter: "saturate(160%) blur(26px)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div
          dir="ltr"
          className="max-w-5xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 font-mono text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.18em] uppercase text-ghost-text-muted"
        >
          <span className="truncate">
            Ghost — Sovereign Visual Intelligence Infrastructure
          </span>
          <span className="hidden sm:inline flex-shrink-0 text-ghost-text-secondary">
            Defense
          </span>
        </div>
      </footer>
    </div>
  );
}
