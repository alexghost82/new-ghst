import { useState, useEffect, useRef, useCallback } from "react";
import { Eye, EyeOff, ArrowRight, ArrowLeft, FileDown } from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import { useAccessChord } from "../../hooks/useAccessChord";
import CRT from "./CRT";
import TerminalLoginModal from "./TerminalLoginModal";
import AdminEntryChoice from "./AdminEntryChoice";
import LeadCapturePopup, {
  type DownloadDoc,
  FIELD_GUIDE_DOC,
} from "./LeadCapturePopup";

// Displayed build version on the login screen. First tracked version — bump
// this string whenever a new build of the displayed app is cut.
const GHOST_BUILD_VERSION = "v0.2.4.8.22";

// Gated documents offered on the login screen. Each opens the lead-capture
// gate (full name + email or phone) and then downloads the PDF. Company is
// optional here — the only hard requirement is a name and a way to reach back.
const LOGIN_DOWNLOAD_DOCS: { id: string; label: string; sub: string; doc: DownloadDoc }[] = [
  {
    id: "field-guide",
    label: "What Ghost Can Do — Field Guide",
    sub: "Nine capabilities · one page each · PDF",
    doc: FIELD_GUIDE_DOC,
  },
  {
    id: "defense-brief",
    label: "Defense & National Security Brief",
    sub: "Operational capabilities brief · PDF",
    doc: {
      path: "/docs/Ghost_Defense_Intelligence_Brief.pdf",
      filename: "Ghost_Defense_Intelligence_Brief.pdf",
      kicker: "Confidential · Capabilities Brief",
      question: "What can Ghost do for my control room?",
      headline: "Your cameras already see everything.",
      headlineDim: "Now question them.",
      intro:
        "Ghost turns the feeds you already operate into a memory you question in plain language. Get the full brief:",
      points: [
        { title: "Agentless", desc: "Ingests your existing RTSP / HDMI streams — nothing installed on cameras." },
        { title: "Air-gap ready", desc: "Runs fully disconnected for sovereign, high-assurance sites." },
        { title: "History you can talk to", desc: "Every feed becomes searchable memory — ask, don't scrub." },
        { title: "Checks you define", desc: "Describe a watch in plain language; Ghost flags only the deviations." },
      ],
      requireCompany: false,
    },
  },
  {
    id: "architecture",
    label: "Enterprise Architecture Overview",
    sub: "Deployment, security & compliance · PDF",
    doc: {
      path: "/docs/Ghost_Enterprise_Architecture.pdf",
      filename: "Ghost_Enterprise_Architecture.pdf",
      kicker: "Confidential · Enterprise Architecture",
      question: "How does Ghost deploy in a secure enterprise?",
      headline: "Enterprise-grade by design.",
      headlineDim: "Deploy on your terms.",
      intro:
        "Architecture, deployment models, security and compliance — the technical overview. Get the document:",
      points: [
        { title: "Agentless integration", desc: "No software on cameras or NVR devices." },
        { title: "Flexible deployment", desc: "Local, air-gapped, hybrid-cloud, or SOC." },
        { title: "Zero Trust", desc: "Role-based access and monitored data flow." },
        { title: "Privacy by design", desc: "Minimal retention, configurable policies." },
      ],
      successTitle: "Your document is downloading",
      requireCompany: false,
    },
  },
];

