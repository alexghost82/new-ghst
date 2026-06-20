import type { ScheduledTask } from "../types/api";

/** Render an interval cadence in the operator's language — whole minutes when
 *  the value divides evenly (e.g. 300s → "כל 5 דקות"), otherwise seconds.
 *  Single source of truth shared by the tasks panel and the report context. */
export function formatInterval(
  seconds: number | null,
  locale: string,
): string {
  if (!seconds || seconds <= 0) {
    return locale === "he" ? "כל ? שניות" : "Every ? sec";
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return locale === "he" ? `כל ${minutes} דקות` : `Every ${minutes} min`;
  }
  return locale === "he" ? `כל ${seconds} שניות` : `Every ${seconds} sec`;
}

/** Short type label for a task's schedule kind. */
export function taskTypeLabel(
  scheduleType: ScheduledTask["schedule_type"],
  locale: string,
): string {
  if (scheduleType === "once") return locale === "he" ? "חד-פעמי" : "Once";
  if (scheduleType === "daily") return locale === "he" ? "יומי" : "Daily";
  return locale === "he" ? "מחזורי" : "Interval";
}

/** The cadence detail of a task (when / how often it runs). */
export function taskScheduleDetail(
  task: ScheduledTask,
  locale: string,
): string {
  if (task.schedule_type === "once") {
    if (!task.run_at) return "";
    const d = new Date(task.run_at);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleString(locale === "en" ? "en-GB" : "he-IL");
  }
  if (task.schedule_type === "interval") {
    return formatInterval(task.interval_seconds, locale);
  }
  return task.daily_time ?? "";
}

/** Combined `{ type, schedule }` summary used by the PDF/report context. */
export function taskTypeSummary(
  task: ScheduledTask,
  locale: string,
): { type: string; schedule: string } {
  return {
    type: taskTypeLabel(task.schedule_type, locale),
    schedule: taskScheduleDetail(task, locale),
  };
}
