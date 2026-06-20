import { create } from "zustand";
import type { ScheduledTask, TaskReport, TaskTrigger } from "../types/api";
import { api } from "../api/client";
import { sanitizeBrand } from "../utils/sanitize";
import { useConversationStore } from "./conversationStore";
import { useConversationActivityStore } from "./conversationActivityStore";
import { useMessageStore } from "./messageStore";
import { useUserStore } from "./userStore";

export interface CreateTaskInput {
  name: string;
  prompt_text: string;
  schedule_type: "once" | "interval" | "daily";
  run_at?: string;
  interval_seconds?: number;
  daily_time?: string;
  include_camera?: boolean;
}

interface TaskState {
  /** Per-conversation tasks cache (each task carries its triggers). */
  tasks: Record<string, ScheduledTask[]>;
  /** Per-conversation downloadable report records. */
  reports: Record<string, TaskReport[]>;
  /** Per-conversation loading flag. */
  loading: Record<string, boolean>;
  /** Per-task run-failure note (set by the task engine for the panel). */
  runErrors: Record<string, string | null>;
  /** Latest user-facing error. */
  error: string | null;

  fetchTasks: (conversationId: string, userId: string) => Promise<void>;
  createTask: (
    conversationId: string,
    userId: string,
    data: CreateTaskInput,
  ) => Promise<ScheduledTask | null>;
  updateTask: (
    taskId: string,
    userId: string,
    data: Partial<CreateTaskInput> & { is_active?: boolean },
  ) => Promise<void>;
  deleteTask: (taskId: string, userId: string) => Promise<void>;

  addTrigger: (
    taskId: string,
    userId: string,
    phrase: string,
    alertKind: "critical" | "report",
  ) => Promise<TaskTrigger | null>;
  updateTrigger: (
    triggerId: string,
    userId: string,
    data: Partial<{
      phrase: string;
      alert_kind: "critical" | "report";
      is_active: boolean;
    }>,
  ) => Promise<void>;
  deleteTrigger: (triggerId: string, userId: string) => Promise<void>;

  fetchReports: (conversationId: string, userId: string) => Promise<void>;
  getReportById: (reportId: string) => TaskReport | null;

  /** Internal: SSE push of a freshly created report. */
  _receiveTaskReport: (payload: {
    report: TaskReport;
    conversation_id: string;
  }) => void;
  /** Internal: task engine marks claim/run state for the panel. */
  _applyClaimedTask: (task: ScheduledTask) => void;
  _setRunError: (taskId: string, message: string | null) => void;

  clearError: () => void;
}

function findConversationIdForTask(
  tasks: Record<string, ScheduledTask[]>,
  taskId: string,
): string | null {
  for (const [convId, list] of Object.entries(tasks)) {
    if (list.some((t) => t.id === taskId)) return convId;
  }
  return null;
}

