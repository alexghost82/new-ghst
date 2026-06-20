import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useVoiceStore, validateSendPhrase } from "../../stores/voiceStore";
import { useT } from "../../utils/i18n";

const SAVED_FEEDBACK_MS = 1600;

export default function VoiceCommandSection() {
  const t = useT();
  const enabled = useVoiceStore((s) => s.enabled);
  const setEnabled = useVoiceStore((s) => s.setEnabled);
  const sendPhrase = useVoiceStore((s) => s.sendPhrase);
  const setSendPhrase = useVoiceStore((s) => s.setSendPhrase);

  const [draft, setDraft] = useState(sendPhrase);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setDraft(sendPhrase);
  }, [sendPhrase]);

  useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [justSaved]);

  const handleSave = () => {
    const valid = validateSendPhrase(draft);
    if (!valid) {
      setError(t("voiceCommandInvalid"));
      return;
    }
    setError(null);
    setSendPhrase(valid);
    setDraft(valid);
    setJustSaved(true);
  };

  const isDirty = draft.trim().replace(/\s+/g, " ") !== sendPhrase;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-small text-ghost-text-primary font-medium">
            {t("voiceCommandEnableLabel")}
          </p>
          <p className="text-xs text-ghost-text-muted mt-0.5">
            {t("voiceCommandEnableHint")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("voiceCommandEnableLabel")}
          onClick={() => setEnabled(!enabled)}
          className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-[160ms] focus:outline-none focus:ring-2 focus:ring-ghost-text-secondary/40 ${
            enabled ? "bg-ghost-accent" : "bg-ghost-surface-hover"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-[160ms] ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled ? (
        <>
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder={t("voiceCommandPlaceholder")}
              className="flex-1 min-w-0 h-10 bg-ghost-surface border border-ghost-border-subtle rounded-xl px-3 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms]"
            />
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="shrink-0 px-4 rounded-xl text-small font-medium bg-ghost-surface hover:bg-ghost-surface-hover text-ghost-text-primary border border-ghost-border-subtle transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {justSaved ? <Check size={14} /> : null}
              {justSaved ? t("voiceCommandSaved") : t("save")}
            </button>
          </div>

          {error && <p className="text-xs text-ghost-error mt-2">{error}</p>}
        </>
      ) : (
        <p className="text-xs text-ghost-text-muted">
          {t("voiceCommandDisabledNote")}
        </p>
      )}
    </div>
  );
}
