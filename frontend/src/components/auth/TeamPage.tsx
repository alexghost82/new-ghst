import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Users, ShieldOff } from "lucide-react";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import {
  TEAM_COPY,
  type TeamMemberCopy,
  type TeamMemberId,
} from "../../site/copy/team";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface TeamPageProps {
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="min-w-0 font-mono text-[10px] sm:text-[11px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance">
        {children}
      </span>
      <span className="flex-1 h-px bg-ghost-border-subtle" />
    </div>
  );
}

// ── Leadership roster — structural data only ──────────────────────────────────
// Names and tactical tag chips are brand-signature English in both locales;
// the localized role + story live in src/site/copy/team.ts, keyed by id.
interface Member {
  id: TeamMemberId;
  name: string;
  tag: string;
  image: string;
}

const TEAM: Member[] = [
  {
    id: "omer",
    name: "Omer A.",
    tag: "CEO",
    image: "/team/team-omer.png",
  },
  {
    id: "yevgeny",
    name: "Yevgeny V.",
    tag: "Chairman",
    image: "/team/team-yevgeny.png",
  },
  {
    id: "ido",
    name: "Ido K.",
    tag: "Defense",
    image: "/team/team-ido.png",
  },
  {
    id: "yehonatan",
    name: "Yehonatan K.",
    tag: "Retail · Energy",
    image: "/team/team-yehonatan.png",
  },
  {
    id: "noa",
    name: "Noa V.",
    tag: "Business Dev",
    image: "/team/team-noa.png",
  },
  {
    id: "shai",
    name: "Shai P.",
    tag: "Co-CEO",
    image: "/team/team-shai.png",
  },
];

