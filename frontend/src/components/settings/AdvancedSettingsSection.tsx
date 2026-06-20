import { useMemo, useState } from "react";
import { useConversationStore } from "../../stores/conversationStore";
import {
  useCaptureQualityStore,
  type CaptureQuality,
} from "../../stores/captureQualityStore";
import { useAutoNamingStore } from "../../stores/autoNamingStore";
import { useT, type TranslationKey } from "../../utils/i18n";
import AccuracyLevelSection from "./AccuracyLevelSection";

interface KnobOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A single tuning knob: a title + description, a segmented selector, and a
 * live "what this means for you" panel that updates with the selection. The
 * impact copy is intentionally plain-language and never references any
 * internal model, technology, or process.
 */
function Knob<T extends string>({
  title,
  description,
  options,
  value,
  impact,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  options: KnobOption<T>[];
  value: T;
  impact: string;
  disabled?: boolean;
  onSelect: (value: T) => void;
}) {
  const t = useT();
  return (
    <div>
      <h4 className="text-small text-ghost-text-secondary font-medium mb-1">
        {title}
      </h4>
      <p className="text-xs text-ghost-text-muted mb-3">{description}</p>
      <div
        role="radiogroup"
        aria-label={title}
        className="flex items-stretch gap-2"
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(opt.value)}
              className={`flex-1 h-10 rounded-xl text-small font-medium border transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-ghost-text-secondary/40 disabled:opacity-60 disabled:cursor-not-allowed ${
                selected
                  ? "bg-ghost-accent text-ghost-bg border-ghost-accent"
                  : "bg-ghost-surface text-ghost-text-secondary border-ghost-border-subtle hover:bg-ghost-surface-hover"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-xl bg-ghost-surface/60 border border-ghost-border-subtle px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-ghost-text-muted mb-1">
          {t("advancedImpactLabel")}
        </p>
        <p className="text-xs text-ghost-text-secondary leading-relaxed">
          {impact}
        </p>
      </div>
    </div>
  );
}

export default function AdvancedSettingsSection() {
  const t = useT();
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId,
  );
  const updateConversation = useConversationStore((s) => s.updateConversation);

  const [savingField, setSavingField] = useState<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const captureQuality = useCaptureQualityStore((s) => s.quality);
  const setCaptureQuality = useCaptureQualityStore((s) => s.setQuality);

  const autoNamingEnabled = useAutoNamingStore((s) => s.enabled);
  const setAutoNamingEnabled = useAutoNamingStore((s) => s.setEnabled);

  const responseLength = activeConversation?.response_length ?? "long";
  const imageDetail = activeConversation?.image_detail ?? "high";

  const handleResponseLength = async (value: "short" | "medium" | "long") => {
    if (!activeConversationId || value === responseLength || savingField) return;
    setSavingField("response_length");
    await updateConversation(activeConversationId, { response_length: value });
    setSavingField(null);
  };

  const handleImageDetail = async (value: "low" | "high") => {
    if (!activeConversationId || value === imageDetail || savingField) return;
    setSavingField("image_detail");
    await updateConversation(activeConversationId, { image_detail: value });
    setSavingField(null);
  };

  const responseLengthImpact: Record<string, TranslationKey> = {
    short: "responseLengthShortImpact",
    medium: "responseLengthMediumImpact",
    long: "responseLengthLongImpact",
  };
  const imageDetailImpact: Record<string, TranslationKey> = {
    low: "imageDetailFastImpact",
    high: "imageDetailSharpImpact",
  };
  const captureQualityImpact: Record<CaptureQuality, TranslationKey> = {
    fast: "captureQualityFastImpact",
    balanced: "captureQualityBalancedImpact",
    sharp: "captureQualitySharpImpact",
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-6 items-start">
        {/* Answer depth (accuracy tier) — reuses the existing per-conversation knob. */}
        <AccuracyLevelSection />

        {activeConversation ? (
          <>
            <Knob<"short" | "medium" | "long">
              title={t("responseLength")}
              description={t("responseLengthDescription")}
              value={responseLength}
              disabled={savingField !== null}
              onSelect={handleResponseLength}
              impact={t(responseLengthImpact[responseLength])}
              options={[
                { value: "short", label: t("responseLengthShort") },
                { value: "medium", label: t("responseLengthMedium") },
                { value: "long", label: t("responseLengthLong") },
              ]}
            />

            <Knob<"low" | "high">
              title={t("imageDetail")}
              description={t("imageDetailDescription")}
              value={imageDetail}
              disabled={savingField !== null}
              onSelect={handleImageDetail}
              impact={t(imageDetailImpact[imageDetail])}
              options={[
                { value: "low", label: t("imageDetailFast") },
                { value: "high", label: t("imageDetailSharp") },
              ]}
            />
          </>
        ) : (
          <p className="text-xs text-ghost-text-muted">
            {t("advancedNoConversation")}
          </p>
        )}

        {/* Capture quality is a browser-local preference — always available. */}
        <Knob<CaptureQuality>
          title={t("captureQuality")}
          description={t("captureQualityDescription")}
          value={captureQuality}
          onSelect={setCaptureQuality}
          impact={t(captureQualityImpact[captureQuality])}
          options={[
            { value: "fast", label: t("captureQualityFast") },
            { value: "balanced", label: t("captureQualityBalanced") },
            { value: "sharp", label: t("captureQualitySharp") },
          ]}
        />

        {/* Auto-naming is a browser-local preference — always available. */}
        <Knob<"on" | "off">
          title={t("autoNamingTitle")}
          description={t("autoNamingDescription")}
          value={autoNamingEnabled ? "on" : "off"}
          onSelect={(v) => setAutoNamingEnabled(v === "on")}
          impact={t(
            autoNamingEnabled
              ? "autoNamingImpactOn"
              : "autoNamingImpactOff",
          )}
          options={[
            { value: "on", label: t("autoNamingOnLabel") },
            { value: "off", label: t("autoNamingOffLabel") },
          ]}
        />
      </div>
    </div>
  );
}
