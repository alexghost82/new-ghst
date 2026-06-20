import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, MessageSquare, BellRing, ShieldCheck } from "lucide-react";
import SiteSidebar, { type SitePage } from "./SiteSidebar";
import TrialLeadGate from "./TrialLeadGate";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import { TALK_COPY, TALK_STEPS } from "../../site/copy/talk";

interface TalkToGhostPageProps {
  onBack: () => void;
  onAccess: () => void;
  onNavigate: (page: SitePage) => void;
  // Begin the live 8-minute trial: opens a brand-new account named after the
  // visitor and hands off to the guided first-setup wizard in the app.
  onStartTrial: (lead: { name: string; email: string; phone: string }) => void;
  starting?: boolean;
  error?: string | null;
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

// Mono eyebrow + hairline section label.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 font-mono text-[10px] sm:text-[11px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance">
        {children}
      </span>
      <span className="h-px flex-1 bg-ghost-border-subtle/70" />
    </div>
  );
}

// Step icons, zipped positionally with the bilingual TALK_STEPS copy.
const STEP_ICONS = [Camera, MessageSquare, BellRing] as const;

// Card that lifts/brightens on hover and tracks a faint cursor spotlight — no
// corner brackets (banned on card frames by the tactical-cards system).
function StepCard({
  icon: Icon,
  step,
  title,
  body,
  example,
}: {
  icon: typeof Camera;
  step: string;
  title: string;
  body: string;
  example: string;
}) {
  const ref = useRef<HTMLElement>(null);

  const handlePointer = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <article
      ref={ref}
      onPointerMove={handlePointer}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6 transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-ghost-text-muted/40 hover:bg-ghost-surface/50"
    >
      {/* Cursor spotlight — the only motion at rest is the ambient wash. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(220px circle at var(--mx, 50%) var(--my, 0%), rgb(255 255 255 / 0.06), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ghost-border-subtle bg-ghost-bg text-ghost-accent">
          <Icon size={18} />
        </span>
        <span className="font-mono text-[11px] tracking-[0.2em] text-ghost-text-muted">
          {step}
        </span>
      </div>

      <h3 className="relative z-10 mt-5 text-[16px] font-semibold leading-snug text-ghost-text-primary">
        {title}
      </h3>
      <p className="relative z-10 mt-2 text-[13.5px] leading-relaxed text-ghost-text-secondary">
        {body}
      </p>
      <p className="relative z-10 mt-auto pt-4 font-mono text-[10.5px] sm:text-[11.5px] leading-relaxed text-ghost-text-muted">
        <span className="block rounded-lg border border-ghost-border-subtle/70 bg-ghost-bg/60 px-3 py-2.5 break-words">
          {example}
        </span>
      </p>
    </article>
  );
}

export default function TalkToGhostPage({
  onBack,
  onAccess,
  onNavigate,
  onStartTrial,
  starting = false,
  error,
}: TalkToGhostPageProps) {
  // The trial is gated behind a lead form — the demo cannot start until the
  // visitor leaves a full name, email and phone. Both CTAs open the gate; the
  // session only starts on the gate's onComplete.
  const [showGate, setShowGate] = useState(false);
  const openGate = () => setShowGate(true);

  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c = TALK_COPY[locale];
  const steps = TALK_STEPS[locale];

  // When the side navigation is collapsed, drop the sidebar offset so the page
  // content (the centered `max-w-5xl` main) sits in the middle of the screen —
  // matching every other marketing page with a sidebar.
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);

  // Scroll the page shell to top on mount (matches the other brief pages).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  return (
    <div
      ref={scrollRef}
      className={`fixed inset-0 overflow-y-auto overflow-x-clip bg-ghost-bg cursor-default ${
        siteNavCollapsed ? "" : "lg:ps-[260px]"
      }`}
      dir={dir}
    >
      <SiteSidebar
        active="talk"
        onNavigate={onNavigate}
        onBack={onBack}
        onAccess={onAccess}
        accessLabel={c.accessLabel}
        locale={locale}
        dir={dir}
      />

      <main className="relative mx-auto w-full max-w-5xl px-4 sm:px-6 pb-28 pt-12 sm:pt-16 lg:pt-24">
        {/* Full-page ambient wash — the only "color" on the surface. */}
        <div className="ghost-ambient ghost-ambient--page" aria-hidden>
          <div
            className="ghost-ambient__blob ghost-ambient__blob--1"
            style={{
              top: -160,
              left: "-8%",
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
              right: "-8%",
              width: 480,
              height: 480,
              background:
                "radial-gradient(circle, rgb(104 116 78 / 0.82), transparent 72%)",
            }}
          />
        </div>

        <div className="relative z-10">
          {/* ── Hero ─────────────────────────────────────────────── */}
          <Reveal>
            <section className="relative">
              <span
                dir="ltr"
                className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-ghost-border-subtle bg-ghost-surface/50 px-3 py-1 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.22em] text-ghost-text-secondary"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ghost-accent animate-pulse" />
                Live · 8-minute trial · your camera
              </span>

              <h1 className="mt-6 text-[clamp(1.75rem,6vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-ghost-text-primary">
                {c.heroTitle}
                <span className="block text-ghost-text-muted">
                  {c.heroTitleSub}
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ghost-text-secondary">
                {c.heroBody}
              </p>

              <div className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <button
                  onClick={openGate}
                  disabled={starting}
                  className="group inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-ghost-accent px-7 text-[15px] font-semibold text-ghost-bg outline-none transition-all duration-200 hover:bg-ghost-accent-hover active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
                >
                  {starting ? c.starting : c.startTrial}
                  {!starting && (
                    <ArrowRight
                      size={17}
                      className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                    />
                  )}
                </button>
                <button
                  onClick={onAccess}
                  className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-ghost-border-subtle px-6 text-[15px] font-medium text-ghost-text-primary outline-none transition-colors duration-200 hover:bg-ghost-surface/50 focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
                >
                  {c.requestFullAccess}
                </button>
              </div>

              {error && <p className="mt-4 text-sm text-ghost-error">{error}</p>}

              <p className="mt-4 flex items-center gap-2 text-[12.5px] text-ghost-text-muted">
                <ShieldCheck size={14} className="text-ghost-text-secondary" />
                {c.privacyNote}
              </p>
            </section>
          </Reveal>

          {/* ── Three guided steps ───────────────────────────────── */}
          <section className="mt-20">
            <Reveal>
              <SectionLabel>Ghost // How The Trial Works</SectionLabel>
            </Reveal>

            <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((s, index) => (
                <Reveal key={s.step} delay={(index % 3) * 70}>
                  <StepCard icon={STEP_ICONS[index]} {...s} />
                </Reveal>
              ))}
            </div>
          </section>

          {/* ── Closing CTA ──────────────────────────────────────── */}
          <Reveal className="mt-20">
            <section className="relative overflow-hidden rounded-3xl border border-ghost-border-subtle ghost-glass p-8 text-center lg:p-12">
              <div className="ghost-ambient" aria-hidden>
                <div
                  className="ghost-ambient__blob ghost-ambient__blob--2"
                  style={{
                    bottom: -120,
                    left: "20%",
                    width: 420,
                    height: 420,
                    background:
                      "radial-gradient(circle, rgb(56 92 96 / 0.85), transparent 72%)",
                  }}
                />
              </div>

              <div className="relative z-10">
                <h2 className="text-[clamp(1.25rem,3.5vw,1.875rem)] font-semibold tracking-tight text-ghost-text-primary">
                  {c.ctaTitle}
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ghost-text-secondary">
                  {c.ctaBody}
                </p>
                <button
                  onClick={openGate}
                  disabled={starting}
                  className="group mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ghost-accent px-8 text-[15px] font-semibold text-ghost-bg outline-none transition-all duration-200 hover:bg-ghost-accent-hover active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
                >
                  {starting ? c.starting : c.startTrial}
                  {!starting && (
                    <ArrowRight
                      size={17}
                      className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                    />
                  )}
                </button>
              </div>
            </section>
          </Reveal>
        </div>
      </main>

      {showGate && (
        <TrialLeadGate
          onClose={() => setShowGate(false)}
          onComplete={onStartTrial}
          busy={starting}
        />
      )}
    </div>
  );
}
