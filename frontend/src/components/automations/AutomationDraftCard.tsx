import { useEffect, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  Loader2,
  Power,
  X,
} from "lucide-react";
import { useAutomationStore } from "../../stores/automationStore";
import { useUserStore } from "../../stores/userStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import type {
  AutomationDraft,
  AutomationTaskPayload,
  TaskScheduleType,
} from "../../types/api";

interface AutomationDraftCardProps {
  draftId: string;
  conversationId: string;
}

interface TaskForm {
  name: string;
  prompt_text: string;
  schedule_type: TaskScheduleType;
  run_at: string;
  interval_seconds: number;
  daily_time: string;
  include_camera: boolean;
  is_check: boolean;
  report_phrase: string;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const FIELD_CLASS =
  "w-full bg-ghost-bg border border-ghost-border-subtle rounded-lg " +
  "px-2.5 py-1.5 text-[13px] text-ghost-text-primary " +
  "focus:outline-none focus:border-ghost-text-muted " +
  "transition-colors duration-[120ms]";

const LABEL_CLASS =
  "font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted";

export default function AutomationDraftCard({
  draftId,
  conversationId,
}: AutomationDraftCardProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const { activeUserId } = useUserStore();

  const draft = useAutomationStore((s): AutomationDraft | null => {
    for (const list of Object.values(s.drafts)) {
      const found = list.find((d) => d.id === draftId);
      if (found) return found;
    }
    return null;
  });
  const fetchDrafts = useAutomationStore((s) => s.fetchDrafts);
  const updateDraft = useAutomationStore((s) => s.updateDraft);
  const confirm = useAutomationStore((s) => s.confirm);
  const dismiss = useAutomationStore((s) => s.dismiss);

  const [alertText, setAlertText] = useState("");
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft && activeUserId && conversationId) {
      void fetchDrafts(conversationId, activeUserId);
    }
  }, [draft, activeUserId, conversationId, fetchDrafts]);

  // Seed the local edit form once from the draft payload.
  useEffect(() => {
    if (!draft) return;
    if (draft.kind === "alert" && draft.payload.kind === "alert") {
      setAlertText(draft.payload.description);
    } else if (draft.kind === "task" && draft.payload.kind === "task") {
      const p = draft.payload as AutomationTaskPayload;
      setTaskForm({
        name: p.name,
        prompt_text: p.prompt_text,
        schedule_type: p.schedule_type,
        run_at: isoToLocalInput(p.run_at),
        interval_seconds: p.interval_seconds ?? 60,
        daily_time: p.daily_time ?? "11:00",
        include_camera: p.include_camera,
        is_check: p.is_check,
        report_phrase: p.report_phrase ?? "",
      });
    }
    // Only re-seed when switching to a different draft id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, draft?.kind]);

  if (!draft) {
    return (
      <div
        className="max-w-[460px] rounded-2xl border border-ghost-border-subtle bg-ghost-surface/40 px-4 py-3 flex items-center gap-2"
        dir={dir}
      >
        <Loader2 size={14} className="animate-spin text-ghost-text-muted" />
        <span className="text-[13px] text-ghost-text-muted">…</span>
      </div>
    );
  }

  const isAlert = draft.kind === "alert";
  const editable = draft.status === "draft";

  const buildPayloadPatch = (): Record<string, unknown> => {
    if (isAlert) {
      return { description: alertText.trim() };
    }
    if (!taskForm) return {};
    return {
      name: taskForm.name.trim(),
      prompt_text: taskForm.prompt_text.trim(),
      schedule_type: taskForm.schedule_type,
      run_at:
        taskForm.schedule_type === "once"
          ? localInputToIso(taskForm.run_at)
          : null,
      interval_seconds:
        taskForm.schedule_type === "interval"
          ? Math.max(45, taskForm.interval_seconds)
          : null,
      daily_time:
        taskForm.schedule_type === "daily" ? taskForm.daily_time : null,
      include_camera: taskForm.include_camera,
      is_check: taskForm.is_check,
      report_phrase: taskForm.is_check ? taskForm.report_phrase.trim() : "",
    };
  };

  const handleConfirm = async (activate: boolean) => {
    if (!activeUserId || busy) return;
    setBusy(true);
    try {
      await updateDraft(draft.id, activeUserId, buildPayloadPatch());
      await confirm(draft.id, activeUserId, activate);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    if (!activeUserId || busy) return;
    setBusy(true);
    try {
      await dismiss(draft.id, activeUserId);
    } finally {
      setBusy(false);
    }
  };

  const statusLine = (() => {
    if (draft.status === "dismissed") return t("automationStatusDismissed");
    if (draft.status === "created") {
      if (isAlert) {
        return draft.activated
          ? t("automationStatusAlertActive")
          : t("automationStatusAlertSaved");
      }
      return draft.activated
        ? t("automationStatusTaskActive")
        : t("automationStatusTaskSaved");
    }
    return null;
  })();

  return (
    <div
      className="max-w-[460px] rounded-2xl border border-ghost-border-subtle bg-ghost-surface/60 overflow-hidden"
      dir={dir}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle/60">
        {isAlert ? (
          <Bell size={14} className="text-ghost-text-secondary flex-shrink-0" />
        ) : (
          <CalendarClock
            size={14}
            className="text-ghost-text-secondary flex-shrink-0"
          />
        )}
        <span className="text-[13px] font-semibold text-ghost-text-primary">
          {isAlert ? t("automationDraftAlertTitle") : t("automationDraftTaskTitle")}
        </span>
        <span className="ms-auto font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
          {t("automationDraftKicker")}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {isAlert ? (
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>{t("automationFieldAlertCondition")}</label>
            {editable ? (
              <textarea
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                rows={2}
                className={`${FIELD_CLASS} resize-none`}
                dir="auto"
              />
            ) : (
              <p className="text-[13px] text-ghost-text-primary leading-relaxed" dir="auto">
                {(draft.payload.kind === "alert" && draft.payload.description) || ""}
              </p>
            )}
          </div>
        ) : taskForm ? (
          <>
            <div className="space-y-1.5">
              <label className={LABEL_CLASS}>{t("automationFieldTaskName")}</label>
              {editable ? (
                <input
                  value={taskForm.name}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, name: e.target.value })
                  }
                  className={FIELD_CLASS}
                  dir="auto"
                />
              ) : (
                <p className="text-[13px] text-ghost-text-primary" dir="auto">
                  {taskForm.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className={LABEL_CLASS}>{t("automationFieldTaskPrompt")}</label>
              {editable ? (
                <textarea
                  value={taskForm.prompt_text}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, prompt_text: e.target.value })
                  }
                  rows={2}
                  className={`${FIELD_CLASS} resize-none`}
                  dir="auto"
                />
              ) : (
                <p className="text-[13px] text-ghost-text-secondary leading-relaxed" dir="auto">
                  {taskForm.prompt_text}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className={LABEL_CLASS}>{t("automationFieldSchedule")}</label>
              {editable ? (
                <div className="flex items-center gap-1.5">
                  {(["once", "interval", "daily"] as TaskScheduleType[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          setTaskForm({ ...taskForm, schedule_type: st })
                        }
                        className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors duration-[120ms] ${
                          taskForm.schedule_type === st
                            ? "bg-ghost-accent text-ghost-bg border-ghost-accent"
                            : "bg-ghost-bg text-ghost-text-secondary border-ghost-border-subtle hover:text-ghost-text-primary"
                        }`}
                      >
                        {st === "once"
                          ? t("automationScheduleOnce")
                          : st === "interval"
                            ? t("automationScheduleInterval")
                            : t("automationScheduleDaily")}
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-ghost-text-primary">
                  {taskForm.schedule_type === "once"
                    ? t("automationScheduleOnce")
                    : taskForm.schedule_type === "interval"
                      ? t("automationScheduleInterval")
                      : t("automationScheduleDaily")}
                </p>
              )}

              {editable && taskForm.schedule_type === "once" && (
                <input
                  type="datetime-local"
                  value={taskForm.run_at}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, run_at: e.target.value })
                  }
                  className={FIELD_CLASS}
                  dir="ltr"
                />
              )}
              {editable && taskForm.schedule_type === "interval" && (
                <div className="flex items-center gap-2">
                  <span className={LABEL_CLASS}>{t("automationFieldInterval")}</span>
                  <input
                    type="number"
                    min={45}
                    value={taskForm.interval_seconds}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        interval_seconds: Number(e.target.value) || 45,
                      })
                    }
                    className={`${FIELD_CLASS} w-24`}
                    dir="ltr"
                  />
                </div>
              )}
              {editable && taskForm.schedule_type === "daily" && (
                <input
                  type="time"
                  value={taskForm.daily_time}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, daily_time: e.target.value })
                  }
                  className={`${FIELD_CLASS} w-32`}
                  dir="ltr"
                />
              )}
            </div>

            {editable && (
              <>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={taskForm.include_camera}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        include_camera: e.target.checked,
                      })
                    }
                    className="accent-ghost-accent"
                  />
                  <span className="text-[12px] text-ghost-text-secondary">
                    {t("automationFieldIncludeCamera")}
                  </span>
                </label>

                {taskForm.is_check && (
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>{t("automationFieldReport")}</label>
                    <input
                      value={taskForm.report_phrase}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          report_phrase: e.target.value,
                        })
                      }
                      className={FIELD_CLASS}
                      dir="auto"
                    />
                  </div>
                )}
              </>
            )}
          </>
        ) : null}

        {statusLine && (
          <p
            className={`text-[12px] ${
              draft.status === "created"
                ? "text-ghost-success"
                : "text-ghost-text-muted"
            }`}
            dir="auto"
          >
            {statusLine}
          </p>
        )}
      </div>

      {editable && (
        <div className="px-4 pb-3.5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleConfirm(true)}
            disabled={busy}
            className="flex-1 min-w-[140px] min-h-[38px] inline-flex items-center justify-center gap-2 rounded-xl bg-ghost-accent text-ghost-bg text-[13px] font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Power size={14} />
            )}
            {t("automationConfirmActivate")}
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={busy}
            className="min-h-[38px] inline-flex items-center justify-center gap-2 rounded-xl border border-ghost-border-subtle bg-ghost-bg text-ghost-text-secondary px-3 text-[13px] hover:text-ghost-text-primary transition-colors duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={14} />
            {t("automationConfirmSaveOnly")}
          </button>
          <button
            onClick={handleDismiss}
            disabled={busy}
            aria-label={t("automationDismiss")}
            title={t("automationDismiss")}
            className="min-h-[38px] w-9 inline-flex items-center justify-center rounded-xl text-ghost-text-muted hover:text-ghost-error transition-colors duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
