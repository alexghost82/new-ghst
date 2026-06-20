/**
 * Object Tracking Engine — background detection loop.
 *
 * For every conversation with ``tracking_enabled``, runs ONE loop per
 * connected camera. Each loop:
 *   1. Acquires the refcounted camera stream via :func:`cameraStreamManager.acquire`
 *      so it shares the underlying ``getUserMedia`` with alertEngine,
 *      the live preview, and any other consumer.
 *   2. Snapshots the freshest frame.
 *   3. Applies a luma-diff motion gate — frames with no visible change
 *      vs. the previous iteration are skipped (saves ~70-80% of API calls
 *      on idle camera feeds).
 *   4. JPEG-encodes the canvas at maximum quality (no client-side
 *      downsample for typical webcams; long side capped only at 2560px
 *      to stay below OpenAI's effective tile ceiling).
 *   5. POSTs the encoded frame to ``/conversations/:id/detection/scan``.
 *   6. Sleeps ``SCAN_INTERVAL_MS`` and loops.
 *
 * Loops are stopped cooperatively via ``AbortController.signal``. The
 * engine itself is a singleton: ``startDetectionEngine`` is idempotent
 * and ``stopDetectionEngine`` cancels every active loop.
 */

import {
  acquire as acquireStream,
  type CameraStreamHandle,
} from "./cameraStreamManager";
import { blurFacesInCanvas } from "./faceBlur";
import { useDetectionStore } from "../stores/detectionStore";
import { useAlertStore } from "../stores/alertStore";
import { useLiveStore } from "../stores/liveStore";
import { useUserStore } from "../stores/userStore";

/** Period between scans for a single camera. */
const SCAN_INTERVAL_MS = 800;
/** Sleep after a transient error before retrying. */
const ERROR_RETRY_MS = 1200;
/** Sleep when no camera is configured yet — keep polling so the loop
 *  picks up new cameras the user wires up mid-session. */
const NO_CAMERA_RETRY_MS = 2500;
/** Max longest side (px) for the encoded JPEG. Generous cap that
 *  effectively avoids client-side downsampling for typical webcams —
 *  OpenAI's vision pipeline tiles up to 2048 long side at
 *  ``detail: "high"``, so this leaves headroom for the most
 *  detail-rich frame the camera can deliver. */
const MAX_SIDE_PX = 2560;
/** JPEG quality used for the uploaded frame — 1.0 (visually lossless)
 *  so the deep-profile vision pass receives every pixel the camera
 *  captured. */
const JPEG_QUALITY = 1.0;
/** Mean luma diff below which we treat consecutive frames as identical.
 *  Lower than the alert engine's threshold so a person crossing slowly
 *  isn't filtered out. */
const MOTION_LUMA_THRESHOLD = 2.8;
/** After this many consecutive iteration failures we drop tracking mode
 *  for the conversation so the user gets a visible signal. */
const AUTO_DISABLE_FAILURE_THRESHOLD = 6;
/** Fast Path latency instrumentation — logs the client-measured budget
 *  (capture -> encode -> scan round-trip) per scan in dev so we have a
 *  real baseline before/after the architecture change. Off in prod. */
const TRACK_TIMING_DEBUG =
  typeof import.meta !== "undefined" && !!import.meta.env?.DEV;

type LoopKey = string; // `${conversationId}::${deviceId}`

type LoopHandle = {
  controller: AbortController;
  promise: Promise<void>;
};

let started = false;
let unsubscribeDetection: (() => void) | null = null;
let unsubscribeLive: (() => void) | null = null;
let unsubscribeAlert: (() => void) | null = null;
const loops = new Map<LoopKey, LoopHandle>();
const failuresByConversation = new Map<string, number>();

function loopKey(conversationId: string, deviceId: string): LoopKey {
  return `${conversationId}::${deviceId}`;
}

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
    return source.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
  }
  const dst = document.createElement("canvas");
  dst.width = dstW;
  dst.height = dstH;
  const ctx = dst.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(source, 0, 0, w, h, 0, 0, dstW, dstH);
  return dst.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
}

