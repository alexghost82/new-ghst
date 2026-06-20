/**
 * Background alert scanning engine.
 *
 * For every conversation with alert mode enabled, runs a serial loop that:
 *   1. Acquires a refcounted, *persistent* camera stream via
 *      :func:`cameraStreamManager.acquire` (the underlying ``getUserMedia``
 *      stays open across iterations — no cold-open per cycle).
 *   2. Takes a fresh snapshot from the stream's ring buffer, downscales it to
 *      max-side ``MAX_SIDE_PX`` and encodes as JPEG at quality ``JPEG_QUALITY``.
 *   3. POSTs the encoded frame to ``/api/conversations/:id/alerts/scan`` and
 *      awaits the response (which drives per-conversation backpressure).
 *   4. Sleeps ``SCAN_INTERVAL_MS`` and loops.
 *
 * The UI's "alert detected" state is no longer driven by this POST response —
 * the SSE channel (see :mod:`alertStream`) pushes events the moment the
 * backend creates them. The POST round-trip still gates the loop so we never
 * have more than one scan per conversation in flight.
 *
 * Stopping a loop is cooperative via ``AbortController.signal``. The engine
 * itself is a singleton: ``startAlertEngine`` is idempotent and
 * ``stopAlertEngine`` cancels everything.
 */

import { acquire as acquireStream, type CameraStreamHandle } from "./cameraStreamManager";
import { blurFacesInCanvas } from "./faceBlur";
import { useAlertStore } from "../stores/alertStore";
import { useAlertRuntimeStore } from "../stores/alertRuntimeStore";
import { useLiveStore, type ActiveCamera } from "../stores/liveStore";
import { useUserStore } from "../stores/userStore";
import { useConversationStore } from "../stores/conversationStore";
import { setLastScanStart } from "./alertLatencyTracker";

/** Target spacing between the *starts* of consecutive scans for one
 *  conversation (the loop sleeps ``SCAN_INTERVAL_MS - cycleElapsed`` so
 *  the real cadence is ``max(POST, interval)``). Tuned for the <=1.8s
 *  sample→overlay budget — the backend pairs this with a ``detail: "low"``
 *  vision call (``settings.alert_vision_model``, default ``gpt-4o-mini``)
 *  hard-capped at ``alert_vision_timeout_seconds`` so a single detecting
 *  scan clears comfortably under budget. */
const SCAN_INTERVAL_MS = 300;
/** Sleep after a network error before retrying the next iteration.
 *  Short so a transient blip never adds more than ~0.5s to the next
 *  detection attempt. */
const ERROR_RETRY_MS = 500;
/** Sleep when no camera is configured yet (waiting for user setup). */
const NO_CAMERA_RETRY_MS = 1500;
/** Max longest side (px) of the JPEG sent to the backend. With the
 *  alert pipeline running at ``detail: "low"`` (one 512x512 tile),
 *  anything above ~1024 is pure upload + encode overhead — the model
 *  still collapses it to a single tile before reasoning. Capping at
 *  1024 shaves encode/upload time off every scan to protect the 1.8s
 *  sample→overlay budget. Operators who flip the backend to
 *  ``detail: "high"`` for forensic rules can raise this. */
const MAX_SIDE_PX = 1024;
/** JPEG quality used for the uploaded frame. 0.82 is the sweet spot:
 *  visually indistinguishable from 1.0 for the model's purposes but
 *  ~4x faster to encode and ~3-5x smaller on the wire than the old
 *  lossless setting. */
const JPEG_QUALITY = 0.82;

/** Optional luma-diff motion gate — leave OFF by default. When enabled, skips
 *  the scan API call if consecutive frames look identical. */
const ENABLE_MOTION_GATE = false;
const MOTION_LUMA_THRESHOLD = 3.0;
/** After this many consecutive iteration failures we auto-disable alert mode
 *  for the conversation. Prevents a "dead" loop from quietly running while
 *  the camera is unplugged / permissions were revoked. */
const AUTO_DISABLE_FAILURE_THRESHOLD = 5;

type LoopHandle = {
  controller: AbortController;
  promise: Promise<void>;
};

