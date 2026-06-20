import { useEffect, useState } from "react";
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Clock,
  Loader2,
  BellRing,
  FileText,
} from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useTaskStore } from "../../stores/taskStore";
import { useUserStore } from "../../stores/userStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import { confirmDialog, toast } from "../../stores/feedbackStore";
import { formatInterval } from "../../utils/taskSchedule";
import {
  EMPTY_TASK_FORM,
  isoToLocalInput,
  TaskFormFields,
  type TaskFieldValues,
} from "./taskForm";
import type { ScheduledTask, TaskScheduleType, TaskTrigger } from "../../types/api";

interface TasksPanelProps {
  onClose: () => void;
}

function formatTimestamp(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale === "he" ? "he-IL" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scheduleSummary(
  task: ScheduledTask,
  t: ReturnType<typeof useT>,
  locale: string,
): string {
  if (task.schedule_type === "once") {
    const ts = formatTimestamp(task.run_at, locale);
    return `${t("taskScheduleOnce")}${ts ? ` · ${ts}` : ""}`;
  }
  if (task.schedule_type === "interval") {
    return formatInterval(task.interval_seconds, locale);
  }
  return `${t("taskScheduleDaily")} · ${task.daily_time ?? "?"}`;
}

export default function TasksPanel({ onClose }: TasksPanelProps) {
  const { activeConversationId } = useConversationStore();
  const { activeUserId, sessionType } = useUserStore();
  const locale = useLanguageStore((s) => s.locale);
  const t = useT();
  const {
    tasks,
    loading,
    runErrors,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    addTrigger,
    updateTrigger,
    deleteTrigger,
    clearError,
  } = useTaskStore();

  const isTrial = sessionType === "trial";
  const conversationTasks = activeConversationId
    ? (tasks[activeConversationId] ?? [])
    : [];
  const isLoading = activeConversationId
    ? !!loading[activeConversationId]
    : false;

  // --- New task form state ---
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TaskFieldValues>(EMPTY_TASK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Inline edit state (per-task) ---
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TaskFieldValues>(EMPTY_TASK_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Per-task new-trigger inputs.
  const [triggerDrafts, setTriggerDrafts] = useState<
    Record<string, { phrase: string; kind: "critical" | "report" }>
  >({});

  useEffect(() => {
    if (!activeConversationId || !activeUserId || isTrial) return;
    fetchTasks(activeConversationId, activeUserId);
  }, [activeConversationId, activeUserId, isTrial, fetchTasks]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const patchForm = (patch: Partial<TaskFieldValues>) =>
    setForm((s) => ({ ...s, ...patch }));

  const patchEditForm = (patch: Partial<TaskFieldValues>) =>
    setEditForm((s) => ({ ...s, ...patch }));

  const resetForm = () => {
    setForm(EMPTY_TASK_FORM);
    setFormError(null);
  };

  const handleCreate = async () => {
    if (!activeConversationId || !activeUserId) return;
    setFormError(null);
    if (!form.name.trim() || !form.promptText.trim()) return;
    if (form.scheduleType === "once" && !form.runAt) {
      setFormError(t("taskRunAt"));
      return;
    }
    if (form.scheduleType === "interval" && form.intervalSeconds < 45) {
      setFormError(t("taskIntervalHint"));
      return;
    }
    setSubmitting(true);
    const created = await createTask(activeConversationId, activeUserId, {
      name: form.name.trim(),
      prompt_text: form.promptText.trim(),
      schedule_type: form.scheduleType,
      run_at:
        form.scheduleType === "once" && form.runAt
          ? new Date(form.runAt).toISOString()
          : undefined,
      interval_seconds:
        form.scheduleType === "interval" ? form.intervalSeconds : undefined,
      daily_time: form.scheduleType === "daily" ? form.dailyTime : undefined,
      include_camera: form.includeCamera,
    });
    setSubmitting(false);
    if (created) {
      resetForm();
      setShowForm(false);
    }
  };

  const startEdit = (task: ScheduledTask) => {
    setEditError(null);
    setEditingTaskId(task.id);
    setEditForm({
      name: task.name,
      promptText: task.prompt_text,
      scheduleType: task.schedule_type,
      runAt: isoToLocalInput(task.run_at),
      intervalSeconds: task.interval_seconds ?? 60,
      dailyTime: task.daily_time ?? "08:00",
      includeCamera: task.include_camera,
    });
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditError(null);
  };

  const handleSaveEdit = async (taskId: string) => {
    if (!activeUserId) return;
    setEditError(null);
    if (!editForm.name.trim() || !editForm.promptText.trim()) return;
    if (editForm.scheduleType === "once" && !editForm.runAt) {
      setEditError(t("taskRunAt"));
      return;
    }
    if (editForm.scheduleType === "interval" && editForm.intervalSeconds < 45) {
      setEditError(t("taskIntervalHint"));
      return;
    }
    setEditSubmitting(true);
    await updateTask(taskId, activeUserId, {
      name: editForm.name.trim(),
      prompt_text: editForm.promptText.trim(),
      schedule_type: editForm.scheduleType,
      run_at:
        editForm.scheduleType === "once" && editForm.runAt
          ? new Date(editForm.runAt).toISOString()
          : undefined,
      interval_seconds:
        editForm.scheduleType === "interval"
          ? editForm.intervalSeconds
          : undefined,
      daily_time:
        editForm.scheduleType === "daily" ? editForm.dailyTime : undefined,
      include_camera: editForm.includeCamera,
    });
    setEditSubmitting(false);
    setEditingTaskId(null);
  };

  const handleToggleTask = (task: ScheduledTask) => {
    if (!activeUserId) return;
    void updateTask(task.id, activeUserId, { is_active: !task.is_active });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeUserId) return;
    const ok = await confirmDialog({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteGeneric"),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;
    if (editingTaskId === taskId) setEditingTaskId(null);
    await deleteTask(taskId, activeUserId);
    toast.success(t("actionDeleted"));
  };

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!activeUserId) return;
    const ok = await confirmDialog({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteGeneric"),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;
    await deleteTrigger(triggerId, activeUserId);
    toast.success(t("actionDeleted"));
  };

  const draftFor = (taskId: string) =>
    triggerDrafts[taskId] ?? { phrase: "", kind: "critical" as const };

  const setDraft = (
    taskId: string,
    patch: Partial<{ phrase: string; kind: "critical" | "report" }>,
  ) => {
    setTriggerDrafts((s) => ({
      ...s,
      [taskId]: { ...draftFor(taskId), ...patch },
    }));
  };

  const handleAddTrigger = async (taskId: string) => {
    if (!activeUserId) return;
    const draft = draftFor(taskId);
    if (!draft.phrase.trim()) return;
    const created = await addTrigger(
      taskId,
      activeUserId,
      draft.phrase,
      draft.kind,
    );
    if (created) setDraft(taskId, { phrase: "" });
  };

  const handleTriggerKind = (
    trigger: TaskTrigger,
    kind: "critical" | "report",
  ) => {
    if (!activeUserId || trigger.alert_kind === kind) return;
    void updateTrigger(trigger.id, activeUserId, { alert_kind: kind });
  };

  const scheduleOptions: Array<{ value: TaskScheduleType; label: string }> = [
    { value: "once", label: t("taskScheduleOnce") },
    { value: "interval", label: t("taskScheduleInterval") },
    { value: "daily", label: t("taskScheduleDaily") },
  ];

  return (
    <aside className="w-[420px] max-w-[100vw] flex-shrink-0 bg-ghost-bg-secondary border-s border-ghost-border-subtle h-screen flex flex-col slide-in-right">
      <div className="flex items-center justify-between px-5 py-4 border-b border-ghost-border-subtle">
        <div className="flex items-center gap-3 min-w-0">
          <CalendarClock size={22} className="flex-shrink-0 text-ghost-accent" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-snug text-ghost-text-primary truncate">
              {t("tasksPanelTitle")}
            </h2>
            <span className="block font-mono text-[9px] tracking-[0.22em] uppercase text-ghost-text-muted">
              Ghost // Tasks
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          aria-label="Close tasks panel"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <p className="text-small text-ghost-text-secondary leading-relaxed">
          {t("tasksDescription")}
        </p>

        {isTrial ? (
          <p className="flex items-start gap-2 text-small text-yellow-600 leading-relaxed">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{t("taskTrialBlocked")}</span>
          </p>
        ) : (
          <>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-ghost-border-subtle bg-ghost-surface text-body font-medium text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
              >
                <Plus size={18} />
                {t("taskAdd")}
              </button>
            ) : (
              <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 py-4 space-y-4">
                <TaskFormFields
                  values={form}
                  onChange={patchForm}
                  t={t}
                  scheduleOptions={scheduleOptions}
                />

                {formError && (
                  <p className="flex items-start gap-2 text-small text-ghost-error leading-relaxed">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{formError}</span>
                  </p>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    onClick={handleCreate}
                    disabled={
                      !form.name.trim() || !form.promptText.trim() || submitting
                    }
                    className="flex-1 min-h-[44px] rounded-xl bg-ghost-accent text-ghost-bg text-body font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 size={16} className="animate-spin" />}
                    {t("taskCreate")}
                  </button>
                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                    className="min-h-[44px] px-4 rounded-xl border border-ghost-border-subtle text-body text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                  >
                    {t("taskCancel")}
                  </button>
                </div>
              </div>
            )}

            {isLoading && conversationTasks.length === 0 ? (
              <p className="text-ghost-text-muted text-body text-center py-8">
                {t("loading")}
              </p>
            ) : conversationTasks.length === 0 && !showForm ? (
              <div className="text-center py-10 px-2">
                <CalendarClock
                  size={40}
                  className="text-ghost-text-muted mx-auto mb-4 opacity-50"
                />
                <p className="text-ghost-text-secondary text-body leading-relaxed">
                  {t("tasksEmpty")}
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {conversationTasks.map((task) => {
                  const triggers = task.triggers ?? [];
                  const draft = draftFor(task.id);
                  const runError = runErrors[task.id];
                  const isEditing = editingTaskId === task.id;
                  const isExhaustedOnce =
                    task.schedule_type === "once" &&
                    !task.is_active &&
                    !!task.last_run_at;
                  return (
                    <li
                      key={task.id}
                      className={`rounded-2xl border px-4 py-4 space-y-3.5 transition-colors duration-[100ms] ${
                        task.is_active
                          ? "border-ghost-border-subtle bg-ghost-surface"
                          : "border-ghost-border-subtle bg-ghost-surface/40 opacity-80"
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-4">
                          <TaskFormFields
                            values={editForm}
                            onChange={patchEditForm}
                            t={t}
                            scheduleOptions={scheduleOptions}
                          />

                          {editError && (
                            <p className="flex items-start gap-2 text-small text-ghost-error leading-relaxed">
                              <AlertCircle
                                size={16}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <span>{editError}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-2.5 pt-1">
                            <button
                              onClick={() => void handleSaveEdit(task.id)}
                              disabled={
                                !editForm.name.trim() ||
                                !editForm.promptText.trim() ||
                                editSubmitting
                              }
                              className="flex-1 min-h-[44px] rounded-xl bg-ghost-accent text-ghost-bg text-body font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                            >
                              {editSubmitting && (
                                <Loader2 size={16} className="animate-spin" />
                              )}
                              {t("taskSave")}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="min-h-[44px] px-4 rounded-xl border border-ghost-border-subtle text-body text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                            >
                              {t("taskCancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-body font-semibold text-ghost-text-primary leading-snug break-words">
                                {task.name}
                              </p>
                              <p className="text-small text-ghost-text-secondary mt-1 leading-relaxed break-words line-clamp-2">
                                {task.prompt_text}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleToggleTask(task)}
                                className={`w-12 h-7 rounded-full relative transition-colors duration-[160ms] ${
                                  task.is_active
                                    ? "bg-green-700"
                                    : "bg-ghost-border-subtle"
                                }`}
                                aria-label={
                                  task.is_active
                                    ? t("taskActive")
                                    : t("taskPaused")
                                }
                              >
                                <span
                                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-[160ms] ${
                                    task.is_active ? "end-0.5" : "start-0.5"
                                  }`}
                                />
                              </button>
                              <button
                                onClick={() => startEdit(task)}
                                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                                aria-label={t("taskEdit")}
                                title={t("taskEdit")}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-ghost-text-muted hover:text-ghost-error hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                                aria-label={t("taskDelete")}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-small text-ghost-text-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock size={13} className="flex-shrink-0" />
                              {scheduleSummary(task, t, locale)}
                            </span>
                            {isExhaustedOnce ? (
                              <span>{t("taskDone")}</span>
                            ) : (
                              task.next_run_at && (
                                <span>
                                  {t("taskNextRun")}:{" "}
                                  {formatTimestamp(task.next_run_at, locale)}
                                </span>
                              )
                            )}
                            <span>
                              {t("taskLastRun")}:{" "}
                              {formatTimestamp(task.last_run_at, locale) ??
                                t("taskNever")}
                            </span>
                          </div>

                          {runError && (
                            <p className="flex items-start gap-2 text-small text-ghost-error leading-relaxed">
                              <AlertCircle
                                size={15}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <span>
                                {t("taskRunError")}: {runError}
                              </span>
                            </p>
                          )}
                        </>
                      )}

                      <div className="pt-1 border-t border-ghost-border-subtle/50 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
                            Triggers
                          </span>
                          <span className="text-small text-ghost-text-muted tabular-nums">
                            {triggers.length}
                          </span>
                        </div>
                        <p className="text-[12px] text-ghost-text-muted leading-relaxed">
                          {t("taskTriggersHint")}
                        </p>

                        {triggers.length > 0 && (
                          <ul className="space-y-2">
                            {triggers.map((trigger) => (
                              <li
                                key={trigger.id}
                                className="flex items-center gap-2 rounded-xl border border-ghost-border-subtle bg-ghost-bg px-3 py-2"
                              >
                                <p className="flex-1 min-w-0 text-small text-ghost-text-primary break-words">
                                  {trigger.phrase}
                                </p>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() =>
                                      handleTriggerKind(trigger, "critical")
                                    }
                                    title={t("taskTriggerKindCritical")}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors duration-[100ms] ${
                                      trigger.alert_kind === "critical"
                                        ? "border-ghost-error/60 bg-ghost-error/10 text-ghost-error"
                                        : "border-ghost-border-subtle text-ghost-text-muted hover:bg-ghost-surface-hover"
                                    }`}
                                  >
                                    <BellRing size={11} />
                                    {t("taskTriggerKindCritical")}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleTriggerKind(trigger, "report")
                                    }
                                    title={t("taskTriggerKindReport")}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors duration-[100ms] ${
                                      trigger.alert_kind === "report"
                                        ? "border-ghost-accent/60 bg-ghost-accent/10 text-ghost-text-primary"
                                        : "border-ghost-border-subtle text-ghost-text-muted hover:bg-ghost-surface-hover"
                                    }`}
                                  >
                                    <FileText size={11} />
                                    {t("taskTriggerKindReport")}
                                  </button>
                                  <button
                                    onClick={() =>
                                      void handleDeleteTrigger(trigger.id)
                                    }
                                    className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-ghost-text-muted hover:text-ghost-error transition-colors duration-[100ms]"
                                    aria-label={t("taskTriggerDelete")}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex items-stretch gap-2">
                          <input
                            type="text"
                            value={draft.phrase}
                            onChange={(e) =>
                              setDraft(task.id, { phrase: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                void handleAddTrigger(task.id);
                              }
                            }}
                            placeholder={t("taskTriggerPlaceholder")}
                            className="flex-1 min-w-0 min-h-[40px] bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3 py-2 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms]"
                          />
                          <button
                            onClick={() =>
                              setDraft(task.id, {
                                kind:
                                  draft.kind === "critical"
                                    ? "report"
                                    : "critical",
                              })
                            }
                            title={
                              draft.kind === "critical"
                                ? t("taskTriggerKindCritical")
                                : t("taskTriggerKindReport")
                            }
                            className={`min-h-[40px] px-2.5 rounded-xl border text-[11px] font-medium inline-flex items-center gap-1 transition-colors duration-[100ms] flex-shrink-0 ${
                              draft.kind === "critical"
                                ? "border-ghost-error/60 bg-ghost-error/10 text-ghost-error"
                                : "border-ghost-accent/60 bg-ghost-accent/10 text-ghost-text-primary"
                            }`}
                          >
                            {draft.kind === "critical" ? (
                              <BellRing size={12} />
                            ) : (
                              <FileText size={12} />
                            )}
                          </button>
                          <button
                            onClick={() => void handleAddTrigger(task.id)}
                            disabled={!draft.phrase.trim()}
                            className="min-w-[40px] min-h-[40px] rounded-xl bg-ghost-accent text-ghost-bg inline-flex items-center justify-center hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                            aria-label={t("taskTriggerAdd")}
                          >
                            <Plus size={17} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-ghost-error/40 bg-ghost-error/5 px-4 py-3">
            <AlertCircle
              size={18}
              className="flex-shrink-0 text-ghost-error mt-0.5"
            />
            <p className="flex-1 text-small text-ghost-error leading-relaxed">
              {error}
            </p>
            <button
              onClick={clearError}
              className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-ghost-error/60 hover:text-ghost-error rounded-xl"
              aria-label="Dismiss error"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
