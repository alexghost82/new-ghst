import { useState, useEffect, type ReactNode } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useT, type TranslationKey } from "../../utils/i18n";
import type {
  ConversationCharacter,
  PersonaTone,
  Proactivity,
  OperatorProfile,
  ContactSeverity,
  EscalationContact,
} from "../../types/api";

interface SystemPromptEditorProps {
  onClose: () => void;
}

const EMPTY_CHARACTER: ConversationCharacter = {
  agent_name: "",
  role_mission: "",
  site_type: "",
  focus_priorities: "",
  ignore_scope: "",
  site_baseline: "",
  persona_tone: "",
  dry_humor: false,
  proactivity: "",
  operator_profile: "",
  critical_event_definition: "",
  escalation_contacts: [],
  quiet_hours: "",
  system_prompt: "",
};

/** Mono eyebrow + hairline + title — the canonical Ghost section header. */
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mb-4 mt-2">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-ghost-text-muted">
          {eyebrow}
        </span>
        <span className="flex-1 h-px bg-ghost-border-subtle" />
      </div>
      <h3 className="text-[15px] font-semibold leading-tight text-ghost-text-primary">
        {title}
      </h3>
    </header>
  );
}

/** Labelled field row with an optional hint under the control. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-small font-medium text-ghost-text-secondary">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-ghost-text-muted leading-relaxed">
          {hint}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full h-10 bg-ghost-surface border border-ghost-border-subtle rounded-xl px-3 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms]";
const textareaClass =
  "w-full bg-ghost-surface border border-ghost-border-subtle rounded-xl px-3 py-2.5 text-small text-ghost-text-primary placeholder:text-ghost-text-muted resize-none focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms]";

/** Segmented single-choice control. Selecting the active option clears it
 *  (back to "no preference"), so every knob has a neutral default. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <span className="block mb-1.5 text-small font-medium text-ghost-text-secondary">
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex items-stretch gap-2">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? ("" as T) : opt.value)}
              className={`flex-1 h-10 rounded-xl text-small font-medium border transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-ghost-text-secondary/40 ${
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
    </div>
  );
}

export default function SystemPromptEditor({
  onClose,
}: SystemPromptEditorProps) {
  const { conversations, activeConversationId, updateConversation } =
    useConversationStore();
  const active = conversations.find((c) => c.id === activeConversationId);
  const t = useT();

  const [form, setForm] = useState<ConversationCharacter>(EMPTY_CHARACTER);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!active) {
      setForm(EMPTY_CHARACTER);
      return;
    }
    setForm({
      agent_name: active.agent_name ?? "",
      role_mission: active.role_mission ?? "",
      site_type: active.site_type ?? "",
      focus_priorities: active.focus_priorities ?? "",
      ignore_scope: active.ignore_scope ?? "",
      site_baseline: active.site_baseline ?? "",
      persona_tone: (active.persona_tone ?? "") as PersonaTone,
      dry_humor: !!active.dry_humor,
      proactivity: (active.proactivity ?? "") as Proactivity,
      operator_profile: (active.operator_profile ?? "") as OperatorProfile,
      critical_event_definition: active.critical_event_definition ?? "",
      escalation_contacts: active.escalation_contacts ?? [],
      quiet_hours: active.quiet_hours ?? "",
      system_prompt: active.system_prompt ?? "",
    });
  }, [active]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const set = <K extends keyof ConversationCharacter>(
    key: K,
    value: ConversationCharacter[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const setContact = (
    index: number,
    key: keyof EscalationContact,
    value: string,
  ) =>
    setForm((f) => ({
      ...f,
      escalation_contacts: f.escalation_contacts.map((c, i) =>
        i === index ? { ...c, [key]: value } : c,
      ),
    }));

  const addContact = () =>
    setForm((f) => ({
      ...f,
      escalation_contacts: [
        ...f.escalation_contacts,
        { name: "", role: "", phone: "", min_severity: "critical" },
      ],
    }));

  const removeContact = (index: number) =>
    setForm((f) => ({
      ...f,
      escalation_contacts: f.escalation_contacts.filter((_, i) => i !== index),
    }));

  const handleSave = async () => {
    if (!activeConversationId) return;
    setIsSaving(true);
    await updateConversation(activeConversationId, {
      ...form,
      // Drop contacts that are entirely blank so we never persist noise.
      escalation_contacts: form.escalation_contacts.filter(
        (c) => c.name.trim() || c.phone.trim(),
      ),
    });
    setIsSaving(false);
    onClose();
  };

  const siteTypeOptions: { value: string; labelKey: TranslationKey }[] = [
    { value: "", labelKey: "siteTypeNone" },
    { value: t("siteTypeWarehouse"), labelKey: "siteTypeWarehouse" },
    { value: t("siteTypeParking"), labelKey: "siteTypeParking" },
    { value: t("siteTypeOffice"), labelKey: "siteTypeOffice" },
    { value: t("siteTypeRetail"), labelKey: "siteTypeRetail" },
    { value: t("siteTypeConstruction"), labelKey: "siteTypeConstruction" },
    { value: t("siteTypeResidential"), labelKey: "siteTypeResidential" },
    { value: t("siteTypeTransport"), labelKey: "siteTypeTransport" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-ghost-bg-secondary border border-ghost-border-subtle rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-ghost-border-subtle shrink-0">
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-[0.24em] uppercase text-ghost-text-muted mb-1">
              Ghost // Character
            </div>
            <h2 className="text-title text-ghost-text-primary leading-tight">
              {t("ghostCharacterTitle")}
            </h2>
            <p className="mt-1 text-xs text-ghost-text-muted leading-relaxed max-w-md">
              {t("ghostCharacterSubtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {!active ? (
          <div className="px-6 py-10 text-center text-small text-ghost-text-muted">
            {t("charNoConversation")}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-1">
            {/* A. Identity & role */}
            <SectionHeader
              eyebrow="Identity"
              title={t("charSecIdentity")}
            />
            <div className="space-y-4">
              <Field label={t("charAgentName")} hint={t("charAgentNameHint")}>
                <input
                  type="text"
                  value={form.agent_name}
                  onChange={(e) => set("agent_name", e.target.value)}
                  placeholder={t("charAgentNamePlaceholder")}
                  className={inputClass}
                />
              </Field>
              <Field label={t("charRoleMission")}>
                <input
                  type="text"
                  value={form.role_mission}
                  onChange={(e) => set("role_mission", e.target.value)}
                  placeholder={t("charRoleMissionPlaceholder")}
                  className={inputClass}
                />
              </Field>
              <Field label={t("charSiteType")}>
                <select
                  value={form.site_type}
                  onChange={(e) => set("site_type", e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  {siteTypeOptions.map((opt) => (
                    <option key={opt.labelKey} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* B. Focus */}
            <SectionHeader eyebrow="Focus" title={t("charSecFocus")} />
            <div className="space-y-4">
              <Field label={t("charFocus")} hint={t("charLineHint")}>
                <textarea
                  value={form.focus_priorities}
                  onChange={(e) => set("focus_priorities", e.target.value)}
                  rows={3}
                  placeholder={t("charFocusPlaceholder")}
                  className={textareaClass}
                />
              </Field>
              <Field label={t("charIgnore")} hint={t("charLineHint")}>
                <textarea
                  value={form.ignore_scope}
                  onChange={(e) => set("ignore_scope", e.target.value)}
                  rows={2}
                  placeholder={t("charIgnorePlaceholder")}
                  className={textareaClass}
                />
              </Field>
              <Field label={t("charBaseline")}>
                <textarea
                  value={form.site_baseline}
                  onChange={(e) => set("site_baseline", e.target.value)}
                  rows={2}
                  placeholder={t("charBaselinePlaceholder")}
                  className={textareaClass}
                />
              </Field>
            </div>

            {/* C. Communication style */}
            <SectionHeader eyebrow="Style" title={t("charSecStyle")} />
            <div className="space-y-4">
              <Segmented<PersonaTone>
                label={t("charTone")}
                value={form.persona_tone}
                onChange={(v) => set("persona_tone", v)}
                options={[
                  { value: "terse", label: t("toneTerse") },
                  { value: "friendly", label: t("toneFriendly") },
                  { value: "formal", label: t("toneFormal") },
                ]}
              />
              <Segmented<Proactivity>
                label={t("charProactivity")}
                value={form.proactivity}
                onChange={(v) => set("proactivity", v)}
                options={[
                  { value: "on_demand", label: t("proactOnDemand") },
                  { value: "flag_anomalies", label: t("proactFlag") },
                  { value: "continuous", label: t("proactContinuous") },
                ]}
              />
              <Segmented<OperatorProfile>
                label={t("charOperatorProfile")}
                value={form.operator_profile}
                onChange={(v) => set("operator_profile", v)}
                options={[
                  { value: "guard", label: t("opGuard") },
                  { value: "shift_manager", label: t("opShift") },
                  { value: "owner", label: t("opOwner") },
                ]}
              />
              <label className="flex items-center justify-between gap-4 rounded-xl bg-ghost-surface/60 border border-ghost-border-subtle px-3 py-2.5">
                <span className="text-small text-ghost-text-secondary">
                  {t("charDryHumor")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.dry_humor}
                  onClick={() => set("dry_humor", !form.dry_humor)}
                  className={`shrink-0 w-12 h-7 rounded-full relative transition-colors duration-[160ms] ${
                    form.dry_humor ? "bg-ghost-accent" : "bg-ghost-border-subtle"
                  }`}
                  aria-label={t("charDryHumor")}
                >
                  <span
                    className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-[160ms] ${
                      form.dry_humor ? "end-0.5" : "start-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* D. Operational & escalation */}
            <SectionHeader
              eyebrow="Escalation"
              title={t("charSecEscalation")}
            />
            <div className="space-y-4">
              <Field label={t("charCritical")}>
                <textarea
                  value={form.critical_event_definition}
                  onChange={(e) =>
                    set("critical_event_definition", e.target.value)
                  }
                  rows={2}
                  placeholder={t("charCriticalPlaceholder")}
                  className={textareaClass}
                />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-small font-medium text-ghost-text-secondary">
                    {t("charContacts")}
                  </span>
                  <button
                    type="button"
                    onClick={addContact}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-ghost-accent hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                  >
                    <Plus size={14} />
                    {t("charContactAdd")}
                  </button>
                </div>

                {form.escalation_contacts.length === 0 ? (
                  <p className="text-xs text-ghost-text-muted">
                    {t("charContactsEmpty")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.escalation_contacts.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-ghost-border-subtle bg-ghost-surface/40 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) =>
                              setContact(i, "name", e.target.value)
                            }
                            placeholder={t("charContactName")}
                            className={`${inputClass} flex-1`}
                          />
                          <button
                            type="button"
                            onClick={() => removeContact(i)}
                            className="shrink-0 grid place-items-center w-10 h-10 rounded-xl text-ghost-text-muted hover:text-ghost-error hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                            aria-label={t("charContactRemove")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={c.role}
                            onChange={(e) =>
                              setContact(i, "role", e.target.value)
                            }
                            placeholder={t("charContactRole")}
                            className={`${inputClass} flex-1`}
                          />
                          <input
                            type="tel"
                            dir="ltr"
                            value={c.phone}
                            onChange={(e) =>
                              setContact(i, "phone", e.target.value)
                            }
                            placeholder={t("charContactPhone")}
                            className={`${inputClass} flex-1 text-start`}
                          />
                        </div>
                        <Segmented<ContactSeverity>
                          label={t("charContactSeverity")}
                          value={c.min_severity}
                          onChange={(v) =>
                            setContact(
                              i,
                              "min_severity",
                              // Severity has no neutral state — keep current
                              // when the active chip is re-tapped.
                              v || c.min_severity,
                            )
                          }
                          options={[
                            { value: "critical", label: t("sevCritical") },
                            { value: "important", label: t("sevImportant") },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-ghost-text-muted leading-relaxed">
                  {t("charContactsNote")}
                </p>
              </div>

              <Field label={t("charQuietHours")} hint={t("charQuietHoursHint")}>
                <input
                  type="text"
                  dir="ltr"
                  value={form.quiet_hours}
                  onChange={(e) => set("quiet_hours", e.target.value)}
                  placeholder="23:00-06:00"
                  className={`${inputClass} text-start`}
                />
              </Field>
            </div>

            {/* E. Additional rules (legacy free-text) */}
            <SectionHeader eyebrow="Rules" title={t("charSecRules")} />
            <div className="space-y-1 pb-2">
              <textarea
                value={form.system_prompt}
                onChange={(e) => set("system_prompt", e.target.value)}
                rows={5}
                placeholder={t("enterSystemPrompt")}
                className={textareaClass}
              />
              <p className="text-xs text-ghost-text-muted text-end">
                {form.system_prompt.length} {t("characters")}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ghost-border-subtle flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-small text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !active}
            className="px-5 py-2 rounded-lg text-small font-medium bg-ghost-accent hover:bg-ghost-accent-hover text-ghost-bg transition-colors duration-[100ms] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
