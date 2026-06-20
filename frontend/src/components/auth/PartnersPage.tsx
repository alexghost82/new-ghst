import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  FileText,
  Globe,
  GraduationCap,
  Handshake,
  Infinity as InfinityIcon,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  Network,
  Phone,
  Rocket,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import { PARTNERS_COPY } from "../../site/copy/partners";
import IntelFigure from "../shared/IntelFigure";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface PartnersPageProps {
  onBack: () => void;
  onAccess: () => void;
  // Shared marketing-site navigation (drives the persistent sidebar).
  onNavigate: (page: SitePage) => void;
}

// ── Motion helper — the same quiet "fade up" reveal used across the brief ─────
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
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition:
          "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
        transitionDelay: `${delay}ms`,
        willChange: "opacity, transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Brand-signature mono label — always English, kept LTR inside the RTL flow.
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

// ── Cursor-tracking spotlight ─────────────────────────────────────────────────
// Shared hover idiom (mirrors UseCasesPage / TeamPage). The handler reads the
// pointer position straight off `currentTarget` — no refs — so it works for any
// card rendered inside a `.map`. `<Spotlight />` paints a soft, token-driven glow
// that only fades in on hover; the card must be `group relative overflow-hidden`
// and its content wrapped in `relative z-10` to sit above the glow.
function handleSpotlight(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

function Spotlight({ radius = 340 }: { radius?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{
        background: `radial-gradient(${radius}px circle at var(--mx, 50%) var(--my, 0%), rgb(var(--ghost-text-primary) / 0.07), transparent 60%)`,
      }}
    />
  );
}

// ── Structural data — icons zipped positionally with the bilingual copy ──────
const AUDIENCE_ICONS: LucideIcon[] = [Wrench, Building2, TrendingUp];
const TRACK_ICONS: LucideIcon[] = [Network, Globe];
const STEP_ICONS: LucideIcon[] = [Phone, Handshake, GraduationCap, Rocket];
const SUPPORT_ICONS: LucideIcon[] = [
  GraduationCap,
  FileText,
  Megaphone,
  LayoutDashboard,
];
const DIFF_ICONS: LucideIcon[] = [
  MessageSquare,
  InfinityIcon,
  Sparkles,
  MousePointerClick,
];

