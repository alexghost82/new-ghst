import { useEffect, useRef, useState } from "react";
import GhostIcon from "../shared/GhostIcon";
import {
  ArrowUpRight,
  ShieldAlert,
  Repeat,
  CalendarClock,
  Video,
  Search,
  MessageSquareText,
} from "lucide-react";
import {
  SECTORS,
  getSector,
  localizeSector,
  type LocalizedSector,
  type SceneKey,
  type Sector,
  type SectorZone,
} from "../../data/useCases";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import { USE_CASES_COPY, type UseCasesCopy } from "../../site/copy/useCases";
import IntelFigure from "../shared/IntelFigure";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface UseCasesPageProps {
  onBack: () => void;
  onAccess: () => void;
  // Shared marketing-site navigation (drives the persistent sidebar).
  onNavigate: (page: SitePage) => void;
  // Optional deep-link into a specific sector on mount.
  initialSectorId?: string | null;
}

// ── Motion helper — the same quiet "fade up" reveal used across the brief ─────
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span
        dir="ltr"
        className="min-w-0 font-mono text-[10px] sm:text-[11px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance"
      >
        {children}
      </span>
      <span className="flex-1 h-px bg-ghost-border-subtle" />
    </div>
  );
}

// ── Camera viewport mock — flat synthetic "feed" for the demo card ────────────
const SCENES: Record<SceneKey, string> = {
  night:
    "radial-gradient(120% 90% at 50% 110%, rgb(28 42 38 / 0.9), transparent 60%), radial-gradient(80% 70% at 78% 12%, rgb(48 72 64 / 0.55), transparent 60%), linear-gradient(180deg, #0b1412 0%, #0a0f0e 60%, #060908 100%)",
  day: "radial-gradient(120% 90% at 50% 0%, rgb(120 140 160 / 0.45), transparent 60%), linear-gradient(180deg, #2a323c 0%, #20262e 55%, #171b21 100%)",
  indoor:
    "radial-gradient(110% 80% at 50% 0%, rgb(70 64 54 / 0.65), transparent 60%), linear-gradient(180deg, #1a1714 0%, #14110f 60%, #0d0b09 100%)",
  dock: "radial-gradient(120% 90% at 30% 110%, rgb(40 44 56 / 0.9), transparent 60%), radial-gradient(70% 60% at 80% 0%, rgb(60 66 86 / 0.5), transparent 60%), linear-gradient(180deg, #0c0f16 0%, #0a0c12 60%, #070809 100%)",
  cold: "radial-gradient(120% 90% at 50% 0%, rgb(80 110 140 / 0.5), transparent 60%), linear-gradient(180deg, #12222e 0%, #0e1a24 60%, #08121a 100%)",
};

function CameraViewport({
  scene,
  cam,
  time,
  image,
}: {
  scene: SceneKey;
  cam: string;
  time: string;
  image?: string;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-white/10"
      style={{ aspectRatio: "16 / 9", background: SCENES[scene] }}
      dir="ltr"
    >
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden
          draggable={false}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Dark vignette keeps the surveillance HUD legible over any still. */}
      {image && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgb(0 0 0 / 0.45) 0%, transparent 22%, transparent 72%, rgb(0 0 0 / 0.55) 100%)",
          }}
        />
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

// ── The three monitoring modes, with their visual identity ────────────────────
// Reader-facing labels live in USE_CASES_COPY.checkLabels; the mono `sub` is a
// brand-signature English label and stays English in both locales.
const CHECK_KINDS = [
  {
    key: "periodic" as const,
    sub: "Periodic",
    icon: Repeat,
    accent: "text-ghost-text-secondary",
  },
  {
    key: "critical" as const,
    sub: "Critical",
    icon: ShieldAlert,
    accent: "text-ghost-error",
  },
  {
    key: "scheduled" as const,
    sub: "Scheduled",
    icon: CalendarClock,
    accent: "text-ghost-text-secondary",
  },
];

