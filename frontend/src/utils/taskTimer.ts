import type { ScheduledTask } from "../types/api";

export interface ActiveTaskTiming {
  /** Number of active tasks in the conversation. */
  activeCount: number;
  /** The active task with the earliest upcoming run (null when none are
   *  scheduled). */
  next: ScheduledTask | null;
  /** Epoch ms of the next run, or null. */
  nextRunAtMs: number | null;
}

/** Pick the next-to-run active task by earliest ``next_run_at``. Pure +
 *  timezone-safe (compares absolute epoch ms), so it is unit-testable without
 *  a DOM. Paused tasks and tasks without a scheduled run are ignored for the
 *  "next" pick but paused tasks are still excluded from the active count. */
export function selectActiveTaskTiming(
  tasks: ScheduledTask[],
): ActiveTaskTiming {
  let activeCount = 0;
  let next: ScheduledTask | null = null;
  let nextMs: number | null = null;
  for (const task of tasks) {
    if (!task.is_active) continue;
    activeCount += 1;
    if (!task.next_run_at) continue;
    const ms = new Date(task.next_run_at).getTime();
    if (Number.isNaN(ms)) continue;
    if (nextMs === null || ms < nextMs) {
      nextMs = ms;
      next = task;
    }
  }
  return { activeCount, next, nextRunAtMs: nextMs };
}

/** Format a remaining duration as ``mm:ss`` (or ``h:mm:ss`` past an hour).
 *  Clamps to ``00:00`` once due. */
export function formatCountdown(ms: number): string {
  const totalSec = ms <= 0 ? 0 : Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Whether a task produces a PDF report on a match (active ``report``
 *  trigger). */
export function taskHasReportTrigger(task: ScheduledTask): boolean {
  return (task.triggers ?? []).some(
    (tr) => tr.is_active && tr.alert_kind === "report",
  );
}
