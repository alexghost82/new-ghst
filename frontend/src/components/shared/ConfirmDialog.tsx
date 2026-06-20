import { useEffect, useRef } from "react";
import { useFeedbackStore } from "../../stores/feedbackStore";
import { useT } from "../../utils/i18n";

/**
 * Single app-wide confirmation dialog driven by feedbackStore. Resolve the
 * pending `confirmDialog(...)` promise with true (confirm) or false
 * (cancel / backdrop / Escape). Focus is moved to the confirm button on open.
 */
export default function ConfirmDialog() {
  const confirm = useFeedbackStore((s) => s.confirm);
  const resolveConfirm = useFeedbackStore((s) => s.resolveConfirm);
  const t = useT();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirm.open) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveConfirm(false);
      if (e.key === "Enter") resolveConfirm(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm.open, resolveConfirm]);

  if (!confirm.open) return null;

  const danger = confirm.tone === "danger";

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={confirm.title}
    >
      <button
        type="button"
        aria-label={t("cancel")}
        onClick={() => resolveConfirm(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_160ms_ease]"
      />
      <div
        className="relative w-full max-w-[420px] rounded-[18px] border border-ghost-border-subtle bg-ghost-bg p-5 shadow-[0_24px_80px_rgb(0_0_0/0.55)]"
        style={{ animation: "leadPopIn 240ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ghost-text-primary">
          {confirm.title}
        </h2>
        {confirm.message && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ghost-text-secondary">
            {confirm.message}
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => resolveConfirm(false)}
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ghost-text-secondary transition-colors hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
          >
            {confirm.cancelLabel ?? t("cancel")}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => resolveConfirm(true)}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              danger
                ? "bg-ghost-error/90 text-white hover:bg-ghost-error"
                : "bg-ghost-accent text-ghost-bg hover:bg-ghost-accent-hover"
            }`}
          >
            {confirm.confirmLabel ?? t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
