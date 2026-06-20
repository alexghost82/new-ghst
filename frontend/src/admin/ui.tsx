/**
 * Shared admin-console UI primitives. Brand-locked to the Ghost design line:
 * monochrome `ghost-*` tokens, mono uppercase English micro-labels, subtle
 * borders over translucent surfaces, lime/red ONLY for live status. Hebrew RTL
 * body copy.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** Mono uppercase micro-label — the Ghost signature tag. Always English. */
export function MonoLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`font-mono text-[9px] tracking-[0.22em] uppercase text-ghost-text-muted ${className}`}
    >
      {children}
    </span>
  );
}

/** Bare Ghost mark — inverted in dark (admin console is always dark). */
export function AdminBrand({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/ghost-icon.png"
      alt="Ghost"
      draggable={false}
      style={{ width: size, height: size }}
      className="object-contain invert"
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-ghost-border-subtle bg-ghost-surface/20 ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-ghost-accent text-ghost-bg hover:bg-ghost-accent-hover",
    ghost:
      "border border-ghost-border-subtle text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface/40",
    danger:
      "border border-ghost-error/40 text-ghost-error hover:bg-ghost-error/10",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block">
        <MonoLabel>{label}</MonoLabel>
      </span>
      <input
        className={`w-full rounded-lg border border-ghost-border-subtle bg-ghost-bg-secondary px-3 py-2.5 text-sm text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-secondary ${className}`}
        {...props}
      />
    </label>
  );
}

/** Inline non-blocking message banner. tone drives the (functional) color. */
export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "border-ghost-border-subtle text-ghost-text-secondary",
    error: "border-ghost-error/40 text-ghost-error",
    success: "border-ghost-success/40 text-ghost-success",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Empty / coming-soon state used by screens still being built out. */
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <MonoLabel>Ghost // {title}</MonoLabel>
      <p className="max-w-md text-sm text-ghost-text-muted">
        {note ?? "המסך הזה ייבנה בשלב הבא של ההטמעה."}
      </p>
    </div>
  );
}

/** Operator account status pill. Color is functional: red = blocked/deleted,
 * lime = active, neutral = suspended. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { he: string; cls: string }> = {
    active: { he: "פעיל", cls: "border-ghost-success/40 text-ghost-success" },
    suspended: { he: "מושעה", cls: "border-ghost-border-subtle text-ghost-text-secondary" },
    blocked: { he: "חסום", cls: "border-ghost-error/40 text-ghost-error" },
    deleted: { he: "נמחק", cls: "border-ghost-error/40 text-ghost-error" },
  };
  const m = map[status] ?? map.active;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${m.cls}`}>
      {m.he}
    </span>
  );
}

/** Centered modal overlay. Closes on backdrop click via onClose. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-ghost-border-subtle bg-ghost-bg-secondary p-5"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className="mb-3 text-base font-medium text-ghost-text-primary">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-ghost-text-muted">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ghost-border-subtle border-t-ghost-text-secondary" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