// ── Page shell ────────────────────────────────────────────────────────────────
export default function PartnersPage({
  onBack,
  onAccess,
  onNavigate,
}: PartnersPageProps) {
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c = PARTNERS_COPY[locale];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

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
        active="partners"
        onNavigate={onNavigate}
        onScrollTop={() =>
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
        onBack={onBack}
        onAccess={onAccess}
        accessLabel={c.accessLabel}
        locale={locale}
        dir={dir}
      />

      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-20 sm:pb-24">
        {/* Tactical color wash — dark, drifting, low signature. */}
        <div className="ghost-ambient" aria-hidden>
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
              top: 360,
              right: "-6%",
              width: 480,
              height: 480,
              background:
                "radial-gradient(circle, rgb(104 116 78 / 0.82), transparent 72%)",
            }}
          />
        </div>

        <div className="relative z-10">
          {/* Hero */}
          <Reveal>
            <SectionLabel>Ghost // Partner Program</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h1 className="text-[clamp(1.5rem,5.5vw,2.5rem)] font-semibold text-ghost-text-primary leading-[1.08] tracking-[-0.03em]">
              {c.heroTitle}
              <span className="block text-ghost-text-secondary">
                {c.heroTitleSub}
              </span>
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary">
              {c.heroBody}
            </p>
            <div className="mt-7">
              <button
                onClick={onAccess}
                className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-16px_rgb(var(--ghost-accent)/0.6)] active:translate-y-0 active:scale-[0.99] transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
              >
                <span>{c.howToJoin}</span>
                <ArrowUpRight
                  size={16}
                  className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                />
              </button>
            </div>
          </Reveal>

          {/* Hero image — Ghost partners conference */}
          <Reveal delay={120} className="mt-10">
            <figure
              onPointerMove={handleSpotlight}
              className="group relative overflow-hidden rounded-3xl border border-ghost-border-subtle bg-ghost-bg transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ghost-text-primary/25 hover:shadow-[0_30px_80px_-40px_rgb(var(--ghost-text-primary)/0.5)]"
            >
              {/* LTR chrome — image stage with a physically-positioned mono badge. */}
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: "3 / 2" }}
                dir="ltr"
              >
                <img
                  src="/partners-conference.png"
                  alt={c.heroImageAlt}
                  loading="lazy"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                />
                {/* Cursor-tracking sheen — a soft light pass over the image on hover. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 mix-blend-soft-light"
                  style={{
                    background:
                      "radial-gradient(420px circle at var(--mx, 50%) var(--my, 40%), rgb(255 255 255 / 0.18), transparent 60%)",
                  }}
                />
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-black/45 backdrop-blur-sm font-mono text-[9px] tracking-[0.16em] uppercase text-white/90">
                  Ghost Partner Summit
                </span>
              </div>
            </figure>
          </Reveal>

          {/* Why Ghost */}
          <Reveal className="mt-20">
            <SectionLabel>Why Ghost</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.whyTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
              {c.whyBody}
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.audiences.map((item, i) => {
              const Icon = AUDIENCE_ICONS[i];
              return (
                <Reveal key={item.title} delay={(i % 3) * 70} className="h-full">
                  <div
                    onPointerMove={handleSpotlight}
                    className="group relative h-full overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-6 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight />
                    <div className="relative z-10">
                      <span className="inline-flex w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                        <Icon size={20} />
                      </span>
                      <h3 className="mt-4 text-[16px] font-semibold text-ghost-text-primary leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Distributor strategy + economics */}
          <Reveal className="mt-20">
            <SectionLabel>Distributor Strategy</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.strategyTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
              {c.strategyBody}
            </p>
          </Reveal>

          {/* Partnership tracks */}
          <Reveal className="mt-20">
            <SectionLabel>Partnership Tracks</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.tracksTitle}
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {c.tracks.map((track, i) => {
              const Icon = TRACK_ICONS[i];
              return (
                <Reveal key={track.title} delay={(i % 2) * 80} className="h-full">
                  <article
                    onPointerMove={handleSpotlight}
                    className="group ghost-glass relative h-full overflow-hidden rounded-3xl border border-ghost-border-subtle px-6 py-7 sm:px-8 transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-ghost-text-primary/25 hover:shadow-[0_24px_60px_-28px_rgb(var(--ghost-text-primary)/0.5)]"
                  >
                    <Spotlight radius={460} />
                    <div className="relative z-10">
                      <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                        <Icon size={22} />
                      </span>
                      <h3 className="mt-4 text-[20px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.01em]">
                        {track.title}
                      </h3>
                      <p className="mt-2.5 text-[14px] leading-relaxed text-ghost-text-secondary">
                        {track.summary}
                      </p>
                      <ul className="mt-5 flex flex-col gap-2.5">
                        {track.points.map((point, pi) => (
                          <li
                            key={point}
                            className="flex items-start gap-2.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                            style={{ transitionDelay: `${pi * 45}ms` }}
                          >
                            <Check
                              size={15}
                              className="mt-0.5 flex-shrink-0 text-ghost-accent transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                            />
                            <span className="text-[13.5px] leading-relaxed text-ghost-text-secondary transition-colors duration-300 group-hover:text-ghost-text-primary">
                              {point}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>

          {/* Joining process */}
          <Reveal className="mt-20">
            <SectionLabel>Joining Process</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.stepsTitle}
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {c.steps.map((step, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <Reveal key={step.step} delay={(i % 4) * 60} className="h-full">
                  <div
                    onPointerMove={handleSpotlight}
                    className="group relative h-full overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-6 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                          <Icon size={20} />
                        </span>
                        <span className="font-mono text-[22px] font-semibold text-ghost-text-muted/60 tracking-[-0.02em] transition-[transform,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:text-ghost-text-muted">
                          {step.step}
                        </span>
                      </div>
                      <h3 className="mt-4 text-[15.5px] font-semibold text-ghost-text-primary leading-snug">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-ghost-text-secondary">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Partner journey — briefing through field certification. */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { src: "/brand/customer-briefing.jpg", alt: "Partner discovery briefing", badge: "Brief // Discovery", faceProtect: true },
              { src: "/brand/partner-handover.jpg", alt: "Field handover", badge: "Handover // Field", faceProtect: true },
              { src: "/brand/field-integration.jpg", alt: "On-site integration", badge: "Integration // Site" },
              { src: "/brand/certification.jpg", alt: "Partner certification", badge: "Certified // Partner" },
            ].map((img, i) => (
              <Reveal key={img.src} delay={(i % 4) * 60}>
                <IntelFigure
                  src={img.src}
                  alt={img.alt}
                  ratio="4/5"
                  badge={img.badge}
                  faceProtect={img.faceProtect}
                />
              </Reveal>
            ))}
          </div>

          {/* Ongoing support */}
          <Reveal className="mt-20">
            <SectionLabel>Ongoing Support</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.supportTitle}
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {c.support.map((item, i) => {
              const Icon = SUPPORT_ICONS[i];
              return (
                <Reveal key={item.title} delay={(i % 2) * 70} className="h-full">
                  <div
                    onPointerMove={handleSpotlight}
                    className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight />
                    <span className="relative z-10 inline-flex w-11 h-11 flex-shrink-0 rounded-xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                      <Icon size={20} />
                    </span>
                    <div className="relative z-10 min-w-0">
                      <h3 className="text-[15.5px] font-semibold text-ghost-text-primary leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={120} className="mt-4">
            <p className="text-[12px] leading-relaxed text-ghost-text-muted">
              {c.supportFootnote}
            </p>
          </Reveal>

          {/* Distributor portal */}
          <Reveal className="mt-20">
            <SectionLabel>Distributor Portal</SectionLabel>
          </Reveal>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <Reveal delay={60}>
              <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
                {c.portalTitle}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
                {c.portalBody}
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div
                onPointerMove={handleSpotlight}
                className="group relative overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-6 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_16px_44px_-26px_rgb(var(--ghost-text-primary)/0.4)]"
              >
                <Spotlight radius={420} />
                <ul className="relative z-10 flex flex-col gap-3">
                  {c.portalPoints.map((point, pi) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                      style={{ transitionDelay: `${pi * 35}ms` }}
                    >
                      <Check
                        size={15}
                        className="mt-0.5 flex-shrink-0 text-ghost-accent transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                      />
                      <span className="text-[13.5px] leading-relaxed text-ghost-text-secondary transition-colors duration-300 group-hover:text-ghost-text-primary">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* What makes Ghost different */}
          <Reveal className="mt-20">
            <SectionLabel>What Makes Ghost Different</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.diffTitle}
              <span className="block text-ghost-text-secondary">
                {c.diffTitleSub}
              </span>
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {c.differentiators.map((item, i) => {
              const Icon = DIFF_ICONS[i];
              return (
                <Reveal key={item.title} delay={(i % 2) * 70} className="h-full">
                  <div
                    onPointerMove={handleSpotlight}
                    className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight />
                    <span className="relative z-10 inline-flex w-11 h-11 flex-shrink-0 rounded-xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                      <Icon size={20} />
                    </span>
                    <div className="relative z-10 min-w-0">
                      <h3 className="text-[15.5px] font-semibold text-ghost-text-primary leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Pull quote */}
          <Reveal className="mt-12">
            <blockquote className="relative overflow-hidden ghost-glass rounded-3xl border border-ghost-border-subtle px-4 py-10 sm:px-10 sm:py-12 text-center">
              <p className="mx-auto max-w-2xl text-[clamp(1.125rem,4vw,1.5rem)] font-semibold text-ghost-text-primary leading-snug tracking-[-0.01em]">
                {c.quote}
              </p>
              <p className="mx-auto mt-5 max-w-xl text-[14px] leading-relaxed text-ghost-text-secondary">
                {c.quoteBody}
              </p>
            </blockquote>
          </Reveal>

          {/* Closing CTA */}
          <section
            onPointerMove={handleSpotlight}
            className="group relative overflow-hidden ghost-glass mt-20 rounded-3xl border border-ghost-border-subtle px-6 py-12 sm:py-14 transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ghost-text-primary/20 hover:shadow-[0_28px_72px_-40px_rgb(var(--ghost-text-primary)/0.45)]"
          >
            <Spotlight radius={560} />
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
                <Handshake size={22} />
              </span>
              <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
                {c.ctaTitle}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
                {c.ctaBody}
              </p>
              <div className="mt-7 flex justify-center">
                <button
                  onClick={onAccess}
                  className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-16px_rgb(var(--ghost-accent)/0.6)] active:translate-y-0 active:scale-[0.99] transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
                >
                  <span>{c.ctaButton}</span>
                  <ArrowUpRight
                    size={16}
                    className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="sticky bottom-0 z-20 bg-ghost-bg/90 backdrop-blur border-t border-ghost-border-subtle">
        {/* Brand-signature mono line — always English, always LTR. */}
        <div
          dir="ltr"
          className="max-w-5xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 font-mono text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.18em] uppercase text-ghost-text-muted"
        >
          <span className="truncate">
            Ghost — Sovereign Visual Intelligence Infrastructure
          </span>
          <span className="hidden sm:inline flex-shrink-0 text-ghost-text-secondary">
            Partners
          </span>
        </div>
      </footer>
    </div>
  );
}
