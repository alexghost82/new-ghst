/**
 * Scheduled-task engine (משימות) — browser-only scheduler.
 *
 * Runs entirely in the operator's browser, like the alert engine: when the
 * console is closed nothing runs (webcams only exist via getUserMedia while
 * a tab is open, so server-side scheduling would be pointless).
 *
 * Safety rules (see the plan's risk register):
 *  - SERIAL execution: at most one task run at a time, with a minimum
 *    spacing between runs — a backlog of overdue tasks drains one-by-one
 *    and can never burst the OpenAI rate budget (R1).
 *  - CLAIM before send: every run starts with ``POST /tasks/{id}/claim``;
 *    a single conditional UPDATE on the server guarantees one winner across
 *    tabs/devices. The localStorage lease here is only an optimisation to
 *    avoid pointless claim calls from a second tab (R2).
 *  - BACKGROUND send: the message goes straight through ``api.sendMessage``
 *    and the SSE stream is consumed quietly — never through
 *    ``messageStore.sendMessage``, which owns the *active* chat's UI state
 *    (R3). If the task's conversation is open, we refresh its messages
 *    when the run completes.
 *  - DEFER under load: while the operator has a live streaming turn the
 *    engine waits for the next tick instead of competing with it.
 *  - Camera frames use a short acquire → snapshot → release cycle through
 *    the refcounted cameraStreamManager, so the alert engine is never
 *    starved (R6d). A camera failure downgrades the run to text-only.
 *  - Missed schedules: at most ONE catch-up run per task when the console
 *    reopens; recurring tasks then realign to their next slot.
 */

import { api } from "../api/client";
import { captureMultiFrame } from "../utils/cameraCapture";
import { useConversationStore } from "../stores/conversationStore";
import { useConversationActivityStore } from "../stores/conversationActivityStore";
import { useLanguageStore } from "../stores/languageStore";
import { useLiveStore } from "../stores/liveStore";
import { useMessageStore } from "../stores/messageStore";
import { useTaskStore } from "../stores/taskStore";
import { useUserStore } from "../stores/userStore";
import type { ScheduledTask } from "../types/api";

/** How often the engine looks for due tasks. */
const TICK_MS = 20_000;
/** Re-list tasks from the server this often (picks up edits from other
 *  devices; same-tab edits flow through the task store immediately). */
const HYDRATE_INTERVAL_MS = 5 * 60_000;
/** Minimum spacing between consecutive task runs (serial drain). */
const RUN_SPACING_MS = 5_000;
/** Safety window after a report-capable run before the transient "preparing
 *  PDF report" card is cleared. A report is only emitted when the background
 *  trigger scan matches, so a run may legitimately produce none — this stops
 *  the placeholder from lingering forever in that case. */
const PREPARING_REPORT_TIMEOUT_MS = 120_000;
/** Cross-tab lease TTL (optimisation only — the server claim is the
 *  authoritative lock). */
const LEASE_TTL_MS = 30_000;

let started = false;
let timer: number | null = null;
let ticking = false;
let stopRequested = false;
let lastHydrateAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function leaseKey(taskId: string): string {
  return `ghost-task-lease-${taskId}`;
}

/** Best-effort cross-tab lease via localStorage. Returns true when this tab
 *  may proceed to the (authoritative) server claim. */
function tryLocalLease(taskId: string): boolean {
  try {
    const now = Date.now();
    const existing = Number(window.localStorage.getItem(leaseKey(taskId)) || 0);
    if (existing > now) return false;
    window.localStorage.setItem(leaseKey(taskId), String(now + LEASE_TTL_MS));
    return true;
  } catch {
    return true;
  }
}

function releaseLocalLease(taskId: string): void {
  try {
    window.localStorage.removeItem(leaseKey(taskId));
  } catch {
    // ignore
  }
}

