import type { useT } from "../../utils/i18n";
import type { TaskScheduleType } from "../../types/api";

/** Shared field values for the create + edit task forms. */
export interface TaskFieldValues {
  name: string;
  promptText: string;
  scheduleType: TaskScheduleType;
  runAt: string;
  intervalSeconds: number;
  dailyTime: string;
  includeCamera: boolean;
}

export const EMPTY_TASK_FORM: TaskFieldValues = {
  name: "",
  promptText: "",
  scheduleType: "interval",
  runAt: "",
  intervalSeconds: 60,
  dailyTime: "08:00",
  includeCamera: true,
};

/** Convert a stored ISO timestamp into the local value a datetime-local input expects. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Shared name / prompt / schedule / camera fields used by the create and edit
 *  task forms (tasks panel + operations modal), so a task is always edited with
 *  the exact same controls. */
export function TaskFormFields({
  values,
  onChange,
  t,
  scheduleOptions,
}: {
  values: TaskFieldValues;
  onChange: (patch: Partial<TaskFieldValues>) => void;
  t: ReturnType<typeof useT>;
  scheduleOptions: Array<{ value: TaskScheduleType; label: string }>;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="block text-small text-ghost-text-muted">
          {t("taskName")}
        </label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("taskNamePlaceholder")}
          className="w-full min-h-[44px] bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3.5 py-2.5 text-body text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-small text-ghost-text-muted">
          {t("taskPrompt")}
        </label>
        <textarea
          value={values.promptText}
          onChange={(e) => onChange({ promptText: e.target.value })}
          placeholder={t("taskPromptPlaceholder")}
          rows={3}
          className="w-full bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3.5 py-2.5 text-body text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms] resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-small text-ghost-text-muted">
          {t("taskSchedule")}
        </label>
        <div className="flex flex-wrap gap-2">
          {scheduleOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ scheduleType: opt.value })}
              className={`px-3.5 py-2 rounded-full text-small font-medium border transition-colors duration-[100ms] ${
                values.scheduleType === opt.value
                  ? "bg-ghost-accent text-ghost-bg border-ghost-accent"
                  : "bg-transparent text-ghost-text-secondary border-ghost-border-subtle hover:bg-ghost-surface-hover"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {values.scheduleType === "once" && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-small text-ghost-text-muted">
              {t("taskRunAt")}
            </label>
            <input
              type="datetime-local"
              value={values.runAt}
              onChange={(e) => onChange({ runAt: e.target.value })}
              className="w-full min-h-[44px] bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3.5 py-2.5 text-body text-ghost-text-primary focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms]"
              dir="ltr"
            />
          </div>
        )}
        {values.scheduleType === "interval" && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-small text-ghost-text-muted">
              {t("taskEveryMinutes")}
              <span className="ms-2 text-ghost-text-muted/70">
                ({t("taskIntervalHint")})
              </span>
            </label>
            <input
              type="number"
              min={45}
              max={86400}
              step={5}
              value={values.intervalSeconds}
              onChange={(e) =>
                onChange({ intervalSeconds: Number(e.target.value) || 45 })
              }
              className="w-full min-h-[44px] bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3.5 py-2.5 text-body text-ghost-text-primary focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms]"
              dir="ltr"
            />
          </div>
        )}
        {values.scheduleType === "daily" && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-small text-ghost-text-muted">
              {t("taskDailyAt")}
            </label>
            <input
              type="time"
              value={values.dailyTime}
              onChange={(e) => onChange({ dailyTime: e.target.value })}
              className="w-full min-h-[44px] bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3.5 py-2.5 text-body text-ghost-text-primary focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms]"
              dir="ltr"
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2.5 text-body text-ghost-text-primary cursor-pointer select-none">
        <input
          type="checkbox"
          checked={values.includeCamera}
          onChange={(e) => onChange({ includeCamera: e.target.checked })}
          className="w-4 h-4 accent-ghost-accent"
        />
        {t("taskIncludeCamera")}
      </label>
    </>
  );
}
