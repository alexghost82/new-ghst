import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useFeedbackStore } from "../../stores/feedbackStore";
import { sanitizeBrand } from "../../utils/sanitize";

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const TONES = {
  success: "text-ghost-success",
  error: "text-ghost-error",
  info: "text-ghost-text-secondary",
} as const;

/**
 * Stacked transient feedback toasts. Mounted once at the app root. Dismisses
 * automatically (see feedbackStore) or on click.
 */
export default function Toaster() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const dismiss = useFeedbackStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 start-1/2 z-[200] flex w-full max-w-[420px] -translate-x-1/2 flex-col gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((tst) => {
        const Icon = ICONS[tst.kind];
        return (
          <div
            key={tst.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-ghost-border-subtle bg-ghost-surface/95 px-3.5 py-2.5 shadow-[0_8px_30px_rgb(0_0_0/0.35)] backdrop-blur-sm"
            style={{ animation: "leadPopIn 220ms cubic-bezier(0.16,1,0.3,1)" }}
          >
            <Icon size={16} className={`mt-0.5 shrink-0 ${TONES[tst.kind]}`} />
            <span className="flex-1 text-[13px] leading-snug text-ghost-text-primary">
              {sanitizeBrand(tst.message)}
            </span>
            <button
              type="button"
              onClick={() => dismiss(tst.id)}
              aria-label="Dismiss"
              className="shrink-0 text-ghost-text-muted transition-colors hover:text-ghost-text-primary"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