// ── Single sector card — tactical hover: cursor spotlight, viewfinder corners ──
function SectorCard({
  sector,
  copy,
  onOpen,
}: {
  sector: LocalizedSector;
  copy: UseCasesCopy;
  onOpen: (id: string) => void;
}) {
  const Icon = sector.icon;
  const cardRef = useRef<HTMLButtonElement>(null);

  // Cursor-tracking spotlight. Token-driven (`--ghost-text-primary`) so it reads
  // as a soft light glow on dark surfaces and a faint shade on light ones.
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <button
      ref={cardRef}
      onClick={() => onOpen(sector.id)}
      onPointerMove={handlePointerMove}
      className="group relative w-full h-full text-start rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6 flex flex-col overflow-hidden transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
    >
      {/* Cursor-tracking spotlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(360px circle at var(--mx, 50%) var(--my, 0%), rgb(var(--ghost-text-primary) / 0.07), transparent 60%)",
        }}
      />
      {/* Content sits above the ambient overlays */}
      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-4">
          <span className="w-10 h-10 rounded-xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
            <Icon
              size={18}
              className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
            />
          </span>
          <span
            dir="ltr"
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted transition-colors duration-300 group-hover:text-ghost-text-secondary"
          >
            {sector.kicker}
          </span>
        </div>
        <h3 className="text-[17px] font-semibold text-ghost-text-primary">
          {sector.name}
        </h3>
        <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ghost-text-secondary">
          {sector.blurb}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ghost-text-secondary transition-colors duration-300 group-hover:text-ghost-text-primary">
          <span>
            {sector.zones.length} {copy.monitoringZones}
          </span>
          <ArrowUpRight
            size={14}
            className="rtl:-scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </button>
  );
}

