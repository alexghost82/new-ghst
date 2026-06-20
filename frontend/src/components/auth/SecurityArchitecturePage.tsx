import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Cpu,
  MonitorSmartphone,
  ShieldCheck,
  EyeOff,
  PlugZap,
  Brain,
  Network,
  Server,
  CloudOff,
  Cable,
  Cloud,
  Building2,
  Lock,
  ScrollText,
  KeyRound,
  Trash2,
  Download,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { api } from "../../api/client";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import {
  SECURITY_COPY,
  SECURITY_PRINCIPLES,
  SECURITY_DEPLOYMENTS,
  SECURITY_COMPLIANCE,
  SECURITY_PIPELINE,
} from "../../site/copy/security";
import { Reveal } from "../capabilities/shared";
import IntelFigure from "../shared/IntelFigure";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface SecurityArchitecturePageProps {
  onBack: () => void;
  onAccess: () => void;
  // Shared marketing-site navigation (drives the persistent sidebar).
  onNavigate: (page: SitePage) => void;
  // Hidden entry point to the internal download ledger. Triggered by
  // holding the "8" and "4" keys together for 2 seconds while on this page.
  onOpenDownloads?: () => void;
}

// How long both keys must be held together before the hidden ledger opens.
const SECRET_HOLD_MS = 2000;

const PDF_PATH = "/docs/Ghost_Enterprise_Architecture_wecL.pdf";
const PDF_FILENAME = "Ghost_Enterprise_Architecture_wecL.pdf";
const LEAD_KEY = "ghost_arch_lead_email";

// Chapter-style kicker — mono uppercase label sitting directly above a
// .ghost-display heading (no rule line), matching /defense and /capabilities.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 font-mono text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.24em] uppercase text-ghost-text-muted text-balance">
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

// ── Cursor-tracking spotlight — shared hover idiom across the brief ──────────
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

