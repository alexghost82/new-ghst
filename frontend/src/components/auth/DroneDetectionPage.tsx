import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Radar,
  Plane,
  Crosshair,
  Waves,
  Thermometer,
  Eye,
  Cpu,
  Network,
  Bell,
  History,
  Server,
  Cable,
  MonitorSmartphone,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Sun,
  Moon,
  Menu,
  X,
  Layers,
  Sparkles,
  Users,
  MessageSquareText,
  Send,
  Search,
  Plus,
  Mountain,
  Building,
  Flag,
  MoonStar,
  Sword,
  Fence,
  Factory,
  Globe2,
  Camera,
  Gauge,
  Wind,
  Download,
  Lock,
  FileText,
} from "lucide-react";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import { DRONE_COPY, type DroneCopy } from "../../site/copy/drone";
import IntelFigure from "../shared/IntelFigure";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface DroneDetectionPageProps {
  onBack: () => void;
  onAccess: () => void;
  // Shared marketing-site navigation (drives the persistent sidebar + in-body
  // "Explore the platform" link).
  onNavigate: (page: SitePage) => void;
  /** Opens the need-to-know gate for the classified LKM-Drone field report. */
  onDownloadReport?: () => void;
}

// ── Motion helpers (mirrors DefenseIntelligencePage) ─────────────────────────

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

function Reveal({
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

type AmbientBlob = { className: string; style: React.CSSProperties };

const HUE = {
  steel: "rgb(96 116 132 / 0.9)",
  olive: "rgb(104 116 78 / 0.85)",
  petrol: "rgb(56 92 96 / 0.88)",
  charcoal: "rgb(58 66 70 / 0.95)",
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

const HERO_BLOBS: AmbientBlob[] = [
  blob("ghost-ambient__blob--1", { top: "-180px", left: "2%" }, 520, HUE.steel),
  blob("ghost-ambient__blob--2", { top: "-120px", right: "-2%" }, 480, HUE.petrol),
  blob("ghost-ambient__blob--3", { top: "160px", left: "32%" }, 600, HUE.charcoal),
];

const CTA_BLOBS: AmbientBlob[] = [
  blob("ghost-ambient__blob--2", { bottom: "-160px", left: "6%" }, 420, HUE.petrol),
  blob("ghost-ambient__blob--3", { top: "-140px", right: "4%" }, 440, HUE.steel),
];

const PAGE_BLOBS: AmbientBlob[] = [
  blob("ghost-ambient__blob--1", { top: 120, left: "-8%" }, 560, HUE.steel),
  blob("ghost-ambient__blob--3", { top: 760, right: "-10%" }, 600, HUE.petrol),
  blob("ghost-ambient__blob--2", { top: 1500, left: "-6%" }, 560, HUE.charcoal),
  blob("ghost-ambient__blob--1", { top: 2300, right: "-8%" }, 600, HUE.olive),
  blob("ghost-ambient__blob--3", { top: 3100, left: "-8%" }, 560, HUE.steel),
  blob("ghost-ambient__blob--2", { top: 3950, right: "-8%" }, 600, HUE.petrol),
  blob("ghost-ambient__blob--1", { top: 4800, left: "-6%" }, 560, HUE.charcoal),
];

function AmbientBackdrop({
  blobs,
  grid = false,
}: {
  blobs: readonly AmbientBlob[];
  grid?: boolean;
}) {
  return (
    <div className="ghost-ambient" aria-hidden>
      {grid && <div className="ghost-ambient__grid" />}
      {blobs.map((b, i) => (
        <div key={i} className={`ghost-ambient__blob ${b.className}`} style={b.style} />
      ))}
    </div>
  );
}

function PageAmbient() {
  return (
    <div className="ghost-ambient ghost-ambient--page" aria-hidden>
      {PAGE_BLOBS.map((b, i) => (
        <div key={i} className={`ghost-ambient__blob ${b.className}`} style={b.style} />
      ))}
    </div>
  );
}

// Brand-signature English chrome: forced LTR so the label renders identically
// when the page itself flows RTL.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div dir="ltr" className="flex items-center gap-3 mb-6">
      <span className="min-w-0 font-mono text-[10px] sm:text-[11px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance">
        {children}
      </span>
      <span className="flex-1 h-px bg-ghost-border-subtle" />
    </div>
  );
}

function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`relative z-10 ${className}`}>
      {children}
    </section>
  );
}

// ── Hero centerpiece: a live airspace tracking scope ─────────────────────────
// A flat, token-driven reproduction of the operator "scope" — a thermal-style
// sky frame with a swept radar ring, a tracked aerial contact, and a
// micro-signature read-out. Decorative; respects reduced-motion.