// ── Flagship "primary sector" card — wider, with a live demo + stats strip ───
// Reserved for the handful of high-stakes environments (sectors flagged
// ``tier: "primary"``). Reads heavier than a regular SectorCard: a camera
// viewport, a denser stats strip, and a bigger title — the same brand tokens,
// just given more room.
function FlagshipSectorCard({
  sector,
  copy,
  onOpen,
}: {
  sector: LocalizedSector;
  copy: UseCasesCopy;
  onOpen: (id: string) => void;
}) {
  const Icon = sector.icon;
  const totalChecks = sector.zones.length * 3;
  const stats = [
    { value: String(sector.zones.length).padStart(2, "0"), sub: "Zones" },
    { value: String(totalChecks).padStart(2, "0"), sub: "Checks" },
    { value: "24/7", sub: "Coverage" },
  ];

  return (
    <button
      onClick={() => onOpen(sector.id)}
      className="group relative w-full h-full text-start rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5 sm:p-6 flex flex-col overflow-hidden transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_24px_64px_-28px_rgb(var(--ghost-text-primary)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
    >
      <div className="relative z-10 flex flex-col gap-5 sm:grid sm:grid-cols-2 sm:gap-6 sm:items-stretch">
        {/* Live demo viewport — the same VISINT framing used in the dossier */}
        <CameraViewport
          scene={sector.demo.scene}
          cam={`${sector.demo.zone} · CAM`}
          time={sector.demo.time}
          image={sector.demo.image}
        />

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
              <Icon size={20} />
            </span>
            <span
              dir="ltr"
              className="font-mono text-[9px] tracking-[0.22em] uppercase text-ghost-text-muted transition-colors duration-300 group-hover:text-ghost-text-secondary"
            >
              Primary Sector
            </span>
          </div>

          <h3 className="text-[20px] sm:text-[22px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.01em]">
            {sector.name}
          </h3>
          <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ghost-text-secondary">
            {sector.blurb}
          </p>

          <div className="mt-4 grid grid-cols-3 rounded-xl border border-ghost-border-subtle bg-ghost-surface/20 divide-x divide-ghost-border-subtle/70 rtl:divide-x-reverse overflow-hidden">
            {stats.map((s) => (
              <div key={s.sub} className="px-2.5 py-2.5 min-w-0">
                <p className="font-mono text-[15px] leading-none text-ghost-text-primary tabular-nums">
                  {s.value}
                </p>
                <p
                  dir="ltr"
                  className="mt-1.5 font-mono text-[8.5px] tracking-[0.18em] uppercase text-ghost-text-muted"
                >
                  {s.sub}
                </p>
              </div>
            ))}
          </div>

          <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ghost-text-secondary transition-colors duration-300 group-hover:text-ghost-text-primary">
            <span>
              {sector.zones.length} {copy.monitoringZones}
            </span>
            <ArrowUpRight
              size={14}
              className="rtl:-scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Primary sectors band — the flagship environments, above the full grid ─────
function FlagshipBand({ onOpen }: { onOpen: (id: string) => void }) {
  const locale = useSiteLocaleStore((s) => s.locale);
  const copy = USE_CASES_COPY[locale];
  const primary = SECTORS.filter((s) => s.tier === "primary");
  if (primary.length === 0) return null;

  return (
    <>
      <Reveal>
        <SectionLabel>Use Cases // Primary Sectors</SectionLabel>
      </Reveal>
      <Reveal delay={60} className="max-w-2xl">
        <h2 className="text-[clamp(1.375rem,4.5vw,2.125rem)] font-semibold text-ghost-text-primary leading-[1.12] tracking-[-0.025em]">
          {copy.primaryTitle}
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary">
          {copy.primaryIntro}
        </p>
      </Reveal>

      <div className="mt-10 grid lg:grid-cols-2 gap-5">
        {primary.map((s, i) => (
          <Reveal key={s.id} delay={(i % 2) * 80}>
            <FlagshipSectorCard
              sector={localizeSector(s, locale)}
              copy={copy}
              onOpen={onOpen}
            />
          </Reveal>
        ))}
      </div>
    </>
  );
}

// ── Sector overview grid ──────────────────────────────────────────────────────
function SectorGrid({ onOpen }: { onOpen: (id: string) => void }) {
  const locale = useSiteLocaleStore((s) => s.locale);
  const copy = USE_CASES_COPY[locale];
  // Flagship sectors live in their own band above; keep them out of the grid.
  const gridSectors = SECTORS.filter((s) => s.tier !== "primary");
  return (
    <>
      <FlagshipBand onOpen={onOpen} />

      <Reveal className="mt-20">
        <SectionLabel>Use Cases // By Sector</SectionLabel>
      </Reveal>
      <Reveal delay={60} className="max-w-2xl">
        <h2 className="text-[clamp(1.375rem,4.5vw,2.125rem)] font-semibold text-ghost-text-primary leading-[1.12] tracking-[-0.025em]">
          {copy.gridTitle}
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary">
          {copy.gridIntro}
        </p>
      </Reveal>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {gridSectors.map((s, i) => (
          <Reveal key={s.id} delay={(i % 3) * 70}>
            <SectorCard sector={localizeSector(s, locale)} copy={copy} onOpen={onOpen} />
          </Reveal>
        ))}
      </div>

      {/* Deployment environments — the physical surfaces Ghost watches. */}
      <Reveal className="mt-20">
        <SectionLabel>Deployment // Where Ghost Watches</SectionLabel>
      </Reveal>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { src: "/brand/perimeter.jpg", alt: "Perimeter line", badge: "CAM // Perimeter" },
          { src: "/brand/gate-camera.jpg", alt: "Gate camera", badge: "CAM // Gate" },
          { src: "/brand/parking-mast.jpg", alt: "Parking mast camera", badge: "CAM // Lot" },
          { src: "/brand/campus-entrance.jpg", alt: "Campus entrance", badge: "CAM // Entrance" },
        ].map((img, i) => (
          <Reveal key={img.src} delay={(i % 4) * 70}>
            <IntelFigure src={img.src} alt={img.alt} ratio="3/4" badge={img.badge} />
          </Reveal>
        ))}
      </div>
    </>
  );
}

