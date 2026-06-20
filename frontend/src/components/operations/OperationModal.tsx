import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BellRing, CalendarClock, Loader2, X } from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useTaskStore } from "../../stores/taskStore";
import { useAlertStore } from "../../stores/alertStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import {
  EMPTY_TASK_FORM,
  isoToLocalInput,
  TaskFormFields,
  type TaskFieldValues,
} from "../tasks/taskForm";
import type { TaskScheduleType } from "../../types/api";
import type { OperationKind, OperationRow } from "./useOperationsRows";

export type OperationModalState =
  | { mode: "add"; kind: OperationKind }
  | { mode: "edit"; row: OperationRow };

interface OperationModalProps {
  state: OperationModalState;
  onClose: () => void;
}

export default function OperationModal({ state, onClose }: OperationModalProps) {
  const t = useT();
  const activeUserId = useUserStore((s) => s.activeUserId);
  const conversations = useConversationStore((s) => s.conversations);
  const { createTask, updateTask } = useTaskStore();
  const { addRule, updateRule } = useAlertStore();

  const isEdit = state.mode === "edit";
  const kind: OperationKind = isEdit ? state.row.kind : state.kind;

  // Conversation is locked once an operation exists (no backend move path);
  // the picker is only for choosing where a brand-new operation lands.
  const [conversationId, setConversationId] = useState<string>(() => {
    if (isEdit) return state.row.conversationId;
    return conversations[0]?.id ?? "";
  });

  const [taskForm, setTaskForm] = useState<TaskFieldValues>(() => {
    if (isEdit && state.row.kind === "task") {
      const task = state.row.task;
      return {
        name: task.name,
        promptText: task.prompt_text,
        scheduleType: task.schedule_type,
        runAt: isoToLocalInput(task.run_at),
        intervalSeconds: task.interval_seconds ?? 60,
        dailyTime: task.daily_time ?? "08:00",
        includeCamera: task.include_camera,
      };
    }
    return EMPTY_TASK_FORM;
  });

  const [alertDescription, setAlertDescription] = useState<string>(() =>
    isEdit && state.row.kind === "alert" ? state.row.rule.description : "",
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const scheduleOptions: Array<{ value: TaskScheduleType; label: string }> = [
    { value: "once", label: t("taskScheduleOnce") },
    { value: "interval", label: t("taskScheduleInterval") },
    { value: "daily", label: t("taskScheduleDaily") },
  ];

  const patchTaskForm = (patch: Partial<TaskFieldValues>) =>
    setTaskForm((s) => ({ ...s, ...patch }));

  const conversationLabel = useMemo(
    () => conversations.find((c) => c.id === conversationId)?.title ?? "",
    [conversations, conversationId],
  );

  const canSubmit =
    !!activeUserId &&
    (isEdit || !!conversationId) &&
    (kind === "task"
      ? !!taskForm.name.trim() && !!taskForm.promptText.trim()
      : !!alertDescription.trim());

  const handleSubmit = async () => {
    if (!activeUserId || !canSubmit) return;
    setError(null);

    if (kind === "task") {
      if (taskForm.scheduleType === "once" && !taskForm.runAt) {
        setError(t("taskRunAt"));
        return;
      }
      if (
        taskForm.scheduleType === "interval" &&
        taskForm.intervalSeconds < 45
      ) {
        setError(t("taskIntervalHint"));
        return;
      }
      const payload = {
        name: taskForm.name.trim(),
        prompt_text: taskForm.promptText.trim(),
        schedule_type: taskForm.scheduleType,
        run_at:
          taskForm.scheduleType === "once" && taskForm.runAt
            ? new Date(taskForm.runAt).toISOString()
            : undefined,
        interval_seconds:
          taskForm.scheduleType === "interval"
            ? taskForm.intervalSeconds
            : undefined,
        daily_time:
          taskForm.scheduleType === "daily" ? taskForm.dailyTime : undefined,
        include_camera: taskForm.includeCamera,
      };
      setSubmitting(true);
      if (isEdit && state.row.kind === "task") {
        await updateTask(state.row.task.id, activeUserId, payload);
        setSubmitting(false);
        onClose();
      } else {
        const created = await createTask(conversationId, activeUserId, payload);
        setSubmitting(false);
        if (created) onClose();
      }
      return;
    }

    // Alert rule
    const description = alertDescription.trim();
    setSubmitting(true);
    if (isEdit && state.row.kind === "alert") {
      await updateRule(state.row.rule.id, activeUserId, { description });
      setSubmitting(false);
      onClose();
    } else {
      const created = await addRule(conversationId, activeUserId, description);
      setSubmitting(false);
      if (created) onClose();
    }
  };

  const title =
    kind === "task"
      ? isEdit
        ? t("taskEdit")
        : t("opAddTask")
      : isEdit
        ? t("opEditAlert")
        : t("opAddAlert");

  const monoLabel = kind === "task" ? "Ghost // Task" : "Ghost // Alert";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-ghost-bg/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-ghost-border-subtle bg-ghost-bg-secondary shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-ghost-border-subtle bg-ghost-bg-secondary">
          <div className="flex items-center gap-3 min-w-0">
            {kind === "task" ? (
              <CalendarClock
                size={20}
                className="flex-shrink-0 text-ghost-accent"
              />
            ) : (
              <BellRing size={20} className="flex-shrink-0 text-ghost-error" />
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-snug text-ghost-text-primary truncate">
                {title}
              </h2>
              <span className="block font-mono text-[9px] tracking-[0.22em] uppercase text-ghost-text-muted">
                {monoLabel}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label={t("taskCancel")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Conversation assignment: chosen on add, shown read-only on edit. */}
          <div className="space-y-1.5">
            <label className="block text-small text-ghost-text-muted">
              {t("opConversation")}
            </label>
            {isEdit ? (
              <p className="min-h-[44px] flex items-center rounded-xl border border-ghost-border-subtle bg-ghost-surface/40 px-3.5 text-body text-ghost-text-secondary break-words">
                {conversationLabel || "—"}
              </p>
            ) : conversations.length === 0 ? (
              <p className="text-small text-yellow-600 leading-relaxed">
                {t("opNoConversations")}
              </p>
            ) : (
              <select
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                className="w-full min-h-[44px] bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3.5 py-2.5 text-body text-ghost-text-primary focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms]"
              >
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {kind === "task" ? (
            <TaskFormFields
              values={taskForm}
              onChange={patchTaskForm}
              t={t}
              scheduleOptions={scheduleOptions}
            />
          ) : (
            <div className="space-y-1.5">
              <label className="block text-small text-ghost-text-muted">
                {t("opAlertDescription")}
              </label>
              <textarea
                value={alertDescription}
                onChange={(e) => setAlertDescription(e.target.value)}
                placeholder={t("alertRulePlaceholder")}
                rows={3}
                className="w-full bg-ghost-bg border border-ghost-border-subtle rounded-xl px-3.5 py-2.5 text-body text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent transition-colors duration-[100ms] resize-none"
              />
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-small text-ghost-error leading-relaxed">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || submitting}
              className="flex-1 min-h-[44px] rounded-xl bg-ghost-accent text-ghost-bg text-body font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? t("taskSave") : t("opCreate")}
            </button>
            <button
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-ghost-border-subtle text-body text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            >
              {t("taskCancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