function computeMeanLuma(canvas: HTMLCanvasElement): number {
  // Cheap center-crop luma estimate — enough to filter still frames.
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
    sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  return sum / (data.length / 4);
}

async function runCameraLoop(
  conversationId: string,
  deviceId: string,
  cameraLabel: string,
  signal: AbortSignal,
): Promise<void> {
  let handle: CameraStreamHandle | null = null;
  let prevLuma: number | null = null;

  const release = () => {
    if (handle) {
      try {
        handle.release();
      } catch {
        // ignore
      }
      handle = null;
    }
  };

  const reportFailure = () => {
    const prev = failuresByConversation.get(conversationId) ?? 0;
    failuresByConversation.set(conversationId, prev + 1);
    if (prev + 1 >= AUTO_DISABLE_FAILURE_THRESHOLD) {
      const userId = useUserStore.getState().activeUserId;
      const store = useDetectionStore.getState();
      if (userId && store.trackingEnabled[conversationId]) {
        console.warn(
          `[detectionEngine] auto-disabling tracking for conv ${conversationId} after ${prev + 1} failures`,
        );
        void store.toggleTracking(conversationId, userId, false);
      }
      failuresByConversation.delete(conversationId);
    }
  };

  const reportSuccess = () => {
    failuresByConversation.delete(conversationId);
  };

  try {
    while (!signal.aborted) {
      try {
        const userId = useUserStore.getState().activeUserId;
        if (!userId) {
          await sleep(NO_CAMERA_RETRY_MS, signal);
          continue;
        }

        if (!handle) {
          try {
            handle = await acquireStream(deviceId);
          } catch (err) {
            if (signal.aborted) return;
            console.warn(
              `[detectionEngine] failed to acquire camera ${deviceId} for conv ${conversationId}:`,
              err,
            );
            reportFailure();
            await sleep(NO_CAMERA_RETRY_MS, signal);
            continue;
          }
        }

        if (signal.aborted) return;

        let snapshot: HTMLCanvasElement;
        try {
          snapshot = await handle.snapshotLatest();
        } catch (err) {
          if (signal.aborted) return;
          console.warn(
            `[detectionEngine] snapshot failed for conv ${conversationId}:`,
            err,
          );
          reportFailure();
          // Reset the handle so the next iteration re-acquires cleanly
          // when the camera comes back.
          release();
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }

        const captureStartedAt =
          TRACK_TIMING_DEBUG && typeof performance !== "undefined"
            ? performance.now()
            : 0;

        // Apply face blur BEFORE motion gating so the luma comparison and
        // the upload both see the same redacted bytes.
        snapshot = await blurFacesInCanvas(snapshot);

        const luma = computeMeanLuma(snapshot);
        if (
          prevLuma !== null &&
          Math.abs(luma - prevLuma) < MOTION_LUMA_THRESHOLD
        ) {
          prevLuma = luma;
          await sleep(SCAN_INTERVAL_MS, signal);
          continue;
        }
        prevLuma = luma;

        const imageBase64 = canvasToBase64Jpeg(
          snapshot,
          MAX_SIDE_PX,
          JPEG_QUALITY,
        );
        if (!imageBase64) {
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }

        const encodedAt =
          TRACK_TIMING_DEBUG && typeof performance !== "undefined"
            ? performance.now()
            : 0;

        const capturedAt = new Date().toISOString();

        let outcome;
        try {
          outcome = await useDetectionStore
            .getState()
            .submitScan(
              conversationId,
              userId,
              imageBase64,
              deviceId,
              cameraLabel,
              capturedAt,
            );
        } catch (err) {
          if (signal.aborted) return;
          console.warn(
            `[detectionEngine] submitScan threw for conv ${conversationId}:`,
            err,
          );
          reportFailure();
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }

        if (outcome.status === "error") {
          if (signal.aborted) return;
          reportFailure();
          await sleep(ERROR_RETRY_MS, signal);
          continue;
        }

        reportSuccess();

        if (TRACK_TIMING_DEBUG && captureStartedAt > 0) {
          const renderedAt = performance.now();
          const fastCount =
            outcome.status === "ok" ? outcome.fast_objects_created : 0;
          // Only log the latency budget when this scan actually produced a
          // card — that's the SLA we care about (high-confidence detection
          // -> card rendered), not idle/queued frames.
          if (fastCount > 0) {
            console.debug(
              `[detectionEngine] Fast Path budget conv=${conversationId} ` +
                `cards=${fastCount} ` +
                `encode=${Math.round(encodedAt - captureStartedAt)}ms ` +
                `scan=${Math.round(renderedAt - encodedAt)}ms ` +
                `total=${Math.round(renderedAt - captureStartedAt)}ms`,
            );
          }
        }

        if (signal.aborted) return;
        await sleep(SCAN_INTERVAL_MS, signal);
      } catch (err) {
        if (signal.aborted) return;
        console.warn(
          `[detectionEngine] iteration error for conv ${conversationId}:`,
          err,
        );
        reportFailure();
        await sleep(ERROR_RETRY_MS, signal);
      }
    }
  } finally {
    release();
  }
}