function pickCamera(
  conversationId: string,
): { device_id: string; label: string } | null {
  const live = useLiveStore.getState();
  const active = live.getActiveCameras(conversationId);
  if (active.length > 0) {
    return { device_id: active[0].device_id, label: active[0].label };
  }
  const saved = live.savedCameras[conversationId] ?? [];
  if (saved.length > 0) {
    return { device_id: saved[0].device_id, label: saved[0].label };
  }
  return null;
}

/** Capture the same triplet collage a regular chat message sends, via the
 *  shared ``captureMultiFrame`` helper — first dark/warm-up frame skipped,
 *  faces blurred, graceful fallback when fewer than three frames are usable.
 *  Reusing the exact helper keeps task output byte-for-byte consistent with
 *  the operator chat path (no duplicated frame algorithm). Null on any
 *  failure (the run proceeds text-only). */
async function captureTaskFrame(
  conversationId: string,
  userId: string,
): Promise<{ imageBase64: string; cameraLabel: string } | null> {
  try {
    let camera = pickCamera(conversationId);
    if (!camera) {
      // Saved cameras may not be hydrated for a conversation that was never
      // opened in this session.
      await useLiveStore
        .getState()
        .fetchSavedCameras(conversationId, userId);
      camera = pickCamera(conversationId);
    }
    if (!camera) return null;

    const imageBase64 = await captureMultiFrame(camera.device_id);
    if (!imageBase64) return null;
    return { imageBase64, cameraLabel: camera.label };
  } catch (err) {
    console.warn(
      `[taskEngine] camera capture failed for conv ${conversationId}; sending text-only:`,
      err,
    );
    return null;
  }
}

/** Consume the chat SSE stream quietly — the run happens in the background
 *  and must never touch the active chat's streaming UI state. */
