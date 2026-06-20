import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CircleCheck, X } from "lucide-react";
import { useIncidentStore } from "../../stores/incidentStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import SeverityBadge from "./SeverityBadge";

const MIN_LENGTH = 3;

/**
 * Global, blocking closure-summary gate.
 *
 * Rendered once at the App root. While
 * ``incidentStore.pendingCloseIncidentId`` is set, this modal renders
 * above everything (z-[200]) and refuses to dismiss until the
 * operator either:
 *   1. writes a non-empty summary and confirms (incident closes), or
 *   2. cancels (incident remains in its previous column).
 *
 * Any path that wants to close an incident — drag onto the "Closed"
 * column, the workspace's red "Close incident" button, the next-status
 * button, an SDK action, anything — must funnel through this modal.
 */
export default function IncidentCloseModal() {
  const t = useT();
  const pendingId = useIncidentStore((s) => s.pendingCloseIncidentId);
  const incident = useIncidentStore((s) =>
    pendingId ? s.incidents[pendingId] : undefined,
  );
  const closingInFlight = useIncidentStore((s) => s.closingInFlight);
  const confirmClose = useIncidentStore((s) => s.confirmClose);
  const cancelClose = useIncidentStore((s) => s.cancelClose);
  const activeUserId = useUserStore((s) => s.activeUserId);

  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (pendingId) {
      setText("");
      setTouched(false);
      const id = window.setTimeout(() => textareaRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [pendingId]);

  useEffect(() => {
    if (!pendingId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closingInFlight) cancelClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pendingId, closingInFlight, cancelClose]);

  if (!pendingId || !incident) return null;

  const trimmed = text.trim();
  const tooShort = trimmed.length < MIN_LENGTH;
  const showError = touched && tooShort;

  const handleSubmit = async () => {
    if (!activeUserId) return;
    setTouched(true);
    if (tooShort) {
      textareaRef.current?.focus();
      return;
    }
    await confirmClose(activeUserId, trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("closeIncidentResolution")}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 ghost-close-modal-bg"
    >
      <style>{`
        .ghost-close-modal-bg {
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          animation: ghostCloseModalFadeIn 200ms ease-out;
        }
        @keyframes ghostCloseModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .ghost-close-modal-dialog {
          animation: ghostCloseModalReveal 240ms cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.04),
            0 25px 50px -12px rgba(0, 0, 0, 0.6);
        }
        @keyframes ghostCloseModalReveal {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="ghost-close-modal-dialog relative w-full max-w-lg rounded-2xl overflow-hidden bg-ghost-bg-secondary border border-ghost-border-subtle">
        <header className="flex items-start gap-3 px-5 py-4 border-b border-ghost-border-subtle">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
            <CircleCheck size={16} className="text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-ghost-text-primary leading-tight">
              {t("closeIncident")}
            </p>
            <p className="text-xs text-ghost-text-muted mt-0.5 truncate">
              {incident.title}
            </p>
          </div>
          <button
            onClick={cancelClose}
            disabled={closingInFlight}
            className="flex-shrink-0 p-1.5 rounded-lg text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover disabled:opacity-40"
            aria-label={t("cancel")}
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={incident.severity} size="xs" />
            {incident.source_camera_label && (
              <span className="text-xs text-ghost-text-muted">
                {incident.source_camera_label}
              </span>
            )}
          </div>

          <p className="text-small text-ghost-text-secondary leading-relaxed">
            {t("closeIncidentPrompt")}
          </p>

          <div>
            <label
              htmlFor="ghost-close-summary"
              className="block text-[10px] uppercase tracking-wider text-ghost-text-muted font-semibold mb-1.5"
            >
              {t("closeIncidentResolution")}
            </label>
            <textarea
              id="ghost-close-summary"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={5}
              placeholder={t("closeIncidentPlaceholder")}
              disabled={closingInFlight}
              className={`w-full bg-ghost-surface border rounded-lg px-3 py-2 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none disabled:opacity-60 resize-none ${
                showError
                  ? "border-ghost-text-primary focus:border-ghost-text-primary"
                  : "border-ghost-border-subtle focus:border-ghost-text-primary/45"
              }`}
              aria-invalid={showError || undefined}
              aria-describedby={
                showError ? "ghost-close-summary-error" : undefined
              }
            />
            {showError && (
              <p
                id="ghost-close-summary-error"
                className="flex items-center gap-1.5 text-xs text-ghost-text-secondary mt-1.5"
              >
                <AlertCircle size={12} />
                {t("closeIncidentRequired")}
              </p>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ghost-border-subtle bg-ghost-surface/30">
          <button
            onClick={cancelClose}
            disabled={closingInFlight}
            className="px-3 py-1.5 rounded-lg text-small text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover disabled:opacity-40"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={closingInFlight || tooShort}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-500 text-white text-small font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            <Check size={13} />
            {closingInFlight ? t("saving") : t("confirmClose")}
          </button>
        </footer>
      </div>
    </div>
  );
}