function findConversationIdForTrigger(
  tasks: Record<string, ScheduledTask[]>,
  triggerId: string,
): { conversationId: string; taskId: string } | null {
  for (const [convId, list] of Object.entries(tasks)) {
    for (const task of list) {
      if ((task.triggers ?? []).some((tr) => tr.id === triggerId)) {
        return { conversationId: convId, taskId: task.id };
      }
    }
  }
  return null;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},
  reports: {},
  loading: {},
  runErrors: {},
  error: null,

  fetchTasks: async (conversationId, userId) => {
    set((s) => ({ loading: { ...s.loading, [conversationId]: true } }));
    const res = await api.listTasks(conversationId, userId);
    if (res.ok && res.data) {
      set((s) => ({
        tasks: { ...s.tasks, [conversationId]: res.data! },
        loading: { ...s.loading, [conversationId]: false },
      }));
    } else {
      set((s) => ({
        loading: { ...s.loading, [conversationId]: false },
        error: sanitizeBrand(res.error?.message ?? "Failed to load tasks"),
      }));
    }
  },

  createTask: async (conversationId, userId, data) => {
    const res = await api.createTask(conversationId, userId, data);
    if (res.ok && res.data) {
      set((s) => ({
        tasks: {
          ...s.tasks,
          [conversationId]: [...(s.tasks[conversationId] ?? []), res.data!],
        },
      }));
      return res.data;
    }
    set({
      error: sanitizeBrand(res.error?.message ?? "Failed to create task"),
    });
    return null;
  },

  updateTask: async (taskId, userId, data) => {
    const conversationId = findConversationIdForTask(get().tasks, taskId);
    if (!conversationId) return;
    const res = await api.updateTask(taskId, userId, data);
    if (res.ok && res.data) {
      set((s) => ({
        tasks: {
          ...s.tasks,
          [conversationId]: (s.tasks[conversationId] ?? []).map((t) =>
            t.id === taskId
              ? { ...res.data!, triggers: res.data!.triggers ?? t.triggers }
              : t,
          ),
        },
      }));
    } else {
      set({
        error: sanitizeBrand(res.error?.message ?? "Failed to update task"),
      });
    }
  },

  deleteTask: async (taskId, userId) => {
    const conversationId = findConversationIdForTask(get().tasks, taskId);
    if (!conversationId) return;
    const previous = get().tasks[conversationId] ?? [];
    set((s) => ({
      tasks: {
        ...s.tasks,
        [conversationId]: previous.filter((t) => t.id !== taskId),
      },
    }));
    const res = await api.deleteTask(taskId, userId);
    if (!res.ok) {
      set((s) => ({
        tasks: { ...s.tasks, [conversationId]: previous },
        error: sanitizeBrand(res.error?.message ?? "Failed to delete task"),
      }));
    }
  },

  addTrigger: async (taskId, userId, phrase, alertKind) => {
    const conversationId = findConversationIdForTask(get().tasks, taskId);
    if (!conversationId) return null;
    const trimmed = phrase.trim();
    if (!trimmed) return null;
    const res = await api.createTaskTrigger(
      taskId,
      userId,
      trimmed,
      alertKind,
    );
    if (res.ok && res.data) {
      set((s) => ({
        tasks: {
          ...s.tasks,
          [conversationId]: (s.tasks[conversationId] ?? []).map((t) =>
            t.id === taskId
              ? { ...t, triggers: [...(t.triggers ?? []), res.data!] }
              : t,
          ),
        },
      }));
      return res.data;
    }
    set({
      error: sanitizeBrand(res.error?.message ?? "Failed to create trigger"),
    });
    return null;
  },

  updateTrigger: async (triggerId, userId, data) => {
    const found = findConversationIdForTrigger(get().tasks, triggerId);
    if (!found) return;
    const { conversationId, taskId } = found;

    set((s) => ({
      tasks: {
        ...s.tasks,
        [conversationId]: (s.tasks[conversationId] ?? []).map((t) =>
          t.id === taskId
            ? {
                ...t,
                triggers: (t.triggers ?? []).map((tr) =>
                  tr.id === triggerId ? { ...tr, ...data } : tr,
                ),
              }
            : t,
        ),
      },
    }));

    const res = await api.updateTaskTrigger(triggerId, userId, data);
    if (res.ok && res.data) {
      set((s) => ({
        tasks: {
          ...s.tasks,
          [conversationId]: (s.tasks[conversationId] ?? []).map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  triggers: (t.triggers ?? []).map((tr) =>
                    tr.id === triggerId ? res.data! : tr,
                  ),
                }
              : t,
          ),
        },
      }));
    } else if (!res.ok) {
      set({
        error: sanitizeBrand(res.error?.message ?? "Failed to update trigger"),
      });
    }
  },

  deleteTrigger: async (triggerId, userId) => {
    const found = findConversationIdForTrigger(get().tasks, triggerId);
    if (!found) return;
    const { conversationId, taskId } = found;
    const previous = get().tasks[conversationId] ?? [];
    set((s) => ({
      tasks: {
        ...s.tasks,
        [conversationId]: previous.map((t) =>
          t.id === taskId
            ? {
                ...t,
                triggers: (t.triggers ?? []).filter(
                  (tr) => tr.id !== triggerId,
                ),
              }
            : t,
        ),
      },
    }));
    const res = await api.deleteTaskTrigger(triggerId, userId);
    if (!res.ok) {
      set((s) => ({
        tasks: { ...s.tasks, [conversationId]: previous },
        error: sanitizeBrand(res.error?.message ?? "Failed to delete trigger"),
      }));
    }
  },

  fetchReports: async (conversationId, userId) => {
    const res = await api.listTaskReports(conversationId, userId);
    if (res.ok && res.data) {
      set((s) => ({
        reports: { ...s.reports, [conversationId]: res.data! },
      }));
    }
  },

  getReportById: (reportId) => {
    for (const list of Object.values(get().reports)) {
      const found = list.find((r) => r.id === reportId);
      if (found) return found;
    }
    return null;
  },

  _receiveTaskReport: (payload) => {
    const { report, conversation_id } = payload;
    set((s) => {
      const existing = s.reports[conversation_id] ?? [];
      if (existing.some((r) => r.id === report.id)) return s;
      return {
        ...s,
        reports: {
          ...s.reports,
          [conversation_id]: [report, ...existing],
        },
      };
    });
    // Drop the transient "preparing PDF report" card now that the real one
    // exists (also covered by fetchMessages below when the chat is open).
    if (report.task_id) {
      useMessageStore.getState().clearPreparingReport(report.task_id);
    }

    // Bump the conversation to the top and flag a distinct "PDF report ready"
    // unread state (unless the operator is already viewing it).
    useConversationActivityStore
      .getState()
      .markActivity(conversation_id, "report");

    // Surface the report card in the open chat immediately.
    const activeUserId = useUserStore.getState().activeUserId;
    const activeConvId = useConversationStore.getState().activeConversationId;
    if (activeUserId && activeConvId === conversation_id) {
      useMessageStore.getState().fetchMessages(conversation_id, activeUserId);
    }
  },

  _applyClaimedTask: (task) => {
    set((s) => {
      const list = s.tasks[task.conversation_id];
      if (!list) return s;
      return {
        ...s,
        tasks: {
          ...s.tasks,
          [task.conversation_id]: list.map((t) =>
            t.id === task.id ? { ...task, triggers: t.triggers } : t,
          ),
        },
      };
    });
  },

  _setRunError: (taskId, message) => {
    set((s) => ({
      runErrors: { ...s.runErrors, [taskId]: message },
    }));
  },

  clearError: () => set({ error: null }),
}));
