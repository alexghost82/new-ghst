import { X } from "lucide-react";
import { useLanguageStore } from "../../../stores/languageStore";

// Faithful, isolated replica of `components/settings/SystemPromptEditor.tsx`.
// Rendered inline inside a contained backdrop instead of a fullscreen overlay,
// with a static example prompt. Markup/classes copied 1:1.
export default function DemoSystemPromptEditor() {
  const { dir, locale } = useLanguageStore();
  const he = locale === "he";
  const value = he
    ? "\u05d0\u05ea\u05d4 \u05e9\u05d5\u05de\u05e8 \u05e2\u05dc \u05d4\u05e9\u05e2\u05e8 \u05d4\u05e8\u05d0\u05e9\u05d9 \u05e9\u05dc \u05d0\u05ea\u05e8 \u05d4\u05dc\u05d5\u05d2\u05d9\u05e1\u05d8\u05d9\u05e7\u05d4. \u05d3\u05d5\u05d5\u05d7 \u05dc\u05d9 \u05d0\u05dd \u05de\u05d9\u05e9\u05d4\u05d5 \u05e0\u05e6\u05de\u05d3 \u05dc\u05d7\u05dc\u05d5\u05df \u05e2\u05de\u05d3\u05ea \u05d4\u05e9\u05d5\u05de\u05e8 \u05d0\u05d5 \u05de\u05ea\u05e2\u05e1\u05e7 \u05e2\u05dd \u05d4\u05de\u05e0\u05e2\u05d5\u05dc, \u05d0\u05dd \u05d4\u05d5\u05e9\u05d0\u05e8 \u05ea\u05d9\u05e7 \u05d0\u05d5 \u05d0\u05e8\u05d2\u05d6 \u05e2\u05dc \u05d4\u05e8\u05e6\u05e4\u05d4 \u05dc\u05d9\u05d3 \u05d4\u05e2\u05de\u05d3\u05d4, \u05d5\u05d0\u05dd \u05de\u05e9\u05d8\u05d7\u05d9\u05dd \u05d0\u05d5 \u05d0\u05e8\u05d2\u05d6\u05d9\u05dd \u05d7\u05d5\u05e1\u05de\u05d9\u05dd \u05d0\u05ea \u05d6\u05e8\u05d5\u05e2 \u05d4\u05de\u05d7\u05e1\u05d5\u05dd \u05d0\u05d5 \u05d9\u05e6\u05d9\u05d0\u05ea \u05d7\u05d9\u05e8\u05d5\u05dd. \u05d4\u05ea\u05e2\u05dc\u05dd \u05de\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05de\u05e2\u05d1\u05d9\u05e8\u05d9\u05dd \u05db\u05e8\u05d8\u05d9\u05e1 \u05d1\u05e9\u05e2\u05d5\u05ea \u05d4\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea."
    : "You watch the main gate of the logistics site. Tell me if anyone presses up against the guard-booth window or works at the lock, if a bag or box is left on the ground by the booth, and if pallets or crates end up blocking the barrier arm or an emergency exit. Ignore staff badging through during working hours.";
  const title = he ? "\u05d4\u05e0\u05d7\u05d9\u05d9\u05ea \u05de\u05e2\u05e8\u05db\u05ea" : "System prompt";
  const placeholderChars = `${value.length} ${he ? "\u05ea\u05d5\u05d5\u05d9\u05dd" : "characters"}`;
  const cancel = he ? "\u05d1\u05d9\u05d8\u05d5\u05dc" : "Cancel";
  const save = he ? "\u05e9\u05de\u05d9\u05e8\u05d4" : "Save";

  return (
    <div className="relative flex items-center justify-center p-6 bg-black/40" style={{ minHeight: 360 }}>
      <div className="relative bg-ghost-bg-secondary border border-ghost-border-subtle rounded-xl shadow-lg w-full max-w-lg" dir={dir}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ghost-border-subtle">
          <h2 className="text-title text-ghost-text-primary">{title}</h2>
          <span className="p-1 rounded text-ghost-text-muted">
            <X size={16} />
          </span>
        </div>

        <div className="px-5 py-4">
          <div className="w-full min-h-[180px] bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2.5 text-body text-ghost-text-primary whitespace-pre-wrap leading-relaxed">
            {value}
          </div>
          <p className="text-xs text-ghost-text-muted mt-1.5 text-end">{placeholderChars}</p>
        </div>

        <div className="px-5 py-4 border-t border-ghost-border-subtle flex justify-end gap-2">
          <span className="px-4 py-2 rounded-lg text-small text-ghost-text-secondary">{cancel}</span>
          <span className="px-4 py-2 rounded-lg text-small font-medium bg-ghost-accent text-white">
            {save}
          </span>
        </div>
      </div>
    </div>
  );
}