let started = false;
let unsubscribe: (() => void) | null = null;
const loops = new Map<string, LoopHandle>();

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function pickCamera(conversationId: string): ActiveCamera | null {
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

function canvasToBase64Jpeg(
  source: HTMLCanvasElement,
  maxSide: number,
  quality: number,
): string {
  const w = source.width;
  const h = source.height;
  const longest = Math.max(w, h);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const dstW = Math.round(w * scale);
  const dstH = Math.round(h * scale);
  if (scale === 1) {
    const dataUrl = source.toDataURL("image/jpeg", quality);
    return dataUrl.split(",")[1] ?? "";
  }
  const dst = document.createElement("canvas");
  dst.width = dstW;
  dst.height = dstH;
  const ctx = dst.getContext("2d");
  if (!ctx) return "";
  // Browsers default to bilinear-ish smoothing on drawImage; explicit hint:
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(source, 0, 0, w, h, 0, 0, dstW, dstH);
  const dataUrl = dst.toDataURL("image/jpeg", quality);
  return dataUrl.split(",")[1] ?? "";
}

let _prevLumaByLoop = new Map<string, number>();

function computeMeanLuma(canvas: HTMLCanvasElement): number {
  // Sample a 16x16 grid in the center for a cheap-ish luma estimate.
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return 0;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  const sw = Math.min(64, w);
  const sh = Math.min(64, h);
  const sx = Math.floor((w - sw) / 2);
  const sy = Math.floor((h - sh) / 2);
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luma
    sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  return sum / (data.length / 4);
}

async function runConversationLoop(
  conversationId: string,
  signal: AbortSignal,
): Promise<void> {
  const runtime = useAlertRuntimeStore.getState();
  let currentHandle: CameraStreamHandle | null = null;
  let currentDeviceId: string | null = null;

  const releaseHandle = () => {
    if (currentHandle) {
      try {
        currentHandle.release();
      } catch {
        // ignore
      }
      currentHandle = null;
      currentDeviceId = null;
    }
  };

  const reportError = (message: string, status: "error" | "no_camera" = "error") => {
    useAlertRuntimeStore.getState().reportFailure(conversationId, message, status);
    maybeAutoDisable(conversationId);
  };

  runtime.setStatus(conversationId, "connecting");

  try {
    while (!signal.aborted) {
      try {
        const userId = useUserStore.getState().activeUserId;
        if (!userId) {
          await sleep(NO_CAMERA_RETRY_MS, signal);
          continue;
        }

        const camera = pickCamera(conversationId);
        if (!camera) {
          releaseHandle();
          useAlertRuntimeStore.getState().setStatus(conversationId, "no_camera", {
            cameraLabel: null,
            deviceId: null,
            lastError: null,
          });
          await sleep(NO_CAMERA_RETRY_MS, signal);
          continue;
        }

        if (!currentHandle || currentDeviceId !== camera.device_id) {
          releaseHandle();
          useAlertRuntimeStore.getState().setStatus(conversationId, "connecting", {
            cameraLabel: camera.label,
            deviceId: camera.device_id,
          });
          try {
            currentHandle = await acquireStream(camera.device_id);
            currentDeviceId = camera.device_id;
          } catch (err) {
            if (signal.aborted) return;
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(
              `[alertEngine] failed to acquire camera for conv ${conversationId}:`,
              err,
            );
            reportError(msg || "Camera acquire failed");
            await sleep(NO_CAMERA_RETRY_MS, signal);
            continue;
          }
        }

        if (signal.aborted) return;

        const cycleStart = performance.now();
        setLastScanStart(conversationId, cycleStart);

        let snapshot: HTMLCanvasElement;
        try {
          snapshot = await currentHandle.snapshotLatest();
        } catch (err) {
          if (signal.aborted) return;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[alertEngine] snapshot failed for conv ${conversationId}:`,
            err,
          );
          reportError(msg || "Snapshot failed");
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }

        const snapshotMs = Math.round(performance.now() - cycleStart);

        // Redact faces before *any* downstream consumer reads the canvas —
        // luma sampling, JPEG encode, and the network upload all see the
        // blurred bytes. Fail-open: returns the original snapshot when the
        // detector isn't ready or anything throws.
        snapshot = await blurFacesInCanvas(snapshot);
        const blurMs = Math.round(performance.now() - cycleStart - snapshotMs);

        if (ENABLE_MOTION_GATE) {
          const luma = computeMeanLuma(snapshot);
          const prev = _prevLumaByLoop.get(conversationId);
          _prevLumaByLoop.set(conversationId, luma);
          if (prev !== undefined && Math.abs(luma - prev) < MOTION_LUMA_THRESHOLD) {
            await sleep(SCAN_INTERVAL_MS, signal);
            continue;
          }
        }

        const encodeStartedAt = performance.now();
        const imageBase64 = canvasToBase64Jpeg(
          snapshot,
          MAX_SIDE_PX,
          JPEG_QUALITY,
        );
        if (!imageBase64) {
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }
        const encodeMs = Math.round(performance.now() - encodeStartedAt);

        const conv = useConversationStore
          .getState()
          .conversations.find((c) => c.id === conversationId);

        useAlertRuntimeStore.getState().reportScanStart(conversationId);
        const postStartedAt = performance.now();
        let outcome;
        try {
          outcome = await useAlertStore
            .getState()
            .submitScan(
              conversationId,
              userId,
              imageBase64,
              conv?.title,
              camera.device_id,
              camera.label,
            );
        } catch (err) {
          if (signal.aborted) return;
          const msg = err instanceof Error ? err.message : String(err);
          reportError(msg || "Scan failed");
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }
        if (outcome?.status === "error") {
          if (signal.aborted) return;
          reportError(outcome.message);
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }
        useAlertRuntimeStore.getState().reportScanSuccess(conversationId);

        const postMs = Math.round(performance.now() - postStartedAt);
        const totalMs = Math.round(performance.now() - cycleStart);
        const detected =
          outcome?.status === "ok" && outcome.detected === true;
        console.info(
          `[alertEngine] cycle conv=${conversationId.slice(0, 8)} ` +
            `total=${totalMs}ms snapshot=${snapshotMs}ms blur=${blurMs}ms ` +
            `encode=${encodeMs}ms post=${postMs}ms bytes=${imageBase64.length} ` +
            `detected=${detected}`,
        );

        if (signal.aborted) return;
        // Pace the loop relative to the *start* of this cycle, not the end
        // of the POST. Otherwise the effective cadence is `POST + interval`
        // (e.g. a 1.4s scan + 300ms = a 1.7s gap between samples). With a
        // relative sleep the cadence is `max(POST, interval)`, so when a
        // scan already took longer than the interval we immediately sample
        // a fresh frame — keeping the sample→overlay path inside budget.
        const cycleElapsed = performance.now() - cycleStart;
        await sleep(Math.max(0, SCAN_INTERVAL_MS - cycleElapsed), signal);
      } catch (err) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[alertEngine] iteration error for conv ${conversationId}:`,
          err,
        );
        reportError(msg || "Loop error");
        await sleep(ERROR_RETRY_MS, signal);
      }
    }
  } finally {
    releaseHandle();
    _prevLumaByLoop.delete(conversationId);
  }
}

/** When the conversation accumulates too many consecutive failures, flip
 *  alert mode off so the user gets a visible signal instead of a silent
 *  dead loop. The runtime store keeps ``lastError`` around so the UI can
 *  explain why we backed off. */
function maybeAutoDisable(conversationId: string): void {
  const runtime = useAlertRuntimeStore.getState().getRuntime(conversationId);
  if (runtime.consecutiveFailures < AUTO_DISABLE_FAILURE_THRESHOLD) return;

  const userId = useUserStore.getState().activeUserId;
  if (!userId) return;
  const alertStore = useAlertStore.getState();
  if (!alertStore.alertModeEnabled[conversationId]) return;

  console.warn(
    `[alertEngine] auto-disabling alert mode for conv ${conversationId} after ${runtime.consecutiveFailures} failures`,
  );
  void alertStore.toggleAlertMode(conversationId, userId, false);
}

function syncLoops(): void {
  const enabled = useAlertStore.getState().alertModeEnabled;

  for (const [conversationId, on] of Object.entries(enabled)) {
    if (on && !loops.has(conversationId)) {
      const controller = new AbortController();
      const promise = runConversationLoop(
        conversationId,
        controller.signal,
      ).finally(() => {
        loops.delete(conversationId);
      });
      loops.set(conversationId, { controller, promise });
    }
  }

  for (const [conversationId, handle] of Array.from(loops.entries())) {
    if (!enabled[conversationId]) {
      handle.controller.abort();
      loops.delete(conversationId);
      useAlertRuntimeStore.getState().resetConversation(conversationId);
    }
  }
}

export function startAlertEngine(): void {
  if (started) return;
  started = true;
  syncLoops();
  unsubscribe = useAlertStore.subscribe((state, prev) => {
    if (state.alertModeEnabled !== prev.alertModeEnabled) {
      syncLoops();
    }
  });
}

export function stopAlertEngine(): void {
  if (!started) return;
  started = false;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  const runtime = useAlertRuntimeStore.getState();
  for (const [conversationId, handle] of loops.entries()) {
    handle.controller.abort();
    runtime.resetConversation(conversationId);
  }
  loops.clear();
  _prevLumaByLoop = new Map();
}

export function isAlertEngineRunning(): boolean {
  return started;
}
