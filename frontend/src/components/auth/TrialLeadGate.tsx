import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import GhostIcon from "../shared/GhostIcon";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import { TALK_COPY } from "../../site/copy/talk";

// The trial is gated: a visitor cannot start the 8-minute live session until
// they leave a full name, work email AND mobile phone. The lead is recorded in
// the same ledger as document downloads (file = "talk-to-ghost-trial").
const TRIAL_LEAD_KEY = "ghost_trial_lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS_RE = /[\d]/g;

interface TrialLeadGateProps {
  onClose: () => void;
  // Called once the lead is validated + recorded, with the visitor's contact
  // details. The parent then opens a brand-new trial account named after the
  // visitor and navigates into the app.
  onComplete: (lead: { name: string; email: string; phone: string }) => void;
  // While the parent is establishing the session, keep the gate in a loading
  // state instead of letting it be re-submitted.
  busy?: boolean;
}

function loadSaved(): { name: string; email: string; phone: string } {
  try {
    const raw = window.localStorage.getItem(TRIAL_LEAD_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<{
        name: string;
        email: string;
        phone: string;
      }>;
      return {
        name: p.name ?? "",
        email: p.email ?? "",
        phone: p.phone ?? "",
      };
    }
  } catch {
    // ignore
  }
  return { name: "", email: "", phone: "" };
}

export default function TrialLeadGate({
  onClose,
  onComplete,
  busy = false,
}: TrialLeadGateProps) {
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const g = TALK_COPY[locale].gate;

  const saved = loadSaved();
  const [name, setName] = useState(saved.name);
  const [email, setEmail] = useState(saved.email);
  const [phone, setPhone] = useState(saved.phone);
  const [touched, setTouched] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const nameValid = name.trim().length > 0;
  const emailValid = EMAIL_RE.test(email.trim());
  const phoneValid = (phone.match(PHONE_DIGITS_RE)?.length ?? 0) >= 7;
  const valid = nameValid && emailValid && phoneValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      file: "talk-to-ghost-trial",
    };

    try {
      window.localStorage.setItem(TRIAL_LEAD_KEY, JSON.stringify(payload));
    } catch {
      // best-effort persistence only
    }

    // Record the lead (fire-and-forget) and hand control back to the parent,
    // which opens the fresh trial account and starts the live session.
    void api.trackDownload(payload);
    onComplete({ name: payload.name, email: payload.email, phone: payload.phone });
  };

  const fieldClass =
    "h-11 rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 text-[14px] text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 pb-safe-4"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={g.ariaLabel}
    >
      <button
        type="button"
        aria-label={g.close}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease]"
      />

      <div
        className="relative w-full max-w-[440px] rounded-[20px] border border-ghost-border-subtle bg-ghost-bg shadow-[0_24px_80px_rgb(0_0_0/0.55)] overflow-hidden"
        style={{ animation: "leadPopIn 320ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <button
          onClick={() => !busy && onClose()}
          aria-label={g.close}
          className="absolute top-3 end-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ghost-text-muted transition-colors hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
        >
          <X size={17} />
        </button>

        <div className="px-5 pt-6 pb-5 sm:px-6">
          <div className="mb-4 flex items-center gap-2.5" dir="ltr">
            <span className="h-1.5 w-1.5 rounded-full bg-ghost-accent animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ghost-text-muted">
              Live trial · 8 minutes · your camera
            </span>
          </div>

          {/* Mini chat thread, mirroring the lead-capture pattern */}
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[18px] bg-ghost-surface px-4 py-2.5 text-[14px] leading-snug text-ghost-text-primary">
              {g.userBubble}
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <GhostIcon size={28} className="mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-semibold leading-[1.25] tracking-[-0.01em] text-ghost-text-primary">
                {g.title}{" "}
                <span className="text-ghost-text-secondary">{g.titleSub}</span>
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ghost-text-secondary">
                {g.body}
              </p>
            </div>
          </div>

          {/* Form — all three fields required */}
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2.5">
            <input
              ref={firstFieldRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={g.namePlaceholder}
              autoComplete="name"
              disabled={busy}
              className={fieldClass}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={g.emailPlaceholder}
              type="email"
              autoComplete="email"
              disabled={busy}
              className={fieldClass}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={g.phonePlaceholder}
              type="tel"
              autoComplete="tel"
              disabled={busy}
              className={fieldClass}
            />

            <button
              type="submit"
              disabled={!valid || busy}
              className="group mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ghost-accent text-[15px] font-semibold text-ghost-bg outline-none transition-all hover:bg-ghost-accent-hover active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" size={17} />
                  {g.busy}
                </>
              ) : (
                <>
                  {g.submit}
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </>
              )}
            </button>

            {touched && !valid && (
              <p className="px-1 text-[12px] text-ghost-error">{g.validation}</p>
            )}

            <p className="mt-1 px-1 text-center text-[11px] leading-relaxed text-ghost-text-muted">
              {g.footnote}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
