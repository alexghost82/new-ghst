import { Paperclip, ArrowUp } from "lucide-react";
import { useLanguageStore } from "../../../stores/languageStore";

/**
 * Static, isolated replica of the real chat composer input bar (copied 1:1 from
 * `components/composer/Composer.tsx` styling). Non-interactive — for the
 * capabilities walkthrough only.
 */
export default function DemoComposer({
  value,
  placeholder,
}: {
  value?: string;
  placeholder?: string;
}) {
  const dir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);
  const text =
    value ??
    (locale === "he"
      ? "\u05d4\u05d0\u05dd \u05d4\u05d5\u05e9\u05d0\u05e8 \u05ea\u05d9\u05e7 \u05e2\u05dc \u05d4\u05e8\u05e6\u05e4\u05d4 \u05dc\u05d9\u05d3 \u05e2\u05de\u05d3\u05ea \u05d4\u05e9\u05d5\u05de\u05e8?"
      : "Is there a bag left on the ground by the guard booth?");
  const ph =
    placeholder ??
    (locale === "he" ? "...\u05e9\u05dc\u05d7 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05dc-Ghost" : "Message Ghost...");
  const disclaimer =
    locale === "he"
      ? "Ghost \u05e2\u05dc\u05d5\u05dc \u05dc\u05d8\u05e2\u05d5\u05ea. \u05d0\u05de\u05ea \u05de\u05d9\u05d3\u05e2 \u05d7\u05d9\u05d5\u05e0\u05d9."
      : "Ghost can make mistakes. Verify critical information.";

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2">
      <div className="max-w-chat mx-auto">
        <div className="flex items-end gap-2 rounded-3xl bg-ghost-surface px-4 py-3">
          <button
            type="button"
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            tabIndex={-1}
            aria-hidden="true"
          >
            <Paperclip size={18} />
          </button>
          <p
            className={`flex-1 text-[16px] leading-6 py-1 ${
              text ? "text-ghost-text-primary" : "text-ghost-text-muted"
            }`}
            dir={dir}
          >
            {text || ph}
          </p>
          <button
            type="button"
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-ghost-accent text-ghost-bg"
            tabIndex={-1}
            aria-hidden="true"
          >
            <ArrowUp size={18} />
          </button>
        </div>
        <div className="mt-2 text-center text-[12px] text-ghost-text-muted">
          {disclaimer}
        </div>
      </div>
    </div>
  );
}
