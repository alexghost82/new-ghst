/**
 * In-browser real-time semantic segmentation for the live camera feed.
 *
 * Runs MediaPipe ``ImageSegmenter`` (DeepLab-v3, Pascal VOC) fully on-device
 * in WASM — the frame never leaves the browser. Used by the in-chat
 * ``LiveCameraStage`` to paint silhouette masks (not boxes) over detected
 * people and vehicles on top of the grayscale stream.
 *
 * Design mirrors ``faceBlur``/``objectDetector``:
 *   - **Lazy singleton** with a shared ``loadingPromise``.
 *   - **Fail-open**: any init/segment failure resolves to ``null`` so the live
 *     feed keeps playing without overlays.
 *   - **VIDEO running mode** with a single shared monotonic timestamp so
 *     multiple tiles can share one segmenter instance (calls are synchronous
 *     on the main thread).
 *
 * The returned ``categoryMask`` is a per-pixel class-index buffer. Pascal VOC
 * class indices of interest:
 *   person = 15; vehicles = aeroplane(1), bicycle(2), boat(4), bus(6),
 *   car(7), motorbike(14), train(19).
 */

import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

const WASM_ROOT = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/deeplab_v3.tflite";

export interface CategoryMask {
  /** Per-pixel Pascal VOC class index, length === width * height. */
  data: Uint8Array;
  width: number;
  height: number;
}

let segmenter: ImageSegmenter | null = null;
let loadingPromise: Promise<ImageSegmenter | null> | null = null;
let initFailed = false;
let warnedOnce = false;
let lastTimestamp = 0;

function warnOnce(message: string, err?: unknown): void {
  if (warnedOnce) return;
  warnedOnce = true;
  if (err !== undefined) {
    console.warn(`[objectSegmenter] ${message}`, err);
  } else {
    console.warn(`[objectSegmenter] ${message}`);
  }
}

async function loadSegmenter(): Promise<ImageSegmenter | null> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const created = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        // CPU delegate to match faceBlur — the GPU/WebGL delegate is
        // unreliable in the app's Electron-based browser host.
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
    segmenter = created;
    return created;
  } catch (err) {
    initFailed = true;
    warnOnce(
      "image segmenter unavailable — live feed will play without masks. " +
        "Verify /mediapipe/wasm/* and /mediapipe/deeplab_v3.tflite are reachable.",
      err,
    );
    return null;
  }
}

function ensureLoading(): Promise<ImageSegmenter | null> {
  if (segmenter) return Promise.resolve(segmenter);
  if (initFailed) return Promise.resolve(null);
  if (!loadingPromise) {
    loadingPromise = loadSegmenter();
  }
  return loadingPromise;
}

/** Fire-and-forget warm-up so the first live frame doesn't pay init cost. */
export function prewarmObjectSegmenter(): void {
  if (segmenter || initFailed || loadingPromise) return;
  ensureLoading();
}

/**
 * Segment the given playing ``<video>`` element and return a per-pixel
 * category mask in the model's output space, or ``null`` on any failure /
 * while still loading. The buffer is copied out before the underlying
 * MediaPipe mask is closed, so callers own it freely.
 */
export async function segmentVideo(
  video: HTMLVideoElement,
): Promise<CategoryMask | null> {
  try {
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    let active = segmenter;
    if (!active && !initFailed) {
      active = await ensureLoading();
    }
    if (!active) return null;

    const ts = Math.max(lastTimestamp + 1, Math.round(performance.now()));
    lastTimestamp = ts;

    let out: CategoryMask | null = null;
    // VIDEO mode invokes the callback synchronously before returning.
    active.segmentForVideo(video, ts, (result: ImageSegmenterResult) => {
      const mask = result.categoryMask;
      if (mask) {
        const src = mask.getAsUint8Array();
        out = {
          data: new Uint8Array(src),
          width: mask.width,
          height: mask.height,
        };
        mask.close();
      }
      result.close();
    });
    return out;
  } catch (err) {
    warnOnce("segmentForVideo threw — skipping masks this frame", err);
    return null;
  }
}

/** Diagnostics only. */
export function isObjectSegmenterAvailable(): boolean {
  return segmenter !== null;
}
