import { useEffect, useState } from "react";
import { X, Loader2, ArrowRight, ShieldCheck, UserCog } from "lucide-react";

import { api } from "../../api/client";
import { useUserStore } from "../../stores/userStore";
import { sanitizeBrand } from "../../utils/sanitize";
import GhostIcon from "../shared/GhostIcon";

// Admin entry choice box, opened by the hidden g+h+s+t chord on the login
// screen. Two doors:
//   1. Demo admin — enter the operator console as a full-access demo admin.
//   2. Admin console — passwordless direct entry into the owner /admin panel
//      (secret bypass; minted server-side and recorded to the audit log).
const ADMIN_SESSION_KEY = "ghost.admin.session.v1";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminEntryChoice({ onClose, onSuccess }: Props) {
  const enterDemoAdmin = useUserStore((s) => s.enterDemoAdmin);
  const [busy, setBusy] = useState<null | "demo" | "admin">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const enterDemo = async () => {
    if (busy) return;
    setBusy("demo");
    setError(null);
    const MAX_ATTEMPTS = 4;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await api.demoAdminLogin();
      if (res.ok && res.data) {
        enterDemoAdmin(res.data);
        onSuccess();
        return;
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => window.setTimeout(r, 2000));
      }
    }
    setError("Demo access unavailable");
    setBusy(null);
  };

  const enterAdmin = async () => {
    if (busy) return;
    setBusy("admin");
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok && body.data?.access_token) {
        // Hand the minted owner session to the admin bundle, then jump to it.
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(body.data));
        window.location.assign("/admin");
        return;
      }
      setError(sanitizeBrand(body?.error?.message ?? "Admin entry unavailable"));
    } catch {
      setError("Network error");
    }
    setBusy(null);
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6"
      dir="ltr"
      role="dialog"
      aria-modal="true"
      aria-label="Admin entry"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease]"
      />

      <div
        className="relative w-full max-w-[460px] flex flex-col rounded-[20px] border border-ghost-border-subtle bg-ghost-bg shadow-[0_24px_80px_rgb(0_0_0/0.55)] overflow-hidden"
        style={{ animation: "leadPopIn 320ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 end-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ghost-text-muted transition-colors hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
        >
          <X size={17} />
        </button>

        <div className="px-6 pt-6 pb-4 border-b border-ghost-border-subtle">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ghost-success animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ghost-text-muted">
              Ghost // Admin entry
            </span>
          </div>
          <div className="flex items-center gap-3">
            <GhostIcon size={32} />
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ghost-text-primary leading-tight">
                Choose entry
              </h2>
              <p className="mt-0.5 text-[13px] text-ghost-text-secondary">
                Privileged access. Both options are recorded.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-4">
          {/* Option 1 — demo admin operator */}
          <button
            onClick={() => void enterDemo()}
            disabled={busy !== null}
            className="group flex w-full items-center gap-3 rounded-xl border border-ghost-border-subtle px-4 py-3.5 text-start transition-colors duration-150 hover:bg-ghost-surface-hover hover:border-ghost-text-muted/40 disabled:opacity-60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ghost-border-subtle bg-ghost-surface/40 text-ghost-text-secondary">
              {busy === "demo" ? <Loader2 size={16} className="animate-spin" /> : <UserCog size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ghost-text-primary">
                Demo admin — full access
              </span>
              <span className="block text-[12px] text-ghost-text-secondary">
                Enter the console as a demo admin, no restrictions.
              </span>
            </span>
            <ArrowRight size={14} className="shrink-0 text-ghost-text-muted transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Option 2 — passwordless admin console */}
          <button
            onClick={() => void enterAdmin()}
            disabled={busy !== null}
            className="group flex w-full items-center gap-3 rounded-xl border border-ghost-border-subtle px-4 py-3.5 text-start transition-colors duration-150 hover:bg-ghost-surface-hover hover:border-ghost-text-muted/40 disabled:opacity-60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ghost-border-subtle bg-ghost-surface/40 text-ghost-text-secondary">
              {busy === "admin" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ghost-text-primary">
                Admin console — direct entry
              </span>
              <span className="block text-[12px] text-ghost-text-secondary">
                Open the owner /admin panel. No password required.
              </span>
            </span>
            <ArrowRight size={14} className="shrink-0 text-ghost-text-muted transition-transform group-hover:translate-x-0.5" />
          </button>

          {error && <p className="px-1 pt-1 text-[13px] text-ghost-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
