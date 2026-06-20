import { forwardRef, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Award,
  Briefcase,
  Check,
  Clock,
  Code2,
  Compass,
  Cpu,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  Network,
  Paperclip,
  Send,
  Target,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../../api/client";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import { CAREERS_COPY, type CareersRoleCopy } from "../../site/copy/careers";
import IntelFigure from "../shared/IntelFigure";
import SiteSidebar, { type SitePage } from "./SiteSidebar";

interface CareersPageProps {
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

// ── Structural data — icons zipped positionally with the bilingual copy ──────
const CULTURE_ICONS: LucideIcon[] = [
  Cpu,
  Target,
  Compass,
  Clock,
  Award,
  GraduationCap,
];

const ROLE_ICONS: Record<string, LucideIcon> = {
  "software-engineer": Code2,
  "ghost-expert": Network,
};

// ── A single requirements / responsibilities column ───────────────────────────
function RoleList({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-mono text-[10px] tracking-[0.22em] uppercase text-ghost-text-muted mb-3">
        {heading}
      </h4>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <Check
              size={15}
              className="mt-0.5 flex-shrink-0 text-ghost-accent"
            />
            <span className="text-[13.5px] leading-relaxed text-ghost-text-secondary">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Open-role card ────────────────────────────────────────────────────────────
function RoleCard({
  role,
  index,
  onApply,
  labels,
}: {
  role: CareersRoleCopy;
  index: number;
  onApply: () => void;
  labels: {
    applyNow: string;
    responsibilities: string;
    requirements: string;
    niceToHave: string;
  };
}) {
  const Icon = ROLE_ICONS[role.id] ?? Briefcase;
  return (
    <Reveal delay={index * 80}>
      <article className="ghost-glass relative overflow-hidden rounded-3xl border border-ghost-border-subtle">
        {/* Header band */}
        <div className="flex flex-col gap-5 border-b border-ghost-border-subtle/70 px-4 py-6 sm:px-8 sm:py-7 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <span className="inline-flex w-12 h-12 flex-shrink-0 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary">
              <Icon size={22} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[clamp(1.125rem,4vw,1.375rem)] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
                {role.title}
              </h3>
              {/* Tactical mono tags — brand-signature English, kept LTR. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  dir="ltr"
                  className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-ghost-surface/60 ring-1 ring-ghost-border-subtle font-mono text-[10px] tracking-[0.14em] uppercase text-ghost-text-secondary"
                >
                  <Briefcase size={11} />
                  {role.team}
                </span>
                <span
                  dir="ltr"
                  className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-ghost-surface/60 ring-1 ring-ghost-border-subtle font-mono text-[10px] tracking-[0.14em] uppercase text-ghost-text-secondary"
                >
                  <MapPin size={11} />
                  {role.location}
                </span>
                <span
                  dir="ltr"
                  className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-ghost-surface/60 ring-1 ring-ghost-border-subtle font-mono text-[10px] tracking-[0.14em] uppercase text-ghost-text-secondary"
                >
                  <Clock size={11} />
                  {role.type}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onApply}
            className="group inline-flex w-full md:w-auto flex-shrink-0 items-center justify-center gap-1.5 h-10 px-5 rounded-full bg-ghost-accent text-ghost-bg text-[13.5px] font-semibold hover:bg-ghost-accent-hover active:scale-[0.99] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
          >
            <span>{labels.applyNow}</span>
            <ArrowUpRight
              size={15}
              className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
            />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-6 sm:px-8 sm:py-7">
          <p className="text-[14.5px] leading-relaxed text-ghost-text-secondary">
            {role.summary}
          </p>

          <div className="mt-7 grid gap-7 md:grid-cols-2">
            <RoleList
              heading={labels.responsibilities}
              items={role.responsibilities}
            />
            <RoleList heading={labels.requirements} items={role.requirements} />
          </div>

          <div className="mt-7 rounded-2xl border border-ghost-border-subtle/70 bg-ghost-surface/30 px-5 py-5">
            <RoleList heading={labels.niceToHave} items={role.niceToHave} />
          </div>
        </div>
      </article>
    </Reveal>
  );
}

// ── Application form ──────────────────────────────────────────────────────────
// Loose phone check — at least 7 digits once stripped of formatting.
const PHONE_DIGITS_RE = /\d/g;
const MAX_CV_MB = 10;
const ACCEPTED_CV =
  ".pdf,.doc,.docx,.rtf,.txt,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ApplicationForm = forwardRef<
  HTMLDivElement,
  { role: string; onRoleChange: (role: string) => void }
>(function ApplicationForm({ role, onRoleChange }, ref) {
  const locale = useSiteLocaleStore((s) => s.locale);
  const c = CAREERS_COPY[locale];
  const f = c.form;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameValid = name.trim().length > 0;
  const phoneValid = (phone.match(PHONE_DIGITS_RE)?.length ?? 0) >= 7;
  const cvValid = !!cv && cv.size <= MAX_CV_MB * 1024 * 1024;
  const valid = nameValid && phoneValid && cvValid;

  const ROLE_OPTIONS = [...c.roles.map((r) => r.title), f.generalApplication];

  function pickFile(file: File | null) {
    setError(null);
    if (!file) {
      setCv(null);
      return;
    }
    if (file.size > MAX_CV_MB * 1024 * 1024) {
      setError(f.cvTooBig(MAX_CV_MB));
      return;
    }
    setCv(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid || !cv) return;

    setSubmitting(true);
    const res = await api.submitApplication({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      role: role || undefined,
      message: message.trim() || undefined,
      cv,
    });
    setSubmitting(false);

    if (res.ok) {
      setDone(true);
    } else {
      setError(res.error?.message || f.genericError);
    }
  }

  const fieldClass =
    "h-11 w-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 text-[14px] text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted";

  return (
    <section
      ref={ref}
      className="relative overflow-hidden ghost-glass mt-20 scroll-mt-24 rounded-3xl border border-ghost-border-subtle px-4 py-10 sm:px-10 sm:py-14"
    >
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

      <div className="relative z-10 mx-auto max-w-xl">
        {done ? (
          /* ── Success state ── */
          <div className="text-center">
            <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-accent mb-5">
              <Check size={22} />
            </span>
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {f.successTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
              {f.successBody(name.trim())}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="inline-flex w-12 h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary mb-5">
                <Briefcase size={22} />
              </span>
              <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
                {f.formTitle}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
                {f.formBody}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
              {/* Role */}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                  {f.roleLabel}
                </span>
                <select
                  value={role}
                  onChange={(e) => onRoleChange(e.target.value)}
                  className={`${fieldClass} appearance-none cursor-pointer`}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                    {f.nameLabel} <span className="text-ghost-accent">*</span>
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={f.namePlaceholder}
                    autoComplete="name"
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                    {f.phoneLabel} <span className="text-ghost-accent">*</span>
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={f.phonePlaceholder}
                    type="tel"
                    autoComplete="tel"
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                  {f.emailLabel}
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={f.emailPlaceholder}
                  type="email"
                  autoComplete="email"
                  className={fieldClass}
                />
              </label>

              {/* CV upload */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                  {f.cvLabel} <span className="text-ghost-accent">*</span>
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_CV}
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                {cv ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 py-3">
                    <FileText
                      size={18}
                      className="flex-shrink-0 text-ghost-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ghost-text-primary">
                        {cv.name}
                      </span>
                      <span className="block text-[11.5px] text-ghost-text-muted">
                        {formatBytes(cv.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        pickFile(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      aria-label={f.removeFile}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ghost-text-muted transition-colors hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-ghost-border-subtle bg-ghost-surface/40 px-3 py-5 text-center text-ghost-text-secondary transition-colors hover:border-ghost-text-muted hover:bg-ghost-surface/60"
                  >
                    <Paperclip
                      size={17}
                      className="flex-shrink-0 text-ghost-text-muted transition-colors group-hover:text-ghost-text-primary"
                    />
                    <span className="text-[12.5px] sm:text-[13.5px]">
                      {f.attachCv(MAX_CV_MB)}
                    </span>
                  </button>
                )}
              </div>

              {/* Message */}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted">
                  {f.messageLabel}
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={f.messagePlaceholder}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 py-3 text-[14px] leading-relaxed text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted"
                />
              </label>

              {touched && !valid && (
                <p className="px-1 text-[12.5px] text-ghost-error">
                  {f.validation}
                </p>
              )}
              {error && (
                <p className="px-1 text-[12.5px] text-ghost-error">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group mt-2 inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-semibold transition-all duration-200 hover:bg-ghost-accent-hover active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ghost-accent/50 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{f.submitting}</span>
                  </>
                ) : (
                  <>
                    <span>{f.submit}</span>
                    <Send size={15} className="rtl:-scale-x-100" />
                  </>
                )}
              </button>

              <p className="mt-1 px-1 text-center text-[11.5px] leading-relaxed text-ghost-text-muted">
                {f.footnote}
              </p>
            </form>
          </>
        )}
      </div>
    </section>
  );
});

// ── Page shell ────────────────────────────────────────────────────────────────
export default function CareersPage({
  onBack,
  onAccess,
  onNavigate,
}: CareersPageProps) {
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Bilingual site: copy + direction follow the URL-derived site locale.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const c = CAREERS_COPY[locale];

  const [selectedRole, setSelectedRole] = useState<string>(c.roles[0].title);

  // Role titles are localized — when the visitor switches language, re-anchor
  // the select so its value always exists in the current options.
  useEffect(() => {
    setSelectedRole(CAREERS_COPY[locale].roles[0].title);
  }, [locale]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const applyForRole = (roleTitle: string) => {
    setSelectedRole(roleTitle);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        active="careers"
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
            <SectionLabel>Ghost // Careers</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h1 className="text-[clamp(1.5rem,5.5vw,2.5rem)] font-semibold text-ghost-text-primary leading-[1.08] tracking-[-0.03em]">
              {c.heroTitle}
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-ghost-text-secondary">
              {c.heroBody}
            </p>
          </Reveal>

          {/* Stats */}
          <Reveal delay={120} className="mt-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {c.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-3 py-3.5 sm:px-4 sm:py-4"
                >
                  <p className="text-[clamp(1rem,4vw,1.25rem)] font-semibold text-ghost-text-primary tracking-[-0.01em]">
                    {stat.value}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Operating floor — wide establishing band. */}
          <Reveal delay={60} className="mt-10">
            <IntelFigure
              src="/brand/office-wide.jpg"
              alt="Ghost engineering and operations floor"
              ratio="21/9"
              badge="Ghost // HQ"
            />
          </Reveal>

          {/* Culture */}
          <Reveal className="mt-20">
            <SectionLabel>Culture // Why Ghost</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.cultureTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
              {c.cultureBody}
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.culture.map((item, i) => {
              const Icon = CULTURE_ICONS[i];
              return (
                <Reveal key={item.title} delay={(i % 3) * 70}>
                  <div className="group h-full rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-6 transition-colors duration-300 hover:border-ghost-border-subtle hover:bg-ghost-surface/50">
                    <span className="inline-flex w-11 h-11 rounded-xl border border-ghost-border-subtle bg-ghost-surface items-center justify-center text-ghost-text-primary transition-transform duration-300 group-hover:scale-105">
                      <Icon size={20} />
                    </span>
                    <h3 className="mt-4 text-[16px] font-semibold text-ghost-text-primary leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                      {item.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Working rhythm — daily sync + planning wall. */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Reveal>
              <IntelFigure
                src="/brand/standup.jpg"
                alt="Morning operations sync"
                ratio="4/3"
                badge="Daily // Sync"
              />
            </Reveal>
            <Reveal delay={80}>
              <IntelFigure
                src="/brand/whiteboard.jpg"
                alt="Architecture planning session"
                ratio="4/3"
                badge="Planning // Wall"
              />
            </Reveal>
          </div>

          {/* Open roles */}
          <Reveal className="mt-20">
            <SectionLabel>Open Roles // Join the Team</SectionLabel>
          </Reveal>
          <Reveal delay={60} className="max-w-2xl">
            <h2 className="text-[22px] sm:text-[28px] font-semibold text-ghost-text-primary leading-tight tracking-[-0.02em]">
              {c.rolesTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ghost-text-secondary">
              {c.rolesBody(c.roles.length)}
            </p>
          </Reveal>

          <div className="mt-10 flex flex-col gap-6">
            {c.roles.map((role, i) => (
              <RoleCard
                key={role.id}
                role={role}
                index={i}
                onApply={() => applyForRole(role.title)}
                labels={{
                  applyNow: c.applyNow,
                  responsibilities: c.responsibilities,
                  requirements: c.requirements,
                  niceToHave: c.niceToHave,
                }}
              />
            ))}
          </div>

          {/* General-application nudge */}
          <Reveal className="mt-10">
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] leading-relaxed text-ghost-text-secondary">
                {c.nudgeBody}
              </p>
              <button
                onClick={() => applyForRole(c.form.generalApplication)}
                className="group inline-flex flex-shrink-0 items-center justify-center gap-1.5 h-10 px-5 rounded-full border border-ghost-border-subtle text-[13.5px] font-medium text-ghost-text-primary transition-colors duration-200 hover:bg-ghost-surface/60"
              >
                <span>{c.applyAnyway}</span>
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                />
              </button>
            </div>
          </Reveal>

          {/* The people you'd join — wide team band before the form. */}
          <Reveal className="mt-14">
            <IntelFigure
              src="/brand/team-gathering.jpg"
              alt="Ghost team"
              ratio="21/9"
              badge="The Team // Ghost"
              faceProtect
            />
          </Reveal>

          {/* Application form */}
          <ApplicationForm
            ref={formRef}
            role={selectedRole}
            onRoleChange={setSelectedRole}
          />
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
            Careers
          </span>
        </div>
      </footer>
    </div>
  );
}