function camerasForConversation(
  conversationId: string,
): Array<{ device_id: string; label: string }> {
  const live = useLiveStore.getState();
  const active = live.getActiveCameras(conversationId);
  if (active.length > 0) {
    return active.map((c) => ({ device_id: c.device_id, label: c.label }));
  }
  const saved = live.savedCameras[conversationId] ?? [];
  return saved.map((c) => ({ device_id: c.device_id, label: c.label }));
}

/** Alerts are always top priority. While ANY conversation has alert mode
 *  enabled, the heavy tracking pipeline (YOLO + gpt-5 collage) is paused
 *  entirely so it never competes with the latency-critical alert vision
 *  call for the OpenAI account, the camera stream, or the main thread. */
function alertModeActive(): boolean {
  return Object.values(useAlertStore.getState().alertModeEnabled).some(Boolean);
}

function syncLoops(): void {
  const enabled = useDetectionStore.getState().trackingEnabled;
  const desired = new Set<LoopKey>();
  const paused = alertModeActive();

  for (const [conversationId, on] of Object.entries(enabled)) {
    if (paused) break;
    if (!on) continue;
    const cams = camerasForConversation(conversationId);
    for (const cam of cams) {
      desired.add(loopKey(conversationId, cam.device_id));
      const key = loopKey(conversationId, cam.device_id);
      if (loops.has(key)) continue;
      const controller = new AbortController();
      const promise = runCameraLoop(
        conversationId,
        cam.device_id,
        cam.label,
        controller.signal,
      ).finally(() => {
        loops.delete(key);
      });
      loops.set(key, { controller, promise });
    }
  }

  for (const [key, handle] of Array.from(loops.entries())) {
    if (!desired.has(key)) {
      handle.controller.abort();
      loops.delete(key);
    }
  }
}

export function startDetectionEngine(): void {
  if (started) return;
  started = true;
  syncLoops();
  unsubscribeDetection = useDetectionStore.subscribe((state, prev) => {
    if (state.trackingEnabled !== prev.trackingEnabled) {
      syncLoops();
    }
  });
  unsubscribeLive = useLiveStore.subscribe((state, prev) => {
    if (
      state.liveConversations !== prev.liveConversations ||
      state.savedCameras !== prev.savedCameras
    ) {
      syncLoops();
    }
  });
  // Re-sync when alert mode toggles anywhere: turning alert mode on pauses
  // every tracking loop; turning the last one off resumes them.
  unsubscribeAlert = useAlertStore.subscribe((state, prev) => {
    if (state.alertModeEnabled !== prev.alertModeEnabled) {
      syncLoops();
    }
  });
}

export function stopDetectionEngine(): void {
  if (!started) return;
  started = false;
  if (unsubscribeDetection) {
    unsubscribeDetection();
    unsubscribeDetection = null;
  }
  if (unsubscribeLive) {
    unsubscribeLive();
    unsubscribeLive = null;
  }
  if (unsubscribeAlert) {
    unsubscribeAlert();
    unsubscribeAlert = null;
  }
  for (const handle of loops.values()) {
    handle.controller.abort();
  }
  loops.clear();
  failuresByConversation.clear();
}

export function isDetectionEngineRunning(): boolean {
  return started;
}