async function drainStream(
  stream: ReadableStream<unknown>,
): Promise<void> {
  const reader = stream.getReader();
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

/** Whether a task would produce a downloadable PDF report on a match — i.e.
 *  it has at least one active ``report`` trigger. Drives the transient
 *  "preparing PDF report" card. */
function hasActiveReportTrigger(task: ScheduledTask): boolean {
  return (task.triggers ?? []).some(
    (tr) => tr.is_active && tr.alert_kind === "report",
  );
}

function collectDueTasks(): ScheduledTask[] {
  const all = useTaskStore.getState().tasks;
  const nowIso = new Date().toISOString();
  const due: ScheduledTask[] = [];
  for (const list of Object.values(all)) {
    for (const task of list) {
      if (!task.is_active || !task.next_run_at) continue;
      if (task.next_run_at <= nowIso) due.push(task);
    }
  }
  due.sort((a, b) => (a.next_run_at! < b.next_run_at! ? -1 : 1));
  return due;
}

/** Refresh the per-conversation task lists so the engine sees tasks created
 *  on other devices / before this session. Sequential, capped. */
async function hydrateTasks(userId: string): Promise<boolean> {
  const conversations = useConversationStore.getState().conversations;
  if (conversations.length === 0) return false;
  const fetchTasks = useTaskStore.getState().fetchTasks;
  for (const conv of conversations.slice(0, 100)) {
    if (stopRequested) return false;
    await fetchTasks(conv.id, userId);
  }
  return true;
}

async function runTask(task: ScheduledTask, userId: string): Promise<void> {
  const taskStore = useTaskStore.getState();

  if (!tryLocalLease(task.id)) return;

  // Authoritative claim — exactly one tab/device wins a due run.
  const claim = await api.claimTask(task.id, userId);
  if (!claim.ok || !claim.data) {
    // 409 TASK_NOT_DUE = another tab claimed it, or schedule changed.
    if (claim.error?.code !== "TASK_NOT_DUE") {
      console.warn(
        `[taskEngine] claim failed for task ${task.id}:`,
        claim.error?.message,
      );
    }
    releaseLocalLease(task.id);
    return;
  }
  taskStore._applyClaimedTask(claim.data);

  const locale = useLanguageStore.getState().locale;
  let imageBase64: string | undefined;
  let cameraLabel: string | undefined;
  if (task.include_camera) {
    const frame = await captureTaskFrame(task.conversation_id, userId);
    if (frame) {
      imageBase64 = frame.imageBase64;
      cameraLabel = frame.cameraLabel;
    }
  }

  // Surface a "preparing PDF report" card the moment a report-capable run
  // starts, so the operator sees the system is working on it.
  const expectsReport = hasActiveReportTrigger(task);
  if (expectsReport) {
    useMessageStore.getState().addPreparingReport(task.conversation_id, task.id);
  }

  const send = async () => {
    const stream = await api.sendMessage(
      task.conversation_id,
      userId,
      task.prompt_text,
      imageBase64,
      undefined,
      locale,
      undefined,
      { task_id: task.id, camera_label: cameraLabel },
    );
    await drainStream(stream);
  };

  try {
    try {
      await send();
    } catch (firstErr) {
      // One retry, then surface the failure — never an endless loop.
      console.warn(
        `[taskEngine] run failed for task ${task.id}; retrying once:`,
        firstErr,
      );
      await sleep(2_000);
      await send();
    }
    taskStore._setRunError(task.id, null);
    console.info(
      `[taskEngine] ran task ${task.id.slice(0, 8)} (conv=${task.conversation_id.slice(0, 8)}, camera=${cameraLabel ?? "none"})`,
    );

    // A task message landed in the conversation — bump it to the top + mark
    // unread (unless it's open). A matching report, if any, upgrades the kind
    // to 'report' when its SSE arrives.
    useConversationActivityStore
      .getState()
      .markActivity(task.conversation_id, "message");

    // If the operator is looking at this conversation, surface the new
    // task message + reply. ``fetchMessages`` replaces the message list, so
    // the transient preparing card is dropped here too.
    const activeConvId = useConversationStore.getState().activeConversationId;
    if (activeConvId === task.conversation_id) {
      void useMessageStore
        .getState()
        .fetchMessages(task.conversation_id, userId);
    }

    // The report (if any) arrives asynchronously via the task_report SSE,
    // which clears the placeholder. If no trigger matched, clear it after a
    // safety window so it can't linger.
    if (expectsReport) {
      window.setTimeout(
        () => useMessageStore.getState().clearPreparingReport(task.id),
        PREPARING_REPORT_TIMEOUT_MS,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    taskStore._setRunError(task.id, msg);
    if (expectsReport) {
      useMessageStore.getState().failPreparingReport(task.id);
    }
    console.error(`[taskEngine] run failed for task ${task.id}:`, err);
  } finally {
    releaseLocalLease(task.id);
  }
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const { activeUserId, sessionType, isAuthenticated } =
      useUserStore.getState();
    // Tasks are an operator feature — trial sessions are blocked server-side
    // too, so don't even poll.
    if (!isAuthenticated || !activeUserId || sessionType === "trial") return;

    if (Date.now() - lastHydrateAt > HYDRATE_INTERVAL_MS) {
      const hydrated = await hydrateTasks(activeUserId);
      if (hydrated) lastHydrateAt = Date.now();
    }

    const due = collectDueTasks();
    for (const task of due) {
      if (stopRequested) return;
      // Never compete with a live operator turn — wait for the next tick.
      if (useMessageStore.getState().isStreaming) return;
      await runTask(task, activeUserId);
      await sleep(RUN_SPACING_MS + Math.random() * 1_000);
    }
  } catch (err) {
    console.warn("[taskEngine] tick failed:", err);
  } finally {
    ticking = false;
  }
}

export function startTaskEngine(): void {
  if (started) return;
  started = true;
  stopRequested = false;
  lastHydrateAt = 0;
  // First tick shortly after mount so overdue tasks catch up quickly, but
  // after stores have hydrated.
  timer = window.setInterval(() => void tick(), TICK_MS);
  window.setTimeout(() => void tick(), 4_000);
}

export function stopTaskEngine(): void {
  if (!started) return;
  started = false;
  stopRequested = true;
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

export function isTaskEngineRunning(): boolean {
  return started;
}