function AirspaceScope({ copy }: { copy: DroneCopy }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-bg overflow-hidden shadow-[0_1px_3px_rgb(0_0_0/0.10),0_18px_50px_-20px_rgb(0_0_0/0.30)]">
      {/* titlebar — mono status chrome, English + LTR in both locales */}
      <div
        dir="ltr"
        className="flex items-center gap-2 min-h-10 py-1.5 px-3.5 border-b border-ghost-border-subtle bg-ghost-surface/30"
      >
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-ghost-error animate-pulse" />
          Tracking
        </span>
        <span className="flex-1 min-w-0 truncate text-center font-mono text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.14em] text-ghost-text-muted">
          Ghost LKM-Drone — Sector North
        </span>
        <span className="flex-shrink-0 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted">
          THERMAL
        </span>
      </div>

      <div className="grid md:grid-cols-[1.55fr_1fr]">
        {/* Sky scope */}
        <div
          className="relative overflow-hidden border-b md:border-b-0 md:border-r border-ghost-border-subtle"
          style={{
            aspectRatio: "16 / 11",
            background:
              "radial-gradient(120% 90% at 50% 0%, rgb(36 56 52 / 0.85), transparent 55%), linear-gradient(180deg, #0a1714 0%, #08100e 60%, #060a09 100%)",
          }}
          dir="ltr"
        >
          {/* tactical satellite recon plate — Israel–Lebanon border sector */}
          <img
            src="/drone-scope-satellite.png"
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "grayscale(1) contrast(1.12) brightness(0.95)", opacity: 0.92 }}
          />
          {/* petrol tint so the plate reads as one thermal scope */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, rgb(36 56 52 / 0.25), transparent 65%), linear-gradient(180deg, rgb(10 23 20 / 0.12) 0%, rgb(6 10 9 / 0.28) 100%)",
              mixBlendMode: "multiply",
            }}
          />
          {/* horizon haze */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{ background: "linear-gradient(180deg, transparent, rgb(40 70 60 / 0.35))" }}
          />
          {/* scanlines */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)",
            }}
          />
          {/* radar rings */}
          <svg
            viewBox="0 0 200 140"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            <g stroke="rgb(120 200 170 / 0.28)" fill="none" strokeWidth="0.4">
              <circle cx="100" cy="78" r="26" />
              <circle cx="100" cy="78" r="46" />
              <circle cx="100" cy="78" r="66" />
              <line x1="34" y1="78" x2="166" y2="78" />
              <line x1="100" y1="12" x2="100" y2="144" />
            </g>
            {/* sweep */}
            {!reduced && (
              <g style={{ transformOrigin: "100px 78px" }} className="ghost-radar-sweep">
                <path d="M100 78 L100 12 A66 66 0 0 1 156 44 Z" fill="rgb(120 200 170 / 0.10)" />
              </g>
            )}
          </svg>

          {/* tracked contact */}
          <div className="absolute" style={{ left: "63%", top: "31%" }}>
            <span className="relative block">
              <Plane size={15} className="text-[#8fe3c4] -rotate-[18deg]" strokeWidth={2} />
              {!reduced && (
                <span className="absolute -inset-3 rounded-full border border-[#8fe3c4]/40 ghost-contact-ping" />
              )}
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-[#8fe3c4]/50" />
            </span>
            <span className="absolute left-7 top-0 font-mono text-[8.5px] leading-tight tracking-[0.08em] text-[#8fe3c4] whitespace-nowrap">
              CONTACT-07
              <br />
              <span className="text-[#8fe3c4]/70">DRONE · 0.94</span>
            </span>
          </div>

          {/* secondary discounted contact (bird) */}
          <div className="absolute" style={{ left: "28%", top: "54%" }}>
            <span className="block w-2 h-2 rounded-full border border-white/35" />
            <span className="absolute left-3.5 top-0 font-mono text-[8px] leading-tight tracking-[0.08em] text-white/50 whitespace-nowrap">
              CONTACT-08
              <br />
              <span className="text-white/35">BIRD · DISCARDED</span>
            </span>
          </div>

          {/* corner brackets */}
          <span className="absolute top-2 left-2 w-3.5 h-3.5 border-t border-l border-white/40" />
          <span className="absolute top-2 right-2 w-3.5 h-3.5 border-t border-r border-white/40" />
          <span className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b border-l border-white/40" />
          <span className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b border-r border-white/40" />

          <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 inline-flex max-w-[95%] items-center gap-1.5 font-mono text-[7.5px] sm:text-[8.5px] tracking-[0.1em] sm:tracking-[0.12em] text-white/70">
            <Camera size={9} className="flex-shrink-0" />
            <span className="truncate">CAM-12 · AZ 041° · EL +6° · 02:41:07</span>
          </span>
        </div>

        {/* Read-out panel */}
        <div className="p-4 flex flex-col gap-3 bg-ghost-surface/20">
          <div>
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
              Classification
            </p>
            <div className="mt-1.5 flex items-center justify-between rounded-lg border border-ghost-error/40 bg-ghost-surface/40 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ghost-text-primary">
                <ShieldAlert size={13} className="text-ghost-error" />
                {copy.scopeClassification}
              </span>
              <span className="font-mono text-[11px] text-ghost-error">0.94</span>
            </div>
          </div>

          <div className="space-y-2">
            <ScopeBar label="Micro-Signature" value={0.91} icon={Crosshair} />
            <ScopeBar label="Micro-Flutter" value={0.88} icon={Waves} />
            <ScopeBar label="Heat Atlas Δ" value={0.72} icon={Thermometer} />
            <ScopeBar label="Persistence" value={0.83} icon={History} />
          </div>

          <div className="mt-auto rounded-lg border border-ghost-border-subtle bg-ghost-bg/50 px-3 py-2">
            <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted mb-1">
              Track
            </p>
            <p className="text-[12px] leading-relaxed text-ghost-text-secondary">
              {copy.scopeTrackNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScopeBar({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Crosshair;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ghost-text-secondary">
          <Icon size={11} className="text-ghost-text-muted" />
          {label}
        </span>
        <span className="font-mono text-[10px] text-ghost-text-muted tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-ghost-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-ghost-accent"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Structural data — all visitor-readable copy lives in DRONE_COPY ──────────
// Icons, images and product names are zipped positionally with the bilingual
// copy arrays. Engine names are brand-signature English in both locales.

const PROPRIETARY = [
  {
    icon: Crosshair,
    name: "Micro-Signature Tracking",
    tm: true,
    image: "/drone-sig-microsignature.png",
  },
  {
    icon: Waves,
    name: "Micro-Flutter Analysis",
    tm: true,
    image: "/drone-sig-microflutter.png",
  },
  {
    icon: Thermometer,
    name: "Heat Atlas",
    tm: true,
    image: "/drone-sig-heatatlas.png",
  },
];

const ENVIRONMENT_ICONS = [Mountain, Building, Fence, MoonStar] as const;

const LIFECYCLE_ICONS = [Eye, Radar, Crosshair, Activity, Bell, History] as const;

const AWARENESS_ICONS = [Bell, Crosshair, Gauge, History, Activity, Network] as const;

const CONTACT_MAP_ICONS = [Camera, Network, Radar] as const;

const DEPLOYMENT_ICONS = [
  Camera,
  Thermometer,
  Radar,
  Cpu,
  MonitorSmartphone,
  Server,
] as const;

const USE_CASE_ICONS = [Sword, Fence, Factory, Building2, Plane, Building] as const;

// ── Page ──────────────────────────────────────────────────────────────────

export default function DroneDetectionPage({
  onBack,
  onAccess,
  onNavigate,
  onDownloadReport,
}: DroneDetectionPageProps) {
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c = DRONE_COPY[locale];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const scrollTop = () =>
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div
      ref={scrollRef}
      className={`fixed inset-0 bg-ghost-bg overflow-y-auto overflow-x-clip cursor-default ${
        siteNavCollapsed ? "" : "lg:ps-[260px]"
      }`}
      dir={dir}
    >
      {/* ── Shared marketing-site navigation ── */}
      <SiteSidebar
        active="drone"
        onNavigate={onNavigate}
        onScrollTop={scrollTop}
        onBack={onBack}
        onAccess={onAccess}
        accessLabel={c.accessLabel}
        locale={locale}
        dir={dir}
      />

      {/* ── Hero ── */}
      <header className="relative overflow-hidden">
        <AmbientBackdrop grid blobs={HERO_BLOBS} />

        {/* Cinematic recon banner — counter-drone field training */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-6">
          <Reveal>
            <div
              className="group relative overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-bg aspect-[16/9] sm:aspect-[21/9] transition-[border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ghost-text-muted/50"
              dir="ltr"
            >
              <img
                src="/drone-hero-training.png"
                alt={c.bannerAlt}
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover object-[center_38%] transition-[transform,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] [filter:grayscale(1)_contrast(1.06)] group-hover:scale-[1.04] group-hover:[filter:grayscale(0)_contrast(1.02)]"
              />
              {/* scanlines */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-30 transition-opacity duration-500 group-hover:opacity-15"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)",
                }}
              />
              {/* scan-beam — sweeps once on hover */}
              <div
                aria-hidden
                className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none opacity-0 -translate-x-full transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[420%] group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(105deg, transparent, rgb(96 116 132 / 0.28) 45%, rgb(255 255 255 / 0.18) 50%, rgb(96 116 132 / 0.28) 55%, transparent)",
                }}
              />
              {/* fade into the page */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, rgb(0 0 0 / 0.35) 0%, transparent 28%, transparent 55%, rgb(var(--ghost-bg) / 0.95) 100%)",
                }}
              />
              {/* corner brackets — draw out on hover */}
              <span className="absolute top-3 left-3 w-4 h-4 border-t border-l border-white/45 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-6 group-hover:h-6 group-hover:border-white/80" />
              <span className="absolute top-3 right-3 w-4 h-4 border-t border-r border-white/45 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-6 group-hover:h-6 group-hover:border-white/80" />
              <span className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-white/45 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-6 group-hover:h-6 group-hover:border-white/80" />
              <span className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-white/45 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-6 group-hover:h-6 group-hover:border-white/80" />
              {/* tags */}
              <span className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex max-w-[90%] items-center gap-1.5 h-6 px-2.5 rounded-full bg-black/45 backdrop-blur-sm font-mono text-[8px] sm:text-[9px] tracking-[0.12em] sm:tracking-[0.16em] uppercase text-white/90">
                <ShieldAlert size={10} className="flex-shrink-0" /> <span className="truncate">Field training · counter-UAS</span>
              </span>
              <span className="absolute bottom-3.5 left-3.5 inline-flex max-w-[70%] items-center gap-1.5 font-mono text-[8px] sm:text-[9px] tracking-[0.12em] sm:tracking-[0.16em] uppercase text-white/75">
                <Radar size={10} className="flex-shrink-0" /> <span className="truncate">Ghost LKM-Drone · live exercise</span>
              </span>
            </div>
          </Reveal>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-10 text-center">
          <div dir="ltr" className="animate-splash-in mb-6 inline-flex max-w-full flex-wrap justify-center items-center gap-2 min-h-7 py-1 pl-2.5 pr-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/40" style={{ animationDelay: "60ms" }}>
            <span className="ghost-alert-dot" />
            <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.16em] sm:tracking-[0.22em] uppercase text-ghost-text-muted">
              LKM-Drone by Ghost · Visual Intelligence
            </span>
          </div>

          <h1 className="animate-splash-in text-[clamp(1.625rem,7vw,3.125rem)] leading-[1.06] font-semibold tracking-[-0.035em] text-balance" style={{ animationDelay: "120ms" }}>
            <span className="text-ghost-text-primary">{c.heroTitle}</span>
            <br />
            <span className="text-ghost-text-muted">{c.heroTitleSub}</span>
          </h1>

          <p className="animate-splash-in mt-6 text-[16px] sm:text-[18px] leading-[1.6] text-ghost-text-secondary max-w-2xl mx-auto text-pretty" style={{ animationDelay: "180ms" }}>
            {c.heroBody}
          </p>

          <div className="animate-splash-in mt-9 flex flex-col sm:flex-row flex-wrap justify-center items-center gap-2.5" style={{ animationDelay: "240ms" }}>
            {/* Primary CTA — accent fill, scan sweep on hover */}
            <button
              onClick={onAccess}
              className="group relative inline-flex items-center justify-center gap-2 h-12 ps-6 pe-5 rounded-full bg-ghost-accent text-ghost-bg overflow-hidden transition-all duration-200 hover:bg-ghost-accent-hover active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ghost-bg"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full group-hover:opacity-100"
                style={{ background: "linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.22) 50%, transparent 70%)" }}
              />
              <span className="relative text-[14px] font-semibold tracking-[-0.01em]">{c.requestDemo}</span>
              <ArrowUpRight size={15} className="relative transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </button>

            {/* Quiet glass CTA — download */}
            {onDownloadReport && (
              <button
                onClick={onDownloadReport}
                className="group relative inline-flex items-center justify-center gap-2.5 h-12 ps-4 pe-5 rounded-full border border-ghost-border-subtle/70 bg-ghost-surface/30 text-ghost-text-primary overflow-hidden transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/55 hover:border-ghost-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
              >
                <span className="flex items-center justify-center h-7 w-7 rounded-full border border-ghost-border-subtle/70 bg-ghost-bg/40 transition-colors duration-200 group-hover:border-ghost-text-muted/60">
                  <Download size={14} className="transition-transform duration-200 group-hover:translate-y-0.5" />
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span dir="ltr" className="font-mono text-[8.5px] tracking-[0.18em] uppercase text-ghost-text-muted">Intel · PDF</span>
                  <span className="text-[13.5px] font-medium">{c.downloadFieldReport}</span>
                </span>
              </button>
            )}

            {/* Quiet glass CTA — architecture */}
            <a
              href="#architecture"
              className="group relative inline-flex items-center justify-center gap-2.5 h-12 ps-5 pe-4 rounded-full border border-ghost-border-subtle/70 bg-ghost-surface/30 text-ghost-text-primary overflow-hidden transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/55 hover:border-ghost-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
            >
              <span className="flex flex-col items-start leading-tight">
                <span dir="ltr" className="font-mono text-[8.5px] tracking-[0.18em] uppercase text-ghost-text-muted">System · Brief</span>
                <span className="text-[13.5px] font-medium">{c.viewArchitecture}</span>
              </span>
              <ArrowDownRight size={15} className="text-ghost-text-muted transition-transform duration-200 group-hover:translate-y-0.5 rtl:-scale-x-100" />
            </a>
          </div>

          <div className="animate-splash-in mt-9 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "300ms" }}>
            {c.trust.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/30 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted">
                <ShieldCheck size={11} />
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-6">
          <Reveal delay={80}>
            <AirspaceScope copy={c} />
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 max-w-prose mx-auto text-center font-mono text-[9px] sm:text-[10px] tracking-[0.14em] sm:tracking-[0.2em] uppercase text-ghost-text-muted text-balance">
              {c.scopeCaption}
            </p>
          </Reveal>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 space-y-16 sm:space-y-24 pt-8 sm:pt-12" style={{ overflowX: "clip" }}>
        {/* ── The challenge ── */}
        <Section>
          <Reveal>
            <SectionLabel>The Challenge // A New Class Of Threat</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="text-[clamp(1.375rem,4.5vw,2rem)] font-semibold text-ghost-text-primary leading-[1.12] tracking-[-0.025em] text-balance">
              {c.challengeTitle}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.challengeP1}
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.challengeP2}
            </p>
          </Reveal>
        </Section>

        {/* ── Beyond cameras ── */}
        <Section>
          <Reveal>
            <SectionLabel>Doctrine // Beyond Cameras, Beyond Monitoring</SectionLabel>
          </Reveal>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <Reveal delay={70}>
              <h2 className="text-[clamp(1.25rem,4vw,1.875rem)] font-semibold text-ghost-text-primary leading-[1.14] tracking-[-0.02em] text-balance">
                {c.doctrineTitle}
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
                {c.doctrineBody}
              </p>
              <div className="mt-6 space-y-3">
                {c.doctrineLines.map((line) => (
                  <div key={line} className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ghost-accent flex-shrink-0" />
                    <p className="text-[15px] leading-relaxed text-ghost-text-secondary">{line}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[14px] leading-relaxed text-ghost-text-muted">
                {c.doctrineNote}
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted mb-4">
                  {c.evaluatedLabel}
                </p>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  {c.evaluates.map((e) => (
                    <span key={e} className="inline-flex items-center gap-2 rounded-xl border border-ghost-border-subtle bg-ghost-bg/40 px-3 py-2.5 text-[13px] text-ghost-text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-ghost-accent/80 flex-shrink-0" />
                      <span className="leading-tight">{e}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ── Pixel challenge: behave like a drone ── */}
        <Section>
          <Reveal>
            <SectionLabel>The Pixel Problem // Detecting What Others Miss</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="ghost-glass rounded-3xl border border-ghost-border-subtle p-6 sm:p-9">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[15px] leading-relaxed text-ghost-text-secondary text-pretty">
                  {c.pixelP1}
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary text-pretty">
                  {c.pixelP2}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-bg/50 px-5 py-4">
                  <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted mb-1.5">
                    {c.traditionalAskLabel}
                  </p>
                  <p className="text-[17px] font-medium text-ghost-text-muted line-through decoration-ghost-text-muted/40">
                    {c.traditionalAsk}
                  </p>
                </div>
                <div className="rounded-2xl border border-ghost-accent/40 bg-ghost-surface/40 px-5 py-4">
                  <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-accent mb-1.5">
                    {c.ghostAskLabel}
                  </p>
                  <p className="text-[17px] font-semibold text-ghost-text-primary">
                    {c.ghostAskPre}<span className="text-ghost-accent">{c.ghostAskAccent}</span>{c.ghostAskPost}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ── Proprietary technology ── */}
        <Section id="architecture" className="scroll-mt-24">
          <Reveal>
            <SectionLabel>Technology // Proprietary Detection Engine</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl mb-9">
            <h2 className="text-[clamp(1.375rem,4.5vw,2rem)] font-semibold text-ghost-text-primary leading-[1.12] tracking-[-0.025em] text-balance">
              {c.techTitle}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.techBody}
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROPRIETARY.map((p, i) => {
              const Icon = p.icon;
              const engine = c.engines[i];
              return (
                <Reveal key={p.name} delay={(i % 3) * 80}>
                  <article className="h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6 flex flex-col transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/50">
                    <span className="w-10 h-10 rounded-xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary mb-4">
                      <Icon size={18} />
                    </span>
                    <h3 dir="ltr" className="text-[17px] font-semibold text-ghost-text-primary leading-tight rtl:text-end">
                      {p.name}
                      {p.tm && <span className="align-super text-[10px] text-ghost-text-muted ms-0.5">™</span>}
                    </h3>
                    <p className="mt-1 text-[12.5px] font-medium text-ghost-accent">{engine.tagline}</p>
                    {p.image && (
                      <figure
                        className="mt-4 relative overflow-hidden rounded-xl border border-ghost-border-subtle bg-ghost-bg/60"
                        style={{ aspectRatio: "16 / 11" }}
                        dir="ltr"
                      >
                        <img
                          src={p.image}
                          alt={engine.imageAlt}
                          draggable={false}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ filter: "grayscale(0.35) contrast(1.06) brightness(0.92)" }}
                        />
                        <div
                          aria-hidden
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              "radial-gradient(120% 90% at 50% 0%, rgb(36 56 52 / 0.22), transparent 60%), linear-gradient(180deg, transparent 55%, rgb(6 10 9 / 0.55) 100%)",
                          }}
                        />
                        <figcaption
                          dir={dir}
                          className="absolute bottom-2 left-2.5 right-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-text-muted"
                        >
                          {c.engineCaption}
                        </figcaption>
                      </figure>
                    )}
                    <p className="mt-4 text-[13.5px] leading-relaxed text-ghost-text-secondary">{engine.body}</p>
                    <div className="mt-4 pt-4 border-t border-ghost-border-subtle space-y-2">
                      {engine.points.map((pt) => (
                        <div key={pt} className="flex items-start gap-2.5">
                          <Crosshair size={12} className="mt-0.5 text-ghost-text-muted flex-shrink-0" />
                          <span className="text-[12.5px] leading-snug text-ghost-text-secondary">{pt}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* ── Threat detection lifecycle ── */}
        <Section>
          <Reveal>
            <SectionLabel>Lifecycle // From Observation To Action</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="text-[clamp(1.375rem,4.5vw,2rem)] font-semibold text-ghost-text-primary leading-[1.12] tracking-[-0.025em] text-balance">
              {c.lifecycleTitle}
            </h2>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <div className="ghost-glass rounded-3xl border border-ghost-border-subtle p-6 sm:p-8">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {c.lifecycle.map((s, i) => {
                  const Icon = LIFECYCLE_ICONS[i];
                  return (
                    <div key={s.label} className="relative rounded-2xl border border-ghost-border-subtle bg-ghost-bg/40 px-5 py-5">
                      <span className="absolute top-4 end-4 font-mono text-[10px] tracking-[0.18em] text-ghost-text-muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary mb-3">
                        <Icon size={19} />
                      </span>
                      <p className="text-[15px] font-semibold text-ghost-text-primary">{s.label}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ghost-text-secondary">{s.sub}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ── Real-time threat awareness ── */}
        <Section>
          <Reveal>
            <SectionLabel>Awareness // Actionable Intelligence, Immediately</SectionLabel>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {c.awareness.map((a, i) => {
              const Icon = AWARENESS_ICONS[i];
              return (
                <Reveal key={a.title} delay={(i % 3) * 70}>
                  <article className="h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6 flex flex-col transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/50">
                    <span className="w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary mb-4">
                      <Icon size={16} />
                    </span>
                    <h3 className="text-[16px] font-semibold text-ghost-text-primary">{a.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-ghost-text-secondary">{a.body}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* ── Harsh environments ── */}
        <Section>
          <Reveal>
            <SectionLabel>Field // Built For Harsh Environments</SectionLabel>
          </Reveal>

          {/* Field team + rapid-deploy kit. */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Reveal>
              <IntelFigure
                src="/brand/field-team.jpg"
                alt="Field deployment team"
                ratio="16/10"
                badge="Field // Team"
                faceProtect
              />
            </Reveal>
            <Reveal delay={80}>
              <IntelFigure
                src="/brand/field-deploy-kit.jpg"
                alt="Rapid-deploy field kit"
                ratio="16/10"
                badge="Kit // Deploy"
              />
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.environments.map((e, i) => {
              const Icon = ENVIRONMENT_ICONS[i];
              return (
                <Reveal key={e.title} delay={(i % 4) * 60}>
                  <div className="h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/50">
                    <span className="w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-secondary mb-4">
                      <Icon size={16} />
                    </span>
                    <h4 className="text-[15px] font-semibold text-ghost-text-primary">{e.title}</h4>
                    <ul className="mt-3 space-y-1.5">
                      {e.points.map((pt) => (
                        <li key={pt} className="flex items-center gap-2 text-[12.5px] text-ghost-text-secondary">
                          <span className="w-1 h-1 rounded-full bg-ghost-text-muted flex-shrink-0" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* ── Visual intelligence, not VMS ── */}
        <Section>
          <Reveal>
            <SectionLabel>Experience // Visual Intelligence, Not Video Management</SectionLabel>
          </Reveal>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <Reveal delay={70}>
              <h2 className="text-[clamp(1.25rem,4vw,1.875rem)] font-semibold text-ghost-text-primary leading-[1.14] tracking-[-0.02em] text-balance">
                {c.experienceTitle}
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
                {c.experienceBody}
              </p>
              <div className="mt-7 space-y-2.5">
                {c.contactMap.map((m, i) => {
                  const Icon = CONTACT_MAP_ICONS[i];
                  return (
                    <div key={m.a} className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3 rounded-xl border border-ghost-border-subtle bg-ghost-surface/30 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-secondary flex-shrink-0">
                          <Icon size={15} />
                        </span>
                        <span className="text-[14px] text-ghost-text-secondary">{m.a}</span>
                      </div>
                      <ArrowRight size={15} className="text-ghost-text-muted flex-shrink-0 rotate-90 xs:rotate-0 xs:rtl:rotate-180 ms-10 xs:ms-0" />
                      <span className="text-[14px] font-semibold text-ghost-text-primary ms-10 xs:ms-0">{m.b}</span>
                    </div>
                  );
                })}
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-bg overflow-hidden">
                <div dir="ltr" className="flex items-center gap-2 h-10 px-3.5 border-b border-ghost-border-subtle bg-ghost-surface/30">
                  <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted">
                    Ask LKM-Drone
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {c.queries.map((q) => (
                    <div key={q} className="flex items-start gap-3 rounded-xl border border-ghost-border-subtle bg-ghost-surface/30 px-4 py-3 transition-colors duration-200 hover:bg-ghost-surface/50">
                      <MessageSquareText size={14} className="mt-0.5 text-ghost-text-muted flex-shrink-0" />
                      <p className="text-[13.5px] leading-relaxed text-ghost-text-primary">{q}</p>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 h-11 rounded-3xl border border-ghost-border-subtle bg-ghost-surface/40 ps-4 pe-1.5 mt-1">
                    <Search size={14} className="text-ghost-text-muted flex-shrink-0" />
                    <span className="text-[13px] text-ghost-text-muted flex-1 truncate">{c.composerPlaceholder}</span>
                    <span className="w-8 h-8 rounded-full bg-ghost-accent text-ghost-bg flex items-center justify-center flex-shrink-0">
                      <Send size={14} className="rtl:-scale-x-100" />
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ── Rapid deployment ── */}
        <Section>
          <Reveal>
            <SectionLabel>Deployment // Rapid, On Existing Infrastructure</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl mb-8">
            <p className="text-[16px] leading-relaxed text-ghost-text-secondary">
              {c.deploymentIntro}
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.deployment.map((d, i) => {
              const Icon = DEPLOYMENT_ICONS[i];
              return (
                <Reveal key={d.title} delay={(i % 3) * 60}>
                  <div className="h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/50">
                    <span className="w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-secondary mb-4">
                      <Icon size={16} />
                    </span>
                    <h4 className="text-[14px] font-semibold text-ghost-text-primary">{d.title}</h4>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ghost-text-secondary">{d.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* ── Primary use cases ── */}
        <Section>
          <Reveal>
            <SectionLabel>Use Cases // Where LKM-Drone Operates</SectionLabel>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {c.useCases.map((u, i) => {
              const Icon = USE_CASE_ICONS[i];
              return (
                <Reveal key={u.title} delay={(i % 3) * 70}>
                  <article className="h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6 flex flex-col transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-ghost-surface/50">
                    <span className="w-9 h-9 rounded-lg border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary mb-4">
                      <Icon size={16} />
                    </span>
                    <h3 className="text-[16px] font-semibold text-ghost-text-primary">{u.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-ghost-text-secondary">{u.body}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* ── Key benefits ── */}
        <Section>
          <Reveal>
            <SectionLabel>Summary // Key Benefits</SectionLabel>
          </Reveal>
          <div className="flex flex-wrap gap-3">
            {c.benefits.map((b) => (
              <span key={b} className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-ghost-border-subtle bg-ghost-surface/30 text-[14px] text-ghost-text-secondary transition-colors duration-200 hover:bg-ghost-surface/60">
                <ShieldCheck size={13} className="text-ghost-text-muted" />
                {b}
              </span>
            ))}
          </div>
          <Reveal delay={80} className="mt-10 max-w-3xl">
            <p className="text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.summaryBody}<span className="text-ghost-text-primary font-medium">{c.summaryAccent}</span>
            </p>
          </Reveal>
        </Section>

        {/* ── Classified field report download ── */}
        {onDownloadReport && (
          <Section>
            <Reveal>
              <SectionLabel>Field Report // Classified · Need-To-Know</SectionLabel>
            </Reveal>
            <Reveal delay={70}>
              <div className="ghost-glass rounded-3xl border border-ghost-border-subtle p-6 sm:p-9">
                <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-center">
                  <div>
                    <span dir="ltr" className="inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/40 font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted">
                      <Lock size={11} />
                      SECRET // NOFORN
                    </span>
                    <h2 className="mt-5 text-[clamp(1.25rem,4vw,1.875rem)] font-semibold text-ghost-text-primary leading-[1.14] tracking-[-0.02em] text-balance">
                      {c.reportTitle}
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary text-pretty">
                      {c.reportBody}
                    </p>
                    <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                      {c.reportItems.map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-[13.5px] text-ghost-text-secondary">
                          <ShieldCheck size={13} className="text-ghost-text-muted flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5 text-center">
                    <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary mb-4">
                      <FileText size={22} />
                    </span>
                    <p dir="ltr" className="text-[14px] font-semibold text-ghost-text-primary">
                      Ghost LKM-Drone — Field Report
                    </p>
                    <p className="mt-1 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted">
                      {c.reportDocMeta}
                    </p>
                    <button
                      onClick={onDownloadReport}
                      className="group mt-5 w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover active:scale-[0.99] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
                    >
                      <Download size={16} className="transition-transform duration-200 group-hover:translate-y-0.5" />
                      <span>{c.reportDownload}</span>
                    </button>
                    <p className="mt-3 text-[11px] leading-relaxed text-ghost-text-muted">
                      {c.reportFootnote}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </Section>
        )}

        {/* ── CTA ── */}
        <section className="relative z-10 overflow-hidden ghost-glass rounded-3xl border border-ghost-border-subtle px-6 py-14 sm:py-16">
          <AmbientBackdrop blobs={CTA_BLOBS} />
          <div className="relative z-10 max-w-xl mx-auto text-center">
            <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary mb-5">
              <Radar size={22} />
            </span>
            <h2 className="text-[clamp(1.25rem,4vw,1.875rem)] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.ctaTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
              {c.ctaBody}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-3">
              <button
                onClick={onAccess}
                className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover active:scale-[0.99] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ghost-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ghost-bg"
              >
                <span>{c.requestDemo}</span>
                <ArrowUpRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
              </button>
              <button
                onClick={() => onNavigate("defense")}
                className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full border border-ghost-border-subtle bg-ghost-surface/40 text-ghost-text-primary text-[15px] font-medium hover:bg-ghost-surface-hover transition-colors duration-200"
              >
                <span>{c.explorePlatform}</span>
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </button>
            </div>
            <p dir="ltr" className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
              <Wind size={11} />
              Confidential · Shared under NDA terms
            </p>
          </div>
        </section>

        <PageAmbient />
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
          <span className="truncate">Ghost LKM-Drone — Aerial Threat Intelligence</span>
          <span className="hidden sm:inline flex-shrink-0 text-ghost-text-secondary">Defense</span>
        </div>
      </footer>
    </div>
  );
}

