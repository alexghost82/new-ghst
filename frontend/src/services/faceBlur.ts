/**
 * In-browser face detection + blur, used to redact faces in video frames
 * before they ever leave the device.
 *
 * Two consumers:
 *
 *   - ``cameraCapture.captureMultiFrame`` — runs blur on each frame just
 *     after ``ctx.drawImage(video, ...)`` and before the ``getImageData``
 *     used to stitch the JPEG collage that the Composer sends to ``/messages``.
 *   - ``alertEngine.runConversationLoop`` — runs blur on the latest snapshot
 *     of the persistent camera stream right before
 *     ``canvasToBase64Jpeg`` encodes the bytes that go to ``/alerts/scan``.
 *
 * Design decisions (locked by the plan):
 *
 *   - **Frontend-only.** Detection runs in WASM via ``@mediapipe/tasks-vision``
 *     so the unblurred frame never crosses the network boundary.
 *   - **Lazy singleton.** The detector is instantiated on the first call to
 *     :func:`blurFacesInCanvas` (or a manual :func:`prewarmFaceBlur`). All
 *     concurrent callers share one ``loadingPromise`` — no double init.
 *   - **Fail-open passthrough.** If the runtime fails to load, the model
 *     fails to download, ``detect`` throws, or any drawing op throws, the
 *     **original** canvas is returned unchanged so the call site still has
 *     something to send. We log a single throttled ``console.warn`` so the
 *     condition is observable without spamming the console.
 *   - **No backend changes.** The bytes the backend writes to
 *     ``data/uploads/frames/...`` are exactly the bytes we encoded after
 *     blur — the API contract is untouched.
 */

import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from "@mediapipe/tasks-vision";

const WASM_ROOT = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/blaze_face_short_range.tflite";

const MIN_DETECTION_CONFIDENCE = 0.5;
const MIN_SUPPRESSION_THRESHOLD = 0.3;
const BBOX_EXPAND_PCT = 0.25;
const BLUR_RADIUS_PX = 28;
const MAX_INIT_WAIT_MS = 1500;

let detector: FaceDetector | null = null;
let loadingPromise: Promise<FaceDetector | null> | null = null;
let initFailed = false;
let warnedOnce = false;

function warnOnce(message: string, err?: unknown): void {
  if (warnedOnce) return;
  warnedOnce = true;
  if (err !== undefined) {
    console.warn(`[faceBlur] ${message}`, err);
  } else {
    console.warn(`[faceBlur] ${message}`);
  }
}

async function loadDetector(): Promise<FaceDetector | null> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const created = await FaceDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
      minSuppressionThreshold: MIN_SUPPRESSION_THRESHOLD,
    });
    detector = created;
    return created;
  } catch (err) {
    initFailed = true;
    warnOnce(
      "face detector unavailable — frames will be sent without blur (passthrough). " +
        "Verify /mediapipe/wasm/* and /mediapipe/blaze_face_short_range.tflite are reachable.",
      err,
    );
    return null;
  }
}

function ensureLoading(): Promise<FaceDetector | null> {
  if (detector) return Promise.resolve(detector);
  if (initFailed) return Promise.resolve(null);
  if (!loadingPromise) {
    loadingPromise = loadDetector();
  }
  return loadingPromise;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    p.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Kick off the face-detector initialization without blocking the caller.
 *
 * Call once from app bootstrap (``App.tsx``). Subsequent calls are no-ops:
 * the underlying ``loadingPromise`` is shared with :func:`blurFacesInCanvas`
 * so the first real frame doesn't pay the ~200–400ms init cost.
 */
export function prewarmFaceBlur(): void {
  if (detector || initFailed || loadingPromise) return;
  ensureLoading();
}

/**
 * Returns ``true`` once the detector is loaded and ready to run synchronously.
 *
 * Useful only for diagnostics — call sites should NOT branch on this and
 * skip blur, because the contract guarantees passthrough on failure anyway.
 */
export function isFaceBlurAvailable(): boolean {
  return detector !== null;
}

function expandBox(
  box: { originX: number; originY: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const padX = box.width * BBOX_EXPAND_PCT;
  const padY = box.height * BBOX_EXPAND_PCT;
  let sx = Math.floor(box.originX - padX);
  let sy = Math.floor(box.originY - padY);
  let sw = Math.ceil(box.width + padX * 2);
  let sh = Math.ceil(box.height + padY * 2);
  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > canvasWidth) sw = canvasWidth - sx;
  if (sy + sh > canvasHeight) sh = canvasHeight - sy;
  return { sx, sy, sw, sh };
}

/**
 * Detect faces in ``src`` and return a NEW canvas with each face region
 * replaced by a heavy Gaussian-blurred copy of itself. If no faces are
 * detected, the **original** ``src`` is returned unchanged (callers can
 * cheaply check with ``=== src`` to skip a redundant copy).
 *
 * Errors at any stage — model not ready, ``detect`` throw, drawing op
 * throw — degrade to a passthrough return of ``src``. The caller must
 * always be able to use the returned canvas.
 */
export async function blurFacesInCanvas(
  src: HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  try {
    if (src.width === 0 || src.height === 0) return src;

    let active = detector;
    if (!active && !initFailed) {
      const loaded = await withTimeout(ensureLoading(), MAX_INIT_WAIT_MS);
      active = loaded ?? null;
    }
    if (!active) return src;

    let detections: Detection[];
    try {
      const result = active.detect(src);
      detections = result.detections ?? [];
    } catch (err) {
      warnOnce("detector.detect threw — passthrough this frame", err);
      return src;
    }

    if (detections.length === 0) return src;

    const dst = document.createElement("canvas");
    dst.width = src.width;
    dst.height = src.height;
    const dstCtx = dst.getContext("2d");
    if (!dstCtx) return src;

    dstCtx.drawImage(src, 0, 0);
    dstCtx.save();
    dstCtx.filter = `blur(${BLUR_RADIUS_PX}px)`;
    for (const det of detections) {
      const box = det.boundingBox;
      if (!box) continue;
      const { sx, sy, sw, sh } = expandBox(box, src.width, src.height);
      if (sw <= 0 || sh <= 0) continue;
      try {
        dstCtx.drawImage(src, sx, sy, sw, sh, sx, sy, sw, sh);
      } catch (err) {
        warnOnce("blur drawImage failed for one bbox — passthrough", err);
      }
    }
    dstCtx.restore();
    return dst;
  } catch (err) {
    warnOnce("blurFacesInCanvas crashed — passthrough", err);
    return src;
  }
}
