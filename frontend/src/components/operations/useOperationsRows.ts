import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore } from "../../stores/conversationStore";
import { useTaskStore } from "../../stores/taskStore";
import { useAlertStore } from "../../stores/alertStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useUserStore } from "../../stores/userStore";
import { assignmentFor } from "../../utils/conversationGroups";
import type { AlertRule, ScheduledTask } from "../../types/api";

export type OperationKind = "task" | "alert";

/** Shared location/ownership fields every operations row carries. */
interface OperationRowBase {
  id: string;
  conversationId: string;
  conversationTitle: string;
  areaId: string | null;
  areaName: string | null;
  groupId: string | null;
  groupName: string | null;
  isActive: boolean;
}

export interface TaskOperationRow extends OperationRowBase {
  kind: "task";
  task: ScheduledTask;
  runError: string | null;
}

export interface AlertOperationRow extends OperationRowBase {
  kind: "alert";
  rule: AlertRule;
  alertModeEnabled: boolean;
}

export type OperationRow = TaskOperationRow | AlertOperationRow;

/** Run async work over a list with a small concurrency cap so opening the
 *  page on an account with many conversations doesn't fan out hundreds of
 *  simultaneous requests. */
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
}

/**
 * Aggregates every scheduled task and standing alert rule across ALL of the
 * operator's conversations into a single flat list for the Operations table.
 *
 * Tasks and rules are cached per-conversation in their own stores, so this
 * hook drives a one-shot fan-out fetch (concurrency-capped) on mount / user
 * switch, then derives the unified rows from the live store state — meaning
 * any create/update/delete routed through the existing store actions reflects
 * here immediately without a manual refetch.
 */
export function useOperationsRows() {
  const conversations = useConversationStore((s) => s.conversations);
  const fetchConversations = useConversationStore((s) => s.fetchConversations);
  const activeUserId = useUserStore((s) => s.activeUserId);

  const tasks = useTaskStore((s) => s.tasks);
  const runErrors = useTaskStore((s) => s.runErrors);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);

  const rules = useAlertStore((s) => s.rules);
  const alertModeEnabled = useAlertStore((s) => s.alertModeEnabled);
  const fetchRules = useAlertStore((s) => s.fetchRules);

  const areas = useConversationGroupsStore((s) => s.areas);
  const groups = useConversationGroupsStore((s) => s.groups);
  const loadGroupsForUser = useConversationGroupsStore((s) => s.loadForUser);

  const [loading, setLoading] = useState(false);
  // Signature of the last (user, conversation-set) we ran a fan-out fetch for,
  // so re-renders from incoming store updates don't retrigger the fetch loop.
  const lastSignatureRef = useRef<string>("");

  // Make sure the conversation list and the (localStorage-backed) groups state
  // are loaded for the active operator even if the sidebar never mounted them.
  useEffect(() => {
    if (!activeUserId) return;
    if (conversations.length === 0) void fetchConversations(activeUserId);
    loadGroupsForUser(activeUserId);
  }, [activeUserId, conversations.length, fetchConversations, loadGroupsForUser]);

  const conversationIds = useMemo(
    () => conversations.map((c) => c.id),
    [conversations],
  );

  const refresh = useCallback(async () => {
    if (!activeUserId || conversationIds.length === 0) return;
    setLoading(true);
    try {
      await runPool(conversationIds, 4, async (conversationId) => {
        await Promise.all([
          fetchTasks(conversationId, activeUserId),
          fetchRules(conversationId, activeUserId),
        ]);
      });
    } finally {
      setLoading(false);
    }
  }, [activeUserId, conversationIds, fetchTasks, fetchRules]);

  useEffect(() => {
    if (!activeUserId) return;
    const signature = `${activeUserId}::${conversationIds.join(",")}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    void refresh();
  }, [activeUserId, conversationIds, refresh]);

  const rows = useMemo<OperationRow[]>(() => {
    const groupsState = { areas, groups };
    const out: OperationRow[] = [];

    for (const conv of conversations) {
      const assignment = assignmentFor(conv.id, groupsState);
      const area = assignment.areaId
        ? (areas.find((a) => a.id === assignment.areaId) ?? null)
        : null;
      const group = assignment.groupId
        ? (groups.find((g) => g.id === assignment.groupId) ?? null)
        : null;
      const location = {
        conversationId: conv.id,
        conversationTitle: conv.title,
        areaId: area?.id ?? null,
        areaName: area?.name ?? null,
        groupId: group?.id ?? null,
        groupName: group?.name ?? null,
      };

      for (const task of tasks[conv.id] ?? []) {
        out.push({
          kind: "task",
          id: task.id,
          ...location,
          isActive: task.is_active,
          task,
          runError: runErrors[task.id] ?? null,
        });
      }

      for (const rule of rules[conv.id] ?? []) {
        out.push({
          kind: "alert",
          id: rule.id,
          ...location,
          isActive: rule.is_active,
          rule,
          alertModeEnabled: !!alertModeEnabled[conv.id],
        });
      }
    }

    return out;
  }, [conversations, tasks, rules, runErrors, alertModeEnabled, areas, groups]);

  return { rows, loading, refresh };
}
