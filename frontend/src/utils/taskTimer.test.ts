import { describe, it, expect } from "vitest";
import type { ScheduledTask, TaskTrigger } from "../types/api";
import {
  formatCountdown,
  selectActiveTaskTiming,
  taskHasReportTrigger,
} from "./taskTimer";

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: overrides.id ?? "t1",
    conversation_id: "c1",
    name: overrides.name ?? "Task",
    prompt_text: "p",
    schedule_type: "interval",
    run_at: null,
    interval_seconds: 60,
    daily_time: null,
    include_camera: true,
    is_active: overrides.is_active ?? true,
    last_run_at: null,
    next_run_at: overrides.next_run_at ?? null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    triggers: overrides.triggers,
    ...overrides,
  };
}

function trigger(over: Partial<TaskTrigger> = {}): TaskTrigger {
  return {
    id: over.id ?? "tr1",
    task_id: "t1",
    phrase: "phrase",
    alert_kind: over.alert_kind ?? "report",
    is_active: over.is_active ?? true,
    alert_rule_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("selectActiveTaskTiming", () => {
  it("counts only active tasks", () => {
    const r = selectActiveTaskTiming([
      makeTask({ id: "a", is_active: true }),
      makeTask({ id: "b", is_active: false }),
      makeTask({ id: "c", is_active: true }),
    ]);
    expect(r.activeCount).toBe(2);
  });

  it("picks the next task by earliest next_run_at", () => {
    const soon = makeTask({ id: "soon", next_run_at: "2026-06-16T10:05:00.000Z" });
    const later = makeTask({ id: "later", next_run_at: "2026-06-16T10:30:00.000Z" });
    const r = selectActiveTaskTiming([later, soon]);
    expect(r.next?.id).toBe("soon");
    expect(r.nextRunAtMs).toBe(new Date("2026-06-16T10:05:00.000Z").getTime());
  });

  it("ignores paused tasks and tasks without a scheduled run for 'next'", () => {
    const paused = makeTask({
      id: "paused",
      is_active: false,
      next_run_at: "2026-06-16T09:00:00.000Z",
    });
    const noRun = makeTask({ id: "noRun", next_run_at: null });
    const active = makeTask({ id: "active", next_run_at: "2026-06-16T10:00:00.000Z" });
    const r = selectActiveTaskTiming([paused, noRun, active]);
    expect(r.activeCount).toBe(2); // noRun + active are active
    expect(r.next?.id).toBe("active");
  });

  it("returns no next when nothing is scheduled", () => {
    const r = selectActiveTaskTiming([makeTask({ next_run_at: null })]);
    expect(r.next).toBeNull();
    expect(r.nextRunAtMs).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("formats mm:ss under an hour", () => {
    expect(formatCountdown(4 * 60_000 + 12_000)).toBe("04:12");
  });
  it("formats h:mm:ss past an hour", () => {
    expect(formatCountdown(3_600_000 + 5 * 60_000 + 9_000)).toBe("1:05:09");
  });
  it("clamps to 00:00 when due/negative", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5000)).toBe("00:00");
  });
});

describe("taskHasReportTrigger", () => {
  it("is true only when an active report trigger exists", () => {
    expect(
      taskHasReportTrigger(makeTask({ triggers: [trigger({ alert_kind: "report" })] })),
    ).toBe(true);
    expect(
      taskHasReportTrigger(makeTask({ triggers: [trigger({ alert_kind: "critical" })] })),
    ).toBe(false);
    expect(
      taskHasReportTrigger(
        makeTask({ triggers: [trigger({ alert_kind: "report", is_active: false })] }),
      ),
    ).toBe(false);
    expect(taskHasReportTrigger(makeTask({ triggers: undefined }))).toBe(false);
  });
});
