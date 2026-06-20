import { X, AlertCircle } from "lucide-react";
import { useT } from "../../utils/i18n";
import { sanitizeBrand } from "../../utils/sanitize";

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function ErrorBanner({
  message,
  onDismiss,
  onRetry,
}: ErrorBannerProps) {
  const t = useT();

  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-lg bg-ghost-error/10 border border-ghost-error/20 px-4 py-2.5 fade-in overflow-hidden min-w-0">
      <AlertCircle size={16} className="text-ghost-error flex-shrink-0" />
      <p className="flex-1 text-small text-ghost-error break-all overflow-hidden">{sanitizeBrand(message)}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-small text-ghost-error hover:text-ghost-error/70 font-medium transition-colors duration-[100ms]"
        >
          {t("retry")}
        </button>
      )}
      <button
        onClick={onDismiss}
        className="p-0.5 text-ghost-error hover:text-ghost-error/70 transition-colors duration-[100ms]"
        aria-label="Dismiss error"
      >
        <X size={14} />
      </button>
    </div>
  );
}