// ── Member card ───────────────────────────────────────────────────────────────
// A full-bleed "viewfinder" card: the portrait fills the frame, identity stays
// pixelated, and the whole thing reacts to the pointer — 3D tilt, a cursor-
// tracking spotlight, a single scan-beam sweep, and a dossier that slides up.
function MemberCard({
  member,
  copy,
  index,
}: {
  member: Member;
  copy: TeamMemberCopy;
  index: number;
}) {
  const cardRef = useRef<HTMLElement>(null);
  // Touch devices have no hover, so the dossier story would never appear.
  // Tap toggles it open; desktop keeps the hover reveal untouched.
  const [expanded, setExpanded] = useState(false);

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0 → 1
    const py = (e.clientY - r.top) / r.height; // 0 → 1
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - py) * 9}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * 11}deg`);
  }

  function handlePointerLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <Reveal delay={(index % 3) * 70} className="h-full" style={{ perspective: "1100px" }}>
      <article
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="ghost-team-card group relative h-full min-h-[20rem] sm:min-h-[24rem] lg:min-h-[26rem] rounded-[1.4rem] overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={
          {
            "--mx": "50%",
            "--my": "30%",
            "--rx": "0deg",
            "--ry": "0deg",
          } as React.CSSProperties
        }
      >
        {/* ── Portrait stack ─────────────────────────────────────────── */}
        <div className="absolute inset-0" dir="ltr">
          {/* Base portrait — grayscale at rest, colorizes on hover. */}
          <img
            src={member.image}
            alt={`${member.name} — ${copy.role}`}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover object-top transition-[transform,filter] duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06] [filter:grayscale(1)_contrast(1.05)] group-hover:[filter:grayscale(0)_contrast(1)]"
          />
          {/* Face mask — a permanently desaturated copy clipped to the
              pixelated face region, so the obscured pixels never colorize. */}
          <img
            src={member.image}
            alt=""
            aria-hidden
            loading="lazy"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06] [filter:grayscale(1)]"
            style={{
              WebkitMaskImage:
                "radial-gradient(42% 30% at 50% 26%, #000 58%, transparent 100%)",
              maskImage:
                "radial-gradient(42% 30% at 50% 26%, #000 58%, transparent 100%)",
            }}
          />
        </div>

        {/* Readability + tactical tint gradient. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgb(0 0 0 / 0.32) 0%, transparent 30%, transparent 42%, rgb(8 12 14 / 0.72) 78%, rgb(6 9 11 / 0.94) 100%)",
          }}
        />

        {/* Cursor-tracking spotlight — appears only on hover. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100 mix-blend-soft-light"
          style={{
            background:
              "radial-gradient(34% 34% at var(--mx) var(--my), rgb(214 234 240 / 0.9), transparent 70%)",
          }}
        />

        {/* Scan beam — sweeps once on hover. */}
        <div className="ghost-team-scan absolute inset-0 pointer-events-none" aria-hidden />

        {/* Viewfinder corner brackets — draw in on hover. */}
        <div className="ghost-team-frame absolute inset-3 pointer-events-none" aria-hidden>
          <span className="gtc gtc-tl" />
          <span className="gtc gtc-tr" />
          <span className="gtc gtc-bl" />
          <span className="gtc gtc-br" />
        </div>

        {/* Top chips — tactical mono, brand-signature English, always LTR. */}
        <div
          dir="ltr"
          className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 z-10"
        >
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/10 font-mono text-[8px] sm:text-[9px] tracking-[0.14em] sm:tracking-[0.16em] uppercase text-white/90">
            <ShieldOff size={10} className="flex-shrink-0" />
            Identity protected
          </span>
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/15 font-mono text-[9px] tracking-[0.18em] uppercase text-white/85">
            {member.tag}
          </span>
        </div>

        {/* ── Dossier — name/role always; story slides up on hover. ──── */}
        <div className="absolute inset-x-0 bottom-0 p-5 z-10">
          <div className="flex items-center gap-1.5 mb-2 opacity-80">
            <span className="ghost-team-pulse w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span
              dir="ltr"
              className="font-mono text-[9px] tracking-[0.22em] uppercase text-white/70"
            >
              Signal · Live
            </span>
          </div>
          <h3 className="text-[20px] font-semibold text-white leading-tight tracking-[-0.01em]">
            {/* Inline LTR isolate — keeps the trailing initial dot ("Omer A.")
                at the end of the English name under RTL bidi, while block
                alignment still follows the page direction. */}
            <span dir="ltr">{member.name}</span>
          </h3>
          <p className="mt-0.5 text-[12.5px] font-medium text-white/75">
            {copy.role}
          </p>

          {/* Story reveal — collapsed at rest. Opens on hover (desktop) or on
              tap (touch, where `expanded` is toggled by the card click). */}
          <div
            className={`grid opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              expanded ? "grid-rows-[1fr] !opacity-100" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-3 pt-3 border-t border-white/15">
                <p className="text-[13px] leading-relaxed text-white/85">
                  {copy.story}
                </p>
              </div>
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function TeamPage({
  onBack,
  onAccess,
  onNavigate,
}: TeamPageProps) {
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c = TEAM_COPY[locale];
  const scrollRef = useRef<HTMLDivElement>(null);
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
        active="team"
        onNavigate={onNavigate}
        onScrollTop={() =>
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
        onBack={onBack}
        onAccess={onAccess}
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
              top: 320,
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
            <SectionLabel>Ghost // Leadership</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h1 className="text-[clamp(1.5rem,5.5vw,2.5rem)] font-semibold text-ghost-text-primary leading-[1.08] tracking-[-0.03em]">
              {c.heroTitle}
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary">
              {c.heroBody}
            </p>
          </Reveal>

          <Reveal delay={120} className="mt-6">
            <div className="flex w-full max-w-2xl items-start gap-2.5 rounded-xl border border-ghost-border-subtle bg-ghost-surface/40 px-4 py-2.5">
              <ShieldOff size={15} className="mt-0.5 flex-shrink-0 text-ghost-text-secondary" />
              <p className="text-[12.5px] leading-relaxed text-ghost-text-secondary">
                {c.privacyNote}
              </p>
            </div>
          </Reveal>

          {/* Roster */}
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEAM.map((m, i) => (
              <MemberCard key={m.id} member={m} copy={c.members[m.id]} index={i} />
            ))}
          </div>

          {/* Group photo */}
          <Reveal className="mt-16">
            <SectionLabel>The Team // Together</SectionLabel>
          </Reveal>
          <Reveal delay={60}>
            <figure className="rounded-3xl border border-ghost-border-subtle bg-ghost-surface/20 overflow-hidden">
              <div
                className="relative w-full overflow-hidden bg-ghost-bg"
                style={{ aspectRatio: "3 / 2" }}
                dir="ltr"
              >
              <img
                src="/team/team-group.png"
                alt={c.groupAlt}
                loading="lazy"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover transition-[filter] duration-500 [filter:grayscale(1)] hover:[filter:grayscale(0)]"
              />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-black/45 backdrop-blur-sm font-mono text-[9px] tracking-[0.16em] uppercase text-white/90">
                  <ShieldOff size={10} />
                  Identities protected
                </span>
              </div>
              <figcaption className="px-5 py-4 flex items-center gap-2.5">
                <Users size={15} className="text-ghost-text-secondary flex-shrink-0" />
                <p className="text-[13px] text-ghost-text-secondary">
                  {c.groupCaption}
                </p>
              </figcaption>
            </figure>
          </Reveal>

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
                <Users size={22} />
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
                  className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold hover:bg-ghost-accent-hover active:scale-[0.99] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
                >
                  <span>{c.ctaButton}</span>
                  <ArrowUpRight size={16} className="rtl:-scale-x-100" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="sticky bottom-0 z-20 bg-ghost-bg/90 backdrop-blur border-t border-ghost-border-subtle">
        <div
          dir="ltr"
          className="max-w-5xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 font-mono text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.18em] uppercase text-ghost-text-muted"
        >
          <span className="truncate">
            Ghost — Sovereign Visual Intelligence Infrastructure
          </span>
          <span className="hidden sm:inline flex-shrink-0 text-ghost-text-secondary">
            Team
          </span>
        </div>
      </footer>
    </div>
  );
}