// ── Single zone card — dossier sheet: numbered header, ruled check rows ───────
function ZoneCard({
  zone,
  copy,
  index,
}: {
  zone: SectorZone;
  copy: UseCasesCopy;
  index: number;
}) {
  return (
    <Reveal delay={(index % 2) * 60} className="h-full">
      <article className="h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 flex flex-col overflow-hidden transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-ghost-text-primary/20 hover:bg-ghost-surface/40">
        {/* Zone header — mono index + name over a hairline */}
        <div className="flex items-baseline gap-3 px-5 pt-4 pb-3 border-b border-ghost-border-subtle/70">
          <span
            dir="ltr"
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted flex-shrink-0 tabular-nums"
          >
            Zone {String(index + 1).padStart(2, "0")}
          </span>
          <h4 className="text-[15px] font-semibold text-ghost-text-primary leading-snug min-w-0">
            {zone.name}
          </h4>
        </div>

        {/* Three monitoring modes as ruled rows — critical carries a red rule */}
        <div className="flex-1 divide-y divide-ghost-border-subtle/60">
          {CHECK_KINDS.map((k) => {
            const Icon = k.icon;
            const critical = k.key === "critical";
            return (
              <div key={k.key} className="relative px-5 py-3.5">
                {critical && (
                  <span
                    aria-hidden
                    className="absolute start-0 top-3 bottom-3 w-[2px] rounded-e bg-ghost-error/50"
                  />
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`flex items-center flex-shrink-0 ${k.accent}`}>
                    <Icon size={13} strokeWidth={2} />
                  </span>
                  <span className="text-[12px] font-semibold text-ghost-text-primary">
                    {copy.checkLabels[k.key]}
                  </span>
                  <span
                    dir="ltr"
                    className="ms-auto font-mono text-[9px] tracking-[0.16em] uppercase text-ghost-text-muted flex-shrink-0"
                  >
                    {k.sub}
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ghost-text-secondary">
                  {zone.checks[k.key]}
                </p>
              </div>
            );
          })}
        </div>
      </article>
    </Reveal>
  );
}

// ── Sector detail view — "sector dossier" template ────────────────────────────
function SectorDetail({ sector }: { sector: Sector }) {
  const locale = useSiteLocaleStore((s) => s.locale);
  const copy = USE_CASES_COPY[locale];
  // Resolved display copy for the active locale. Tactical chrome (mono labels,
  // camera id, status lines) keeps the English `sector.demo.zone` / `kicker`.
  const view = localizeSector(sector, locale);
  const Icon = sector.icon;
  const totalChecks = sector.zones.length * 3;

  // Sector-at-a-glance data strip. Mono sublabels are brand-signature English.
  const stats = [
    {
      value: String(sector.zones.length).padStart(2, "0"),
      label: copy.monitoringZones,
      sub: "Zones",
    },
    {
      value: String(totalChecks).padStart(2, "0"),
      label: copy.definedChecks,
      sub: "Checks",
    },
    { value: "24/7", label: copy.continuousCoverage, sub: "Coverage" },
  ];

  return (
    <>
      {/* Dossier header — eyebrow, display title, blurb */}
      <Reveal>
        <SectionLabel>Sector Brief // {sector.kicker}</SectionLabel>
      </Reveal>
      <Reveal delay={50}>
        <div className="flex items-start gap-4 sm:gap-5">
          <span className="w-14 h-14 rounded-2xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary flex-shrink-0">
            <Icon size={26} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[clamp(1.625rem,5vw,2.5rem)] font-normal text-ghost-text-primary leading-[1.05] tracking-[-0.03em]">
              {view.name}
            </h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ghost-text-secondary">
              {view.blurb}
            </p>
          </div>
        </div>
      </Reveal>

      {/* Data strip — the sector at a glance */}
      <Reveal delay={100} className="mt-8">
        <div className="grid grid-cols-1 xs:grid-cols-3 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/20 divide-y xs:divide-y-0 xs:divide-x divide-ghost-border-subtle/70 rtl:divide-x-reverse overflow-hidden">
          {stats.map((s) => (
            <div key={s.sub} className="px-4 sm:px-6 py-4 min-w-0">
              <p className="font-mono text-[20px] sm:text-[24px] leading-none text-ghost-text-primary tabular-nums">
                {s.value}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-ghost-text-secondary truncate">
                {s.label}
              </p>
              <p className="mt-0.5 font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Live demo — console-framed feed: titlebar, stage, status footer */}
      <Reveal delay={140} className="mt-12">
        <SectionLabel>In Practice // Talk To The Camera</SectionLabel>
        <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/20 overflow-hidden">
          <div
            dir="ltr"
            className="flex items-center justify-between gap-3 h-10 px-4 border-b border-ghost-border-subtle bg-ghost-bg-secondary/50"
          >
            <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted truncate">
              Ghost // Field Demo
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] uppercase text-ghost-text-muted flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-ghost-success animate-pulse" />
              <span className="hidden sm:inline">Live replica — real interface</span>
              <span className="sm:hidden">Live replica</span>
            </span>
          </div>

          <div className="p-5 sm:p-6 grid md:grid-cols-2 gap-6 items-start">
            <CameraViewport
              scene={sector.demo.scene}
              cam={`${sector.demo.zone} · CAM`}
              time={sector.demo.time}
              image={sector.demo.image}
            />

            <div className="flex flex-col gap-4">
              {/* Operator question */}
              <div className="flex justify-start">
                <div className="max-w-[88%] bg-ghost-surface rounded-3xl rounded-ss-lg px-[18px] py-2.5">
                  <p className="text-[13.5px] leading-relaxed text-ghost-text-primary">
                    {view.demo.question}
                  </p>
                </div>
              </div>

              {/* Ghost answer */}
              <div className="flex justify-start gap-2.5">
                <GhostIcon size={28} className="flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-relaxed text-ghost-text-primary">
                    {view.demo.answer}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-ghost-error font-medium">
                    <ShieldAlert size={12} strokeWidth={2.2} />
                    {copy.escalated}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            dir="ltr"
            className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-ghost-border-subtle"
          >
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-ghost-error animate-pulse flex-shrink-0" />
              <span className="truncate">Critical alert · {sector.demo.zone}</span>
            </span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted tabular-nums flex-shrink-0">
              {sector.demo.time}
            </span>
          </div>
        </div>
      </Reveal>

      {/* Zones & checks */}
      <Reveal delay={120} className="mt-12">
        <SectionLabel>Coverage // Zones &amp; Checks</SectionLabel>
      </Reveal>
      <div className="grid md:grid-cols-2 gap-5">
        {view.zones.map((zone, i) => (
          <ZoneCard key={sector.zones[i].name} zone={zone} copy={copy} index={i} />
        ))}
      </div>
    </>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function UseCasesPage({
  onBack,
  onAccess,
  onNavigate,
  initialSectorId = null,
}: UseCasesPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSectorId);
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const copy = USE_CASES_COPY[locale];

  const sector = selectedId ? getSector(selectedId) : undefined;

  // Scroll back to top whenever the active view changes.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedId]);

  const goOverview = () => setSelectedId(null);

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
        active="usecases"
        onNavigate={onNavigate}
        onScrollTop={() => {
          setSelectedId(null);
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onBack={onBack}
        onAccess={onAccess}
        locale={locale}
        dir={dir}
      />

      {/* Breadcrumb (detail only) */}
      {sector && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6">
          <div className="flex items-center gap-2 text-[12px] text-ghost-text-muted">
            <button
              onClick={goOverview}
              className="inline-flex flex-shrink-0 items-center gap-1.5 hover:text-ghost-text-primary transition-colors"
            >
              <Search size={12} />
              {copy.breadcrumb}
            </button>
            <span className="text-ghost-text-muted/60 flex-shrink-0">/</span>
            <span className="truncate min-w-0 text-ghost-text-secondary">
              {localizeSector(sector, locale).name}
            </span>
          </div>
        </div>
      )}

      <main
        className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-20 sm:pb-24"
        style={{ overflowX: "clip" }}
      >
        {/* Tactical color wash — dark, drifting, low signature. */}
        <div className="ghost-ambient ghost-ambient--page" aria-hidden>
          <div
            className="ghost-ambient__blob ghost-ambient__blob--1"
            style={{
              top: -150,
              left: "-6%",
              width: 460,
              height: 460,
              background:
                "radial-gradient(circle, rgb(96 116 132 / 0.9), transparent 70%)",
            }}
          />
          <div
            className="ghost-ambient__blob ghost-ambient__blob--3"
            style={{
              top: 320,
              right: "-6%",
              width: 480,
              height: 480,
              background:
                "radial-gradient(circle, rgb(104 116 78 / 0.82), transparent 72%)",
            }}
          />
          <div
            className="ghost-ambient__blob ghost-ambient__blob--2"
            style={{
              top: 780,
              left: "28%",
              width: 520,
              height: 520,
              background:
                "radial-gradient(circle, rgb(58 66 70 / 0.92), transparent 72%)",
            }}
          />
        </div>

        <div className="relative z-10">
          {sector ? <SectorDetail sector={sector} /> : <SectorGrid onOpen={setSelectedId} />}

          {/* Closing CTA */}
          <section className="relative overflow-hidden ghost-glass mt-20 rounded-3xl border border-ghost-border-subtle px-6 py-12 sm:py-14">
            <div className="ghost-ambient" aria-hidden>
              <div
                className="ghost-ambient__blob ghost-ambient__blob--2"
                style={{
                  bottom: -150,
                  left: "6%",
                  width: 400,
                  height: 400,
                  background:
                    "radial-gradient(circle, rgb(56 92 96 / 0.88), transparent 70%)",
                }}
              />
              <div
                className="ghost-ambient__blob ghost-ambient__blob--3"
                style={{
                  top: -130,
                  right: "4%",
                  width: 420,
                  height: 420,
                  background:
                    "radial-gradient(circle, rgb(96 116 132 / 0.82), transparent 70%)",
                }}
              />
            </div>
            <div className="relative z-10 max-w-xl mx-auto text-center">
            <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary mb-5">
              <MessageSquareText size={22} />
            </span>
            <h2 className="text-[clamp(1.25rem,3.5vw,1.75rem)] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {copy.ctaTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
              {copy.ctaBody}
            </p>
            <div className="mt-7 flex justify-center">
              <button
                onClick={onAccess}
                className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover active:scale-[0.99] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
              >
                <span>{copy.ctaButton}</span>
                <ArrowUpRight size={16} className="rtl:-scale-x-100" />
              </button>
            </div>
          </div>
          </section>
        </div>
      </main>

      {/* Brand-signature mono strip — stays English/LTR in both locales. */}
      <footer className="sticky bottom-0 z-20 bg-ghost-bg/90 backdrop-blur border-t border-ghost-border-subtle">
        <div
          dir="ltr"
          className="max-w-5xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 font-mono text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.18em] uppercase text-ghost-text-muted"
        >
          <span className="truncate">Ghost — Sovereign Visual Intelligence Infrastructure</span>
          <span className="hidden sm:inline flex-shrink-0 text-ghost-text-secondary">
            Use Cases
          </span>
        </div>
      </footer>
    </div>
  );
}