// Structural icon lists — zipped positionally with the bilingual copy arrays
// in src/site/copy/security.ts.
const PRINCIPLE_ICONS = [ShieldCheck, EyeOff, PlugZap, Brain, Network] as const;
const DEPLOYMENT_ICONS = [Server, CloudOff, Cable, Cloud, Building2] as const;
const COMPLIANCE_ICONS = [ShieldCheck, ScrollText, KeyRound, Trash2] as const;
// The connection chain, top → bottom of the funnel.
const PIPELINE_ICONS = [Camera, Cable, Cpu, MonitorSmartphone] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function triggerDownload() {
  const a = document.createElement("a");
  a.href = PDF_PATH;
  a.download = PDF_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function SecurityArchitecturePage({
  onBack,
  onAccess,
  onNavigate,
  onOpenDownloads,
}: SecurityArchitecturePageProps) {
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c = SECURITY_COPY[locale];
  const principles = SECURITY_PRINCIPLES[locale];
  const deployments = SECURITY_DEPLOYMENTS[locale];
  const compliance = SECURITY_COMPLIANCE[locale];
  const pipeline = SECURITY_PIPELINE[locale];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);

  // Returning visitors who already unlocked the document skip the gate.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LEAD_KEY);
      if (saved && EMAIL_RE.test(saved)) {
        setEmail(saved);
        setDone(true);
      }
    } catch {
      // localStorage may be unavailable (private mode) — gate stays active.
    }
  }, []);

  const valid = EMAIL_RE.test(email.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    try {
      window.localStorage.setItem(LEAD_KEY, email.trim());
    } catch {
      // best-effort persistence only
    }
    // Record the lead server-side (email + IP + geolocation + timestamp).
    // Fire-and-forget — a tracking failure must never block the download.
    void api.trackDownload({ email: email.trim(), file: PDF_FILENAME });
    setDone(true);
    triggerDownload();
  };

  // Hidden internal entry point: hold "8" and "4" together for 2 seconds
  // while on this page to open the download ledger. Either key releasing
  // (or focus leaving via typing in a field) cancels the countdown.
  useEffect(() => {
    if (!onOpenDownloads) return;

    const held = new Set<string>();
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const isTextEntry = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable === true
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "8" && e.key !== "4") return;
      // Don't hijack the secret combo while the visitor is typing an email.
      if (isTextEntry(e.target)) return;
      if (e.repeat) return;

      held.add(e.key);
      if (held.has("8") && held.has("4") && timer === null) {
        timer = window.setTimeout(() => {
          held.clear();
          timer = null;
          onOpenDownloads();
        }, SECRET_HOLD_MS);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "8" && e.key !== "4") return;
      held.delete(e.key);
      if (!(held.has("8") && held.has("4"))) clearTimer();
    };

    const onBlur = () => {
      held.clear();
      clearTimer();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      clearTimer();
    };
  }, [onOpenDownloads]);

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
        active="security"
        onNavigate={onNavigate}
        onScrollTop={() =>
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
        onBack={onBack}
        onAccess={onAccess}
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

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-20 text-center">
          <div
            dir="ltr"
            className="animate-splash-in mb-6 inline-flex max-w-full flex-wrap justify-center items-center gap-2 min-h-7 py-1 ps-2.5 pe-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/40"
            style={{ animationDelay: "60ms" }}
          >
            <span className="ghost-alert-dot" />
            <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.16em] sm:tracking-[0.22em] uppercase text-ghost-text-muted">
              Confidential · Enterprise Technical Overview
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
            <a
              href="#download"
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
              <Download size={16} className="relative" />
              <span className="relative">{c.getPdf}</span>
            </a>
            <a
              href="#pipeline"
              className="ghost-glass group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full text-ghost-text-primary text-[15px] font-medium transition-[transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
            >
              <span>{c.viewDataFlow}</span>
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
            {["Agentless", "Zero Trust", "Air-Gap Ready", "Encrypted E2E"].map(
              (t) => (
                <span
                  key={t}
                  dir="ltr"
                  className="group inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/30 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted transition-[transform,color,border-color,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:text-ghost-text-secondary hover:border-ghost-text-muted/40 hover:bg-ghost-surface/50"
                >
                  <ShieldCheck
                    size={11}
                    className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                  />
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
      </header>

      <main className="relative" style={{ overflowX: "clip" }}>
        {/* ── Executive overview ── */}
        <AmbientSection>
          <Reveal>
            <SectionLabel>Briefing // Executive Overview</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-3xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.overviewTitle}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.overviewP1}
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.overviewP2}
            </p>
          </Reveal>
        </AmbientSection>

        {/* ── How the connection works ── */}
        <AmbientSection id="pipeline" tone="alt" className="scroll-mt-10">
          <Reveal>
            <SectionLabel>Data Flow // How The Connection Works</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.pipelineTitle}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.pipelineBody}
            </p>
          </Reveal>

          {/* The pipeline — a vertical funnel on mobile, horizontal on desktop */}
          <Reveal delay={120} className="mt-10">
            <div className="ghost-glass rounded-3xl border border-ghost-border-subtle p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-2">
                {pipeline.map((step, i) => {
                  const Icon = PIPELINE_ICONS[i];
                  const last = i === pipeline.length - 1;
                  return (
                    <div
                      key={step.label}
                      className="flex flex-col lg:flex-row lg:items-stretch lg:flex-1 gap-4 lg:gap-2"
                    >
                      <div
                        onPointerMove={handleSpotlight}
                        className="group relative overflow-hidden flex-1 rounded-2xl border border-ghost-border-subtle bg-ghost-bg/40 px-5 py-5 flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3 transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-ghost-text-primary/25 hover:bg-ghost-bg/60"
                      >
                        <Spotlight />
                        <span className="relative z-10 w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface flex items-center justify-center text-ghost-text-primary flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110">
                          <Icon size={19} />
                        </span>
                        <div className="relative z-10">
                          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                            Stage {String(i + 1).padStart(2, "0")}
                          </p>
                          <p className="mt-1 text-[15px] font-medium text-ghost-text-primary">
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
                          <ArrowRight size={18} className="lg:hidden rotate-90" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </AmbientSection>

        {/* ── Enterprise design principles ── */}
        <AmbientSection>
          <Reveal>
            <SectionLabel>Doctrine // Enterprise Design Principles</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.principlesTitle}
            </h2>
          </Reveal>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {principles.map((p, i) => {
              const Icon = PRINCIPLE_ICONS[i];
              return (
                <Reveal key={p.title} delay={(i % 3) * 70} className="h-full">
                  <article
                    onPointerMove={handleSpotlight}
                    className="group relative h-full overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-6 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight />
                    <div className="relative z-10">
                      <span className="inline-flex w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                        <Icon size={20} />
                      </span>
                      <h3 className="mt-4 text-[16px] font-medium tracking-[-0.01em] text-ghost-text-primary leading-snug">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                        {p.body}
                      </p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </AmbientSection>

        {/* ── Deployment models ── */}
        <AmbientSection tone="alt">
          <Reveal>
            <SectionLabel>Deployment // Models &amp; Isolation</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.deploymentsTitle}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary text-pretty">
              {c.deploymentsBody}
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {deployments.map((d, i) => {
              const Icon = DEPLOYMENT_ICONS[i];
              return (
                <Reveal key={d.title} delay={(i % 5) * 55} className="h-full">
                  <div
                    onPointerMove={handleSpotlight}
                    className="group relative h-full overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-ghost-surface/50 hover:border-ghost-text-primary/25 hover:shadow-[0_18px_48px_-24px_rgb(var(--ghost-text-primary)/0.45)]"
                  >
                    <Spotlight />
                    <div className="relative z-10">
                      <span className="inline-flex w-10 h-10 rounded-xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:border-ghost-text-primary/30 group-hover:bg-ghost-surface-hover">
                        <Icon size={17} />
                      </span>
                      <h3 className="mt-4 text-[14.5px] font-medium tracking-[-0.01em] text-ghost-text-primary leading-snug">
                        {d.title}
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ghost-text-secondary">
                        {d.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Where the model physically runs — on-prem to air-gap. */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { src: "/brand/server-rack.jpg", alt: "On-premise server rack", badge: "Rack // On-Prem" },
              { src: "/brand/edge-box.jpg", alt: "Edge inference node", badge: "Edge // Node" },
              { src: "/brand/comms-cabinet.jpg", alt: "Communications cabinet", badge: "Comms // Cabinet" },
              { src: "/brand/airgap-room.jpg", alt: "Air-gapped deployment room", badge: "Air-Gap // Vault" },
            ].map((img, i) => (
              <Reveal key={img.src} delay={(i % 4) * 60}>
                <IntelFigure src={img.src} alt={img.alt} ratio="4/5" badge={img.badge} />
              </Reveal>
            ))}
          </div>
        </AmbientSection>

        {/* ── Security & compliance framework ── */}
        <AmbientSection>
          <Reveal>
            <SectionLabel>Compliance // Security Framework</SectionLabel>
          </Reveal>
          <Reveal delay={70} className="max-w-2xl">
            <h2 className="ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary text-balance">
              {c.complianceTitle}
            </h2>
          </Reveal>
          <div className="mt-8 grid sm:grid-cols-2 gap-x-4 sm:gap-x-6 lg:gap-x-10 gap-y-1">
            {compliance.map((item, i) => {
              const Icon = COMPLIANCE_ICONS[i];
              return (
                <Reveal key={item.title} delay={(i % 2) * 70}>
                  <div className="group flex gap-4 py-5 border-b border-ghost-border-subtle">
                    <span className="mt-0.5 w-10 h-10 rounded-xl border border-ghost-border-subtle bg-ghost-surface/60 flex items-center justify-center text-ghost-text-primary flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-105">
                      <Icon size={17} />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-medium tracking-[-0.01em] text-ghost-text-primary">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-ghost-text-secondary">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={140}>
            <p className="mt-8 text-[14px] leading-relaxed text-ghost-text-muted max-w-3xl">
              {c.complianceFootnote}
            </p>
          </Reveal>
        </AmbientSection>

        {/* ── Download gate ── */}
        <AmbientSection tone="alt" id="download" className="scroll-mt-10">
          <Reveal>
            <section
              onPointerMove={handleSpotlight}
              className="group relative overflow-hidden ghost-glass rounded-3xl border border-ghost-border-subtle px-6 py-14 sm:py-16 transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ghost-text-primary/20 hover:shadow-[0_28px_72px_-40px_rgb(var(--ghost-text-primary)/0.45)]"
            >
              <Spotlight radius={560} />
              <div className="relative z-10 max-w-xl mx-auto text-center">
                <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary mb-6">
                  <FileText size={22} />
                </span>
                <h2 className="ghost-display text-[clamp(2rem,4.5vw,3.25rem)] text-ghost-text-primary">
                  {c.downloadTitle}
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-ghost-text-secondary">
                  {c.downloadBody}
                </p>

                {done ? (
                  <div className="mt-8 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/50 px-6 py-6">
                    <div className="flex items-center justify-center gap-2.5 text-ghost-text-primary">
                      <CheckCircle2 size={20} />
                      <span className="text-[15px] font-semibold">
                        {c.downloadReadyTitle}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-ghost-text-secondary">
                      {c.downloadReadyBody}
                    </p>
                    <button
                      onClick={triggerDownload}
                      className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-ghost-accent text-ghost-bg text-[14px] font-semibold hover:bg-ghost-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    >
                      <Download size={16} />
                      <span>{c.downloadAgain}</span>
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="mt-8 flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto"
                    noValidate
                  >
                    <div className="flex-1 text-start">
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder={c.emailPlaceholder}
                        aria-label={c.emailAria}
                        aria-invalid={touched && !valid}
                        className="w-full h-12 px-4 rounded-full border border-ghost-border-subtle bg-ghost-bg/70 text-[15px] text-ghost-text-primary placeholder:text-ghost-text-muted outline-none transition-[border-color,box-shadow] duration-200 focus:border-ghost-text-primary/40 focus:shadow-[inset_0_0_0_1px_rgb(var(--ghost-text-primary)/0.10)]"
                      />
                      {touched && !valid && (
                        <p className="mt-1.5 ms-4 font-mono text-[11px] tracking-[0.04em] text-ghost-text-muted">
                          {c.emailInvalid}
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold whitespace-nowrap hover:bg-ghost-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ghost-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ghost-bg"
                    >
                      <Download size={16} />
                      <span>{c.downloadCta}</span>
                    </button>
                  </form>
                )}

                <p
                  dir="ltr"
                  className="mt-6 flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted"
                >
                  <Lock size={11} />
                  Confidential · Shared under enterprise NDA terms
                </p>
              </div>
            </section>
          </Reveal>
        </AmbientSection>
      </main>

      {/* ── Classification footer ── */}
      <footer className="sticky bottom-0 z-20 bg-ghost-bg/90 backdrop-blur border-t border-ghost-border-subtle">
        <div
          dir="ltr"
          className="max-w-6xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 font-mono text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.18em] uppercase text-ghost-text-muted"
        >
          <span className="truncate">
            Ghost — Enterprise Visual Intelligence Infrastructure
          </span>
          <span className="hidden sm:inline flex-shrink-0 text-ghost-text-secondary">
            Security
          </span>
        </div>
      </footer>
    </div>
  );
}
