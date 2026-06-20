import { useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BellRing,
  BookOpenCheck,
  Brain,
  Camera,
  ClipboardCheck,
  Compass,
  FolderTree,
  GraduationCap,
  MessageSquare,
  Radar,
  Settings2,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import { TRAINING_COPY } from "../../site/copy/training";
import { Reveal } from "../capabilities/shared";
import IntelFigure from "../shared/IntelFigure";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface OperatorTrainingPageProps {
  onBack: () => void;
  onAccess: () => void;
  // Shared marketing-site navigation (drives the persistent sidebar).
  onNavigate: (page: SitePage) => void;
  // Opens the waitlist gate (LeadCapturePopup with TRAINING_SYLLABUS_DOC):
  // visitor leaves contact details → joins the next-cohort waitlist → the
  // full training booklet PDF downloads.
  onJoinWaitlist: () => void;
}

// Chapter-style kicker — mono uppercase label sitting directly above a
// .ghost-display heading (no rule line), matching the rebuilt brief pages.
// Brand-signature English chrome: forced LTR so it renders identically when
// the page itself flows RTL.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="ltr"
      className="mb-4 font-mono text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance"
    >
      {children}
    </div>
  );
}

// Full-bleed section wrapper matching the /capabilities rhythm: each section
// spans the column, carries its own vertical padding, and centers content in
// an inner max-w-6xl container. `tone="alt"` paints a secondary background
// band so consecutive "chapters" read as distinct stations.
function AmbientSection({
  id,
  tone = "default",
  className = "",
  children,
}: {
  id?: string;
  tone?: "default" | "alt";
  className?: string;
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

// Spine chapter header — each of the page's four stations opens with the
// program number it embodies (10 / 50 / 14 / 90), rendered huge beside the
// chapter title so the hero facts literally structure the page.
function StationHeader({
  label,
  value,
  unit,
  title,
  body,
}: {
  label: string;
  value: string;
  unit?: string;
  title: string;
  body: string;
}) {
  return (
    <>
      <Reveal>
        <SectionLabel>{label}</SectionLabel>
      </Reveal>
      <Reveal delay={70}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-10">
          <div className="ghost-display flex-shrink-0 leading-none text-[clamp(3.5rem,8vw,5.5rem)] text-ghost-text-primary">
            {value}
            {unit ? (
              <span className="text-[0.4em] text-ghost-text-muted"> {unit}</span>
            ) : null}
          </div>
          <div className="max-w-2xl sm:pt-3">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {title}
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {body}
            </p>
          </div>
        </div>
      </Reveal>
    </>
  );
}

// ── Cursor-tracking spotlight (shared hover idiom across the brief pages) ─────
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

// ── Structural data — all visitor-readable copy lives in TRAINING_COPY ────────
// Icons are zipped positionally with the bilingual syllabus / highlights.
const SYLLABUS_ICONS: LucideIcon[] = [
  Compass,
  BookOpenCheck,
  MessageSquare,
  Camera,
  FolderTree,
  BellRing,
  ClipboardCheck,
  Brain,
  Settings2,
  Award,
];

const HIGHLIGHT_ICONS: LucideIcon[] = [Target, Radar, ShieldCheck, GraduationCap];

export default function OperatorTrainingPage({
  onBack,
  onAccess,
  onNavigate,
  onJoinWaitlist,
}: OperatorTrainingPageProps) {
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c = TRAINING_COPY[locale];
  // "90 min" / "90 דק'" → giant number + small unit on the exam station header.
  const [examValue, examUnit] = c.facts[3].v.split(" ");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // The page scrolls inside the fixed wrapper (not the document), so default
  // hash navigation doesn't reliably scroll — compute the offset within the
  // wrapper and drive its scrollTo directly.
  const scrollToAnchor = (
    e: React.MouseEvent<HTMLAnchorElement>,
    anchor: string,
  ) => {
    const container = scrollRef.current;
    const el = document.getElementById(anchor);
    if (container && el) {
      e.preventDefault();
      const top =
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        40;
      container.scrollTo({ top, behavior: "smooth" });
    }
  };

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
        active="training"
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

      {/* ── Hero ── */}
      <header className="relative overflow-hidden">
        <div className="ghost-ambient ghost-ambient--page" aria-hidden="true">
          <div className="ghost-ambient__grid" />
          <div className="ghost-ambient__blob ghost-ambient__blob--1" />
          <div className="ghost-ambient__blob ghost-ambient__blob--2" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 text-center">
          <div
            dir="ltr"
            className="animate-splash-in mb-6 inline-flex max-w-full flex-wrap justify-center items-center gap-2 min-h-7 py-1 pl-2.5 pr-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/40"
            style={{ animationDelay: "60ms" }}
          >
            <span className="ghost-alert-dot" />
            <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.16em] sm:tracking-[0.22em] uppercase text-ghost-text-muted">
              Ghost Academy · Operator Certification Track
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
              onClick={onJoinWaitlist}
              className="group relative inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold overflow-hidden transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.22) 50%, transparent 70%)",
                }}
              />
              <span className="relative">{c.joinWaitlist}</span>
              <ArrowUpRight
                size={16}
                className="relative transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              />
            </button>
            <a
              href="#syllabus"
              onClick={(e) => scrollToAnchor(e, "syllabus")}
              className="ghost-glass group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full text-ghost-text-primary text-[15px] font-medium transition-[transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
            >
              <span>{c.viewSyllabus}</span>
              <ArrowRight
                size={16}
                className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0.5 rotate-90"
              />
            </a>
          </div>

          <p
            className="animate-splash-in mt-5 text-[13px] text-ghost-text-muted"
            style={{ animationDelay: "300ms" }}
          >
            {c.heroNote}
          </p>
        </div>

        {/* Program facts — the page's spine. Each card is a readable stage
            marker and an anchor into the matching chapter below. */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-6">
          <Reveal delay={80}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {c.facts.map((s, i) => (
                <a
                  key={s.anchor}
                  href={`#${s.anchor}`}
                  onClick={(e) => scrollToAnchor(e, s.anchor)}
                  className="group ghost-glass rounded-2xl border border-ghost-border-subtle px-3 py-5 sm:px-5 sm:py-6 text-center transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                >
                  <div
                    dir="ltr"
                    className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted"
                  >
                    Stage 0{i + 1}
                  </div>
                  <div className="mt-2 ghost-display text-[clamp(1.75rem,3vw,2.4rem)] text-ghost-text-primary">
                    {s.v}
                  </div>
                  <div className="mt-2 text-[14px] font-medium leading-snug text-ghost-text-primary">
                    {s.l}
                  </div>
                  <div className="mt-1 text-[12.5px] leading-snug text-ghost-text-secondary">
                    {s.sub}
                  </div>
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </header>

      <main className="relative" style={{ overflowX: "clip" }}>
        {/* ── Station 1 — 10 course parts (the syllabus) ── */}
        <AmbientSection id="syllabus" tone="alt" className="scroll-mt-10">
          <StationHeader
            label="Stage 01 // Ten Course Parts"
            value="10"
            title={c.syllabusTitle}
            body={c.syllabusBody}
          />

          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {c.syllabus.map((m, i) => {
              const Icon = SYLLABUS_ICONS[i];
              return (
                <Reveal key={m.num} delay={(i % 2) * 70} className="h-full">
                  <article
                    onPointerMove={handleSpotlight}
                    className="group relative overflow-hidden h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] tracking-[0.18em] text-ghost-text-muted">
                          {m.num}
                        </span>
                        <span className="flex-1 h-px bg-ghost-border-subtle/70" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-text-muted">
                          {m.lessonsLabel}
                        </span>
                      </div>
                      <div className="mt-4 flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-ghost-border-subtle bg-ghost-surface text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[16px] font-medium tracking-[-0.01em] text-ghost-text-primary leading-snug">
                            {m.title}
                          </h3>
                          <p className="mt-2 text-[13px] leading-relaxed text-ghost-text-secondary">
                            {m.summary}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-4 flex flex-col gap-1.5">
                        {m.outcomes.map((o) => (
                          <li
                            key={o}
                            className="flex items-start gap-2 text-[12px] leading-snug text-ghost-text-muted"
                          >
                            <span className="mt-[6px] h-1 w-1 flex-shrink-0 rounded-full bg-ghost-text-muted" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </AmbientSection>

        {/* ── Station 2 — 50 lessons, one per page ── */}
        <AmbientSection id="lessons" className="scroll-mt-10">
          <StationHeader
            label="Stage 02 // Fifty Lessons, One Per Page"
            value="50"
            title={c.lessonsTitle}
            body={c.lessonsBody}
          />
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {c.lessonsPoints.map((p, i) => (
              <Reveal key={p.title} delay={(i % 2) * 70} className="h-full">
                <div
                  onPointerMove={handleSpotlight}
                  className="group relative overflow-hidden h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                >
                  <Spotlight radius={280} />
                  <div className="relative z-10">
                    <h3 className="text-[15.5px] font-medium tracking-[-0.01em] text-ghost-text-primary leading-snug">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                      {p.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </AmbientSection>

        {/* ── Station 3 — 14 hands-on field drills ── */}
        <AmbientSection id="drills" tone="alt" className="scroll-mt-10">
          <StationHeader
            label="Stage 03 // Fourteen Field Drills"
            value="14"
            title={c.drillsTitle}
            body={c.drillsBody}
          />

          {/* Classroom brief → field cohort. */}
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            <Reveal>
              <IntelFigure
                src="/brand/meeting-room.jpg"
                alt="Operator classroom briefing"
                ratio="16/10"
                badge="Classroom // Brief"
                faceProtect
              />
            </Reveal>
            <Reveal delay={80}>
              <IntelFigure
                src="/brand/training-cohort.jpg"
                alt="Field training cohort"
                ratio="16/10"
                badge="Cohort // Field"
                faceProtect
              />
            </Reveal>
          </div>

          <div className="mt-8 grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
            {c.drills.map((d, i) => (
              <Reveal key={d.title} delay={(i % 2) * 60}>
                <div className="flex items-center gap-3 rounded-xl border border-ghost-border-subtle bg-ghost-surface/20 px-4 py-3 transition-[background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-surface/40 hover:border-ghost-text-primary/20">
                  <span
                    dir="ltr"
                    className="font-mono text-[11px] tracking-[0.18em] text-ghost-text-muted"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[13.5px] leading-snug text-ghost-text-primary">
                    {d.title}
                  </span>
                  <span
                    dir="ltr"
                    className="flex-shrink-0 font-mono text-[9px] tracking-[0.16em] uppercase text-ghost-text-muted"
                  >
                    Part {d.part}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </AmbientSection>

        {/* ── Station 4 — the 90-minute certification exam ── */}
        <AmbientSection id="exam" className="scroll-mt-10">
          <StationHeader
            label="Stage 04 // Practical Certification"
            value={examValue}
            unit={examUnit}
            title={c.examTitle}
            body={c.examBody}
          />
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {c.capstones.map((cap, i) => (
              <Reveal key={cap.title} delay={(i % 2) * 70} className="h-full">
                <div
                  onPointerMove={handleSpotlight}
                  className="group relative overflow-hidden h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                >
                  <Spotlight radius={280} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3">
                      <span
                        dir="ltr"
                        className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted"
                      >
                        Capstone {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 h-px bg-ghost-border-subtle/70" />
                      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ghost-text-muted">
                        {cap.meta}
                      </span>
                    </div>
                    <h3 className="mt-3 text-[15.5px] font-medium tracking-[-0.01em] text-ghost-text-primary leading-snug">
                      {cap.title}
                    </h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                      {cap.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={140}>
            <p className="mt-6 text-[13px] text-ghost-text-muted">
              {c.examFootnote}
            </p>
          </Reveal>
        </AmbientSection>

        {/* ── What a graduate can do ── */}
        <AmbientSection tone="alt">
          <Reveal>
            <SectionLabel>Outcomes // What A Graduate Walks Away With</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.outcomesTitle}
            </h2>
          </Reveal>
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {c.highlights.map((h, i) => {
              const Icon = HIGHLIGHT_ICONS[i];
              return (
                <Reveal key={h.title} delay={(i % 2) * 70} className="h-full">
                  <div
                    onPointerMove={handleSpotlight}
                    className="group relative overflow-hidden h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight radius={280} />
                    <div className="relative z-10 flex items-start gap-4">
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-ghost-border-subtle bg-ghost-surface text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                        <Icon size={19} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[15.5px] font-medium tracking-[-0.01em] text-ghost-text-primary leading-snug">
                          {h.title}
                        </h3>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                          {h.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </AmbientSection>

        {/* ── Final CTA — waitlist + booklet ── */}
        <AmbientSection>
          <Reveal>
            <section
              onPointerMove={handleSpotlight}
              className="group relative overflow-hidden ghost-glass rounded-3xl border border-ghost-border-subtle px-6 py-14 sm:py-16 transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ghost-text-primary/20 hover:shadow-[0_28px_72px_-40px_rgb(var(--ghost-text-primary)/0.45)]"
            >
              <Spotlight radius={560} />
              <div className="relative z-10 max-w-xl mx-auto text-center">
                <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary mb-6">
                  <GraduationCap size={22} />
                </span>
                <SectionLabel>Next Cohort · Limited Seats</SectionLabel>
                <h2 className="ghost-display text-[clamp(2rem,4.5vw,3.25rem)] text-ghost-text-primary">
                  {c.ctaTitle}
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-ghost-text-secondary">
                  {c.ctaBody}
                </p>
                <button
                  onClick={onJoinWaitlist}
                  className="group/cta mt-7 inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
                >
                  <span>{c.ctaButton}</span>
                  <ArrowUpRight
                    size={16}
                    className="transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover/cta:-translate-x-0.5"
                  />
                </button>
                <p className="mt-6 font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                  {c.ctaFootnote}
                </p>
              </div>
            </section>
          </Reveal>
        </AmbientSection>
      </main>

      {/* ── Classification footer — brand chrome, English in both locales ── */}
      <footer className="sticky bottom-0 z-20 bg-ghost-bg/90 backdrop-blur border-t border-ghost-border-subtle">
        <div
          dir="ltr"
          className="max-w-6xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 font-mono text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.18em] uppercase text-ghost-text-muted"
        >
          <span className="truncate">
            Ghost Academy — Operator Training Program · 2026
          </span>
          <span className="hidden sm:inline flex-shrink-0 text-ghost-text-secondary">
            Training
          </span>
        </div>
      </footer>
    </div>
  );
}
