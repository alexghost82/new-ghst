import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Mail,
  Phone,
  MessageSquare,
  ArrowRight,
  Database,
} from "lucide-react";
import { api, withAdminRetry } from "../../api/client";
import { useUserStore } from "../../stores/userStore";
import { sanitizeBrand } from "../../utils/sanitize";
import GhostIcon from "../shared/GhostIcon";
import type { TrialAccount } from "../../types/api";

// ── Demo-admin account picker (8+0 chord) ────────────────────────────────────
// Every public trial now opens its own brand-new account named after the
// visitor. Before entering the console, the admin chooses WHICH of those
// demo accounts to access — with each visitor's contact details (name,
// email, phone) and how many conversations they opened. Selecting one
// establishes a full demo_admin session on that account.

interface DemoAdminUserPickerProps {
  onClose: () => void;
  onSuccess: () => void;
}

function formatOpenedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DemoAdminUserPicker({
  onClose,
  onSuccess,
}: DemoAdminUserPickerProps) {
  const loginAsDemoUser = useUserStore((s) => s.loginAsDemoUser);
  const enterDemoAdmin = useUserStore((s) => s.enterDemoAdmin);

  const [accounts, setAccounts] = useState<TrialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legacyBusy, setLegacyBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // The trial-accounts roster is admin-guarded (visitor PII): prompt for
      // and verify the admin token before the PII reaches the screen.
      const res = await withAdminRetry(() => api.listTrialAccounts());
      if (cancelled) return;
      if (res.ok && res.data) {
        setAccounts(res.data);
        setError(null);
      } else {
        setError(sanitizeBrand(res.error?.message ?? "Failed to load demo accounts"));
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const enterAccount = (account: TrialAccount) => {
    loginAsDemoUser(account);
    onSuccess();
  };

  // The historical shared ghostdemo account (pre-personal-accounts demos).
  // The server now logs in / seeds it with its own demo key — the key never
  // touches the client.
  const enterLegacy = async () => {
    if (legacyBusy) return;
    setLegacyBusy(true);
    setError(null);
    const MAX_ATTEMPTS = 4;
    const RETRY_DELAY_MS = 2500;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await api.demoAdminLogin();
      if (res.ok && res.data) {
        enterDemoAdmin(res.data);
        onSuccess();
        return;
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => window.setTimeout(r, RETRY_DELAY_MS));
      }
    }
    setError("Demo access unavailable");
    setLegacyBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6"
      dir="ltr"
      role="dialog"
      aria-modal="true"
      aria-label="Demo admin — select account"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease]"
      />

      <div
        className="relative w-full max-w-[560px] max-h-[86vh] flex flex-col rounded-[20px] border border-ghost-border-subtle bg-ghost-bg shadow-[0_24px_80px_rgb(0_0_0/0.55)] overflow-hidden"
        style={{ animation: "leadPopIn 320ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 end-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ghost-text-muted transition-colors hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
        >
          <X size={17} />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-ghost-border-subtle">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ghost-success animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ghost-text-muted">
              Ghost // Demo admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <GhostIcon size={32} />
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ghost-text-primary leading-tight">
                Select a demo account
              </h2>
              <p className="mt-0.5 text-[13px] text-ghost-text-secondary">
                Every trial opened from the site runs on its own account. Pick
                one to enter it with full access.
              </p>
            </div>
          </div>
        </div>

        {/* Account list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-10 font-mono text-[11px] uppercase tracking-[0.18em] text-ghost-text-muted">
              <Loader2 size={13} className="animate-spin" />
              Loading demo accounts
            </p>
          )}

          {!loading && error && (
            <p className="py-6 text-center text-[13px] text-ghost-error">{error}</p>
          )}

          {!loading && !error && accounts.length === 0 && (
            <p className="py-10 text-center text-[13px] text-ghost-text-muted">
              No demo accounts yet — they appear here the moment a visitor
              starts a trial on the site.
            </p>
          )}

          {!loading &&
            accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => enterAccount(acc)}
                className="group w-full rounded-xl border border-ghost-border-subtle px-4 py-3 text-start transition-colors duration-150 hover:bg-ghost-surface-hover hover:border-ghost-text-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[14.5px] font-semibold text-ghost-text-primary">
                    {acc.lead_name || acc.nickname}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-ghost-border-subtle bg-ghost-surface/40 px-2 py-0.5 font-mono text-[10px] tabular-nums text-ghost-text-secondary">
                      <MessageSquare size={10} />
                      {acc.conversation_count}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-ghost-text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ghost-text-primary"
                    />
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {acc.lead_email && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ghost-text-secondary">
                      <Mail size={11} className="text-ghost-text-muted" />
                      {acc.lead_email}
                    </span>
                  )}
                  {acc.lead_phone && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ghost-text-secondary">
                      <Phone size={11} className="text-ghost-text-muted" />
                      {acc.lead_phone}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-text-muted">
                  Opened {formatOpenedAt(acc.created_at)}
                </p>
              </button>
            ))}
        </div>

        {/* Legacy shared account */}
        <div className="border-t border-ghost-border-subtle px-4 py-3">
          <button
            onClick={() => void enterLegacy()}
            disabled={legacyBusy}
            className="group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-start transition-colors duration-150 hover:bg-ghost-surface-hover disabled:opacity-60"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ghost-border-subtle bg-ghost-surface/40 text-ghost-text-muted">
              {legacyBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Database size={14} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ghost-text-secondary group-hover:text-ghost-text-primary transition-colors">
                Legacy shared account
              </span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-text-muted">
                ghostdemo · pre-personal-accounts demos
              </span>
            </span>
            <ArrowRight
              size={13}
              className="shrink-0 text-ghost-text-muted transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