// Scroll-into-view fade-up primitive (ghost-tactical-cards). On the login
// screen everything is above the fold, so it resolves to a one-shot entrance.
function Reveal({
  children,
  delay = 0,
  y = 12,
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
        for (const e of entries)
          if (e.isIntersecting) {
            setShown(true);
            obs.disconnect();
            break;
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

interface LoginModalProps {
  onSuccess: () => void;
  onShowDefense?: () => void;
  onShowSecurity?: () => void;
  onShowTeam?: () => void;
  onShowCapabilities?: () => void;
  onShowDrone?: () => void;
  onShowTalk?: () => void;
}

// Hidden admin gesture: hold g + h + s + t together for 8s on the login screen
// to open the admin-entry choice box (demo-admin operator, or passwordless
// direct entry into the /admin owner console).
const DEMO_HOLD_MS = 8000;
const ADMIN_CHORD_KEYS = ["g", "h", "s", "t"] as const;

// Tactical status readout rendered on the brand rail. Lime is reserved for a
// genuinely-live state — here, the encrypted channel that is actually up.
const STATUS_ROWS: { k: string; v: string; live?: boolean }[] = [
  { k: "Channel", v: "Encrypted", live: true },
  { k: "Console", v: "Standby" },
  { k: "Clearance", v: "Operator" },
];

export default function LoginModal({
  onSuccess,
  onShowDefense,
  onShowSecurity,
  onShowTeam,
  onShowCapabilities,
  onShowDrone,
  onShowTalk,
}: LoginModalProps) {
  const [nickname, setNickname] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [demoHolding, setDemoHolding] = useState(false);
  // Admin-entry choice box (g+h+s+t chord): demo admin or direct admin console.
  const [showAdminChoice, setShowAdminChoice] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DownloadDoc | null>(null);
  // Hidden "secure terminal" variant, unlocked by holding 1 + 4 + 8 for 4s.
  // `granting` plays the brief ACCESS GRANTED transition before the swap.
  const [terminalMode, setTerminalMode] = useState(false);
  const [granting, setGranting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const grantedRef = useRef(false);

  const { loginUser } = useUserStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The g+h+s+t chord is the ADMIN door. Held for DEMO_HOLD_MS it opens a
  // choice box: enter as a full-access demo admin, or jump straight into the
  // owner /admin console (passwordless secret bypass).
  const enterDemo = useCallback(() => {
    setDemoHolding(false);
    setError(null);
    setShowAdminChoice(true);
  }, []);

  // Detect a sustained g + h + s + t chord (all held together for DEMO_HOLD_MS).
  useEffect(() => {
    const pressed = new Set<string>();
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      setDemoHolding(false);
    };

    const allDown = () => ADMIN_CHORD_KEYS.every((k) => pressed.has(k));

    const maybeStart = () => {
      if (allDown() && timer === null) {
        setDemoHolding(true);
        timer = window.setTimeout(() => {
          timer = null;
          void enterDemo();
        }, DEMO_HOLD_MS);
      }
    };

    const isChordKey = (e: KeyboardEvent) =>
      (ADMIN_CHORD_KEYS as readonly string[]).includes(e.key.toLowerCase());

    const onKeyDown = (e: KeyboardEvent) => {
      if (isChordKey(e)) {
        pressed.add(e.key.toLowerCase());
        maybeStart();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isChordKey(e)) {
        pressed.delete(e.key.toLowerCase());
        clearTimer();
      }
    };
    const onBlur = () => {
      pressed.clear();
      clearTimer();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      clearTimer();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enterDemo]);

  // 1 + 4 + 8 held for 4s → play ACCESS GRANTED, then swap to the secure
  // terminal skin (same content + same login behaviour, different UI).
  const unlockTerminal = useCallback(() => {
    if (grantedRef.current) return;
    grantedRef.current = true;
    setGranting(true);
    window.setTimeout(() => {
      setTerminalMode(true);
      setGranting(false);
    }, 1200);
  }, []);

  const { phase: chordPhase, progress: chordProgress } = useAccessChord(
    unlockTerminal,
    !terminalMode && !granting,
  );

  const handleSubmit = async () => {
    if (!nickname.trim() || !apiKey.trim()) {
      setError("Nickname and API key are required");
      return;
    }
    setIsLoading(true);
    setError(null);
    const user = await loginUser(nickname.trim(), apiKey.trim());
    if (user) {
      onSuccess();
    } else {
      setError("Invalid nickname or key");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const navItems: { kicker: string; label: string; onClick: () => void }[] = [
    onShowCapabilities && {
      kicker: "Capabilities",
      label: "What Ghost Can Do",
      onClick: onShowCapabilities,
    },
    onShowDrone && {
      kicker: "LKM-Drone",
      label: "Drone Detection",
      onClick: onShowDrone,
    },
    onShowDefense && {
      kicker: "Overview",
      label: "Learn about Ghost",
      onClick: onShowDefense,
    },
    onShowSecurity && {
      kicker: "Security",
      label: "Information Security",
      onClick: onShowSecurity,
    },
    onShowTeam && {
      kicker: "Team",
      label: "The People Behind Ghost",
      onClick: onShowTeam,
    },
    {
      kicker: "Admin",
      label: "Admin Console",
      // The admin panel is a separate bundle served at /admin.
      onClick: () => window.location.assign("/admin"),
    },
  ].filter(Boolean) as {
    kicker: string;
    label: string;
    onClick: () => void;
  }[];

  const canSubmit = nickname.trim() !== "" && apiKey.trim() !== "";

  // ACCESS GRANTED handoff — brief phosphor flash before the terminal swap.
  if (granting) {
    return (
      <CRT>
        <div
          dir="ltr"
          className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center font-mono text-terminal-green"
        >
          <img
            src="/ghost-icon.png"
            alt="Ghost"
            className="h-16 w-16 rounded-md opacity-90"
            style={{ filter: "grayscale(1) brightness(1.2) contrast(1.1)" }}
          />
          <div
            className="glitch-in text-2xl uppercase tracking-[0.15em] text-glow sm:text-3xl sm:tracking-[0.3em] md:text-4xl"
            style={{ fontFamily: "'VT323', monospace" }}
          >
            Access Granted
          </div>
          <div className="animate-blink text-xs uppercase tracking-[0.35em] text-terminal-green-dim">
            Decrypting terminal...
          </div>
        </div>
      </CRT>
    );
  }

  // Secure-terminal variant: identical content + behaviour, CRT presentation.
  if (terminalMode) {
    return (
      <>
        <CRT>
          <TerminalLoginModal
            nickname={nickname}
            setNickname={setNickname}
            apiKey={apiKey}
            setApiKey={setApiKey}
            showKey={showKey}
            setShowKey={setShowKey}
            error={error}
            isLoading={isLoading}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            navItems={navItems}
            docs={LOGIN_DOWNLOAD_DOCS}
            onSelectDoc={setActiveDoc}
            onShowTalk={onShowTalk}
          />
        </CRT>
        {activeDoc && (
          <LeadCapturePopup doc={activeDoc} onClose={() => setActiveDoc(null)} />
        )}
      </>
    );
  }

  const chordHolding = chordPhase === "holding";
  const gestureHolding = chordHolding || demoHolding;

  return (
    <div
      className="ghost-force-dark fixed inset-0 bg-[#0a0a0a] overflow-y-auto overflow-x-clip"
      dir="ltr"
    >
      {/* Ambient tactical wash + engineering dot-grid — the only "color" */}
      <div className="ghost-ambient ghost-ambient--page" aria-hidden>
        <div className="ghost-ambient__grid" />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--1"
          style={{
            top: -180,
            left: "-10%",
            width: 520,
            height: 520,
            background:
              "radial-gradient(circle, rgb(96 116 132 / 0.85), transparent 70%)",
          }}
        />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--2"
          style={{
            top: "34%",
            left: "38%",
            width: 420,
            height: 420,
            background:
              "radial-gradient(circle, rgb(56 92 96 / 0.6), transparent 72%)",
          }}
        />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--3"
          style={{
            bottom: -140,
            right: "-10%",
            width: 500,
            height: 500,
            background:
              "radial-gradient(circle, rgb(104 116 78 / 0.78), transparent 72%)",
          }}
        />
      </div>

      {/* Back to the home page (Defense & National Security brief) */}
      {onShowDefense && (
        <button
          type="button"
          onClick={onShowDefense}
          className="group fixed left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] sm:left-5 sm:top-5 z-30 inline-flex items-center gap-2 overflow-hidden rounded-full border border-ghost-border-subtle bg-ghost-bg/60 py-1.5 pl-3 pr-3.5 text-[10px] font-medium uppercase tracking-[0.18em] sm:tracking-[0.24em] text-ghost-text-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur-md outline-none transition-all duration-300 ease-out hover:border-ghost-text-secondary hover:bg-ghost-surface/80 hover:text-ghost-text-primary hover:shadow-[0_0_0_1px_rgb(var(--ghost-text-primary)/0.08),0_8px_20px_-10px_rgb(0_0_0/0.7)] focus-visible:ring-2 focus-visible:ring-ghost-accent/40 active:scale-[0.97]"
        >
          {/* tactical scan-sweep on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          />
          <ArrowLeft
            size={13}
            className="relative transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
          />
          <span className="relative">Home</span>
        </button>
      )}

      {/* Split intel-brief layout: brand rail (lg+) | access column */}
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col lg:flex-row">
        {/* ── Brand rail — desktop only ── */}
        <div className="hidden lg:flex lg:w-[46%] shrink-0 flex-col justify-between border-r border-ghost-border-subtle/60 px-10 xl:px-14 pt-24 pb-10">
          <Reveal y={14}>
            {/* Bare Ghost mark — leads the brand rail */}
            <img
              src="/ghost-icon-evl.png"
              alt="Ghost"
              className="h-14 w-14 object-contain"
            />

            {/* Display heading — marketing scale, intel tone */}
            <h1 className="mt-8 text-[clamp(2.4rem,4.4vw,3.6rem)] font-normal leading-[1.04] tracking-[-0.03em] text-ghost-text-primary">
              Secure Access.
              <span className="block text-ghost-text-muted">
                Agents only beyond this point.
              </span>
            </h1>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ghost-text-secondary">
              Agent credentials required to enter the console.
            </p>

            {/* Tactical status readout */}
            <div className="mt-10 max-w-sm">
              {STATUS_ROWS.map(({ k, v, live }, i) => (
                <div
                  key={k}
                  className={`flex items-center justify-between gap-4 py-3 ${
                    i > 0 ? "border-t border-ghost-border-subtle/60" : ""
                  }`}
                >
                  <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-ghost-text-muted">
                    {k}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase text-ghost-text-secondary">
                    {live && (
                      <span className="h-1.5 w-1.5 rounded-full bg-ghost-success" />
                    )}
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Quiet nav into the public briefs + mono footer */}
          <Reveal delay={140} y={10}>
            {navItems.length > 0 && (
              <nav className="-mx-3 mb-6">
                {navItems.map(({ kicker, label, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="group flex w-full items-center gap-4 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-ghost-surface/40"
                  >
                    <span className="w-24 shrink-0 font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
                      {kicker}
                    </span>
                    <span className="flex-1 truncate text-[13px] text-ghost-text-secondary transition-colors duration-150 group-hover:text-ghost-text-primary">
                      {label}
                    </span>
                    <ArrowRight
                      size={13}
                      className="shrink-0 text-ghost-text-muted opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
                  </button>
                ))}
              </nav>
            )}
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ghost-text-muted">
              GHOST — Question your cameras in plain language
            </p>
          </Reveal>
        </div>

        {/* ── Access column ── */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 sm:px-8 pt-20 pb-14 lg:py-16">
          <div className="w-full max-w-sm">
            {/* Compact identity header — mobile only (rail carries it on lg) */}
            <Reveal className="lg:hidden" y={10}>
              <div className="mb-8 flex flex-col items-center text-center">
                <img
                  src="/ghost-icon-evl.png"
                  alt="Ghost"
                  className="mb-4 h-16 w-16 object-contain"
                />
                <h1 className="text-[20px] font-semibold tracking-tight text-ghost-text-primary">
                  Secure Access
                </h1>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ghost-text-muted">
                  Agent credentials required to enter the console
                </p>
              </div>
            </Reveal>

            {/* Sign-in panel — smoked tactical glass */}
            <Reveal delay={60} y={14}>
              <div className="ghost-glass rounded-2xl border border-ghost-border-subtle p-5 sm:p-6">
                {/* Mono eyebrow + hairline */}
                <div className="mb-5 flex items-center gap-3">
                  <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
                    Ghost // Access
                  </span>
                  <span className="flex-1 h-px bg-ghost-border-subtle" />
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
                      Agent ID
                    </span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Agent Access"
                      className="w-full h-11 bg-ghost-surface/60 border border-ghost-border-subtle rounded-xl px-4 text-[15px] text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
                      Access Key
                    </span>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ghost Key"
                        dir="ltr"
                        className="w-full h-11 bg-ghost-surface/60 border border-ghost-border-subtle rounded-xl px-4 pr-12 text-[15px] text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms] text-left"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ghost-text-muted hover:text-ghost-text-primary transition-colors duration-[100ms]"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  {error && (
                    <p className="text-sm text-ghost-error text-center">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || !canSubmit}
                    className="group flex w-full h-11 items-center justify-center gap-2 rounded-full bg-ghost-accent text-ghost-bg text-[15px] font-medium transition-colors duration-[100ms] hover:bg-ghost-accent-hover disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "..." : "Sign in"}
                    {!isLoading && (
                      <ArrowRight
                        size={16}
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    )}
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Briefs & documents — gated downloads under the panel */}
            <Reveal delay={140} y={12}>
              <div className="mt-8">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
                    Ghost // Briefs
                  </span>
                  <span className="flex-1 h-px bg-ghost-border-subtle" />
                  <span className="font-mono text-[11px] tabular-nums text-ghost-text-muted">
                    {LOGIN_DOWNLOAD_DOCS.length}
                  </span>
                </div>

                <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-1.5">
                  {LOGIN_DOWNLOAD_DOCS.map(({ id, label, sub, doc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveDoc(doc)}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-ghost-surface/60 focus:outline-none focus-visible:bg-ghost-surface/60"
                    >
                      <span className="shrink-0 grid place-items-center w-8 h-8 rounded-lg bg-ghost-surface border border-ghost-border-subtle text-ghost-text-muted transition-colors duration-150 group-hover:text-ghost-text-primary group-hover:border-ghost-text-secondary/40">
                        <FileDown size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-snug text-ghost-text-primary">
                          {label}
                        </span>
                        <span className="block truncate text-[11px] leading-relaxed text-ghost-text-muted">
                          {sub}
                        </span>
                      </span>
                      <ArrowRight
                        size={14}
                        className="shrink-0 text-ghost-text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ghost-text-primary"
                      />
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-ghost-text-muted">
                  Name + email or phone to download
                </p>
              </div>
            </Reveal>

            {/* Mobile: quiet nav into the public briefs */}
            {navItems.length > 0 && (
              <Reveal delay={200} y={10} className="lg:hidden">
                <nav className="mt-8 border-t border-ghost-border-subtle/60 pt-4">
                  {navItems.map(({ kicker, label, onClick }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={onClick}
                      className="group flex w-full items-center gap-4 rounded-xl px-1 py-2 text-left transition-colors duration-150"
                    >
                      <span className="w-24 shrink-0 font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
                        {kicker}
                      </span>
                      <span className="flex-1 truncate text-[13px] text-ghost-text-secondary transition-colors duration-150 group-hover:text-ghost-text-primary">
                        {label}
                      </span>
                      <ArrowRight
                        size={13}
                        className="shrink-0 text-ghost-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                      />
                    </button>
                  ))}
                </nav>
              </Reveal>
            )}

            {/* Build marker — quiet mono tag, first tracked version */}
            <Reveal delay={240} y={8}>
              <div className="mt-8 flex items-center justify-center gap-2 font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
                <span>Ghost // Build</span>
                <span className="h-px w-4 bg-ghost-border-subtle" />
                <span className="tabular-nums">{GHOST_BUILD_VERSION}</span>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* Hidden-gesture hold-progress indicator — a bottom rail that fills as
          the operator holds a chord, showing exactly how long to keep holding.
          Drives both the g+h+s+t admin chord and the 1+4+8 terminal chord.
          The text chip was intentionally removed; the process is unchanged. */}
      <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none">
        {/* Track */}
        <div
          className="relative h-[4px] w-full overflow-hidden bg-ghost-accent/10"
          style={{
            transition: "opacity 200ms ease-out",
            opacity: gestureHolding ? 1 : 0,
          }}
        >
          {/* Fill — width animates over the full hold duration so the operator
              sees, in real time, how much longer they must keep holding. */}
          <div
            className="h-full rounded-r-full bg-ghost-accent-hover"
            style={{
              width: chordHolding
                ? `${chordProgress * 100}%`
                : demoHolding
                  ? "100%"
                  : "0%",
              transition: chordHolding
                ? "width 80ms linear"
                : demoHolding
                  ? `width ${DEMO_HOLD_MS}ms linear`
                  : "width 160ms ease-out",
              boxShadow: gestureHolding
                ? "0 0 16px 2px rgb(var(--ghost-accent-hover) / 0.7)"
                : "none",
            }}
          >
            {/* Glowing leading edge that rides the fill front. */}
            <span
              aria-hidden
              className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-ghost-accent-hover"
              style={{
                opacity: gestureHolding ? 1 : 0,
                boxShadow: "0 0 10px 3px rgb(var(--ghost-accent-hover) / 0.85)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Lead-capture gate for the offered documents */}
      {activeDoc && (
        <LeadCapturePopup doc={activeDoc} onClose={() => setActiveDoc(null)} />
      )}

      {/* Admin entry (g+h+s+t): demo admin, or passwordless /admin console */}
      {showAdminChoice && (
        <AdminEntryChoice
          onClose={() => setShowAdminChoice(false)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
