import { useMemo, useState } from "react";
import { useConversationStore } from "../../stores/conversationStore";
import { useT } from "../../utils/i18n";

const LEVELS = [1, 2, 3, 4] as const;
const DEFAULT_LEVEL = 4;

export default function AccuracyLevelSection() {
  const t = useT();
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId,
  );
  const updateConversation = useConversationStore((s) => s.updateConversation);

  const [isSaving, setIsSaving] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const currentLevel = activeConversation?.accuracy_level ?? DEFAULT_LEVEL;

  const handleSelect = async (level: number) => {
    if (!activeConversationId || level === currentLevel || isSaving) return;
    setIsSaving(true);
    await updateConversation(activeConversationId, { accuracy_level: level });
    setIsSaving(false);
  };

  return (
    <div>
      <h3 className="text-small text-ghost-text-secondary font-medium mb-2">
        {t("accuracyLevel")}
      </h3>
      <p className="text-xs text-ghost-text-muted mb-3">
        {t("accuracyLevelDescription")}
      </p>

      {activeConversation ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ghost-text-secondary">
              {t("accuracyFaster")}
            </span>
            <span className="text-xs font-medium text-ghost-text-secondary">
              {t("accuracyMoreAccurate")}
            </span>
          </div>
          <div
            role="radiogroup"
            aria-label={t("accuracyLevel")}
            className="flex items-stretch gap-2"
          >
            {LEVELS.map((level) => {
              const selected = level === currentLevel;
              const poleLabel =
                level === LEVELS[0]
                  ? t("accuracyFaster")
                  : level === LEVELS[LEVELS.length - 1]
                    ? t("accuracyMoreAccurate")
                    : undefined;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={poleLabel ?? `${t("accuracyLevel")} ${level}`}
                  disabled={isSaving}
                  onClick={() => handleSelect(level)}
                  className={`flex-1 h-10 rounded-xl text-small font-medium border transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-ghost-text-secondary/40 disabled:opacity-60 disabled:cursor-not-allowed ${
                    selected
                      ? "bg-ghost-accent text-ghost-bg border-ghost-accent"
                      : "bg-ghost-surface text-ghost-text-secondary border-ghost-border-subtle hover:bg-ghost-surface-hover"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ghost-text-muted mt-3">
            {t("accuracyLevelHint")}
          </p>
        </>
      ) : (
        <p className="text-xs text-ghost-text-muted">
          {t("accuracyNoConversation")}
        </p>
      )}
    </div>
  );
}
