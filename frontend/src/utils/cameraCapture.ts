import { blurFacesInCanvas } from "../services/faceBlur";
import { getCaptureQualityParams } from "../stores/captureQualityStore";
import {
  acquire as acquireStream,
  isCameraStreamActive,
} from "../services/cameraStreamManager";

const FRAME_COUNT = 3;
const FRAME_INTERVAL_MS = 800;
const WARMUP_MS = 200;
// How many leading frames `captureFrame` pulls and discards before keeping
// one. The very first frame from a freshly-opened camera (especially the
// iPhone front/rear camera over Continuity Camera) is routinely black or
// gray while auto-exposure converges. Discarding the first two and keeping
// the third gives the sensor enough time to stabilize.
const SINGLE_FRAME_DISCARD_COUNT = 2;
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a canvas scaled so its width does not exceed ``maxWidth`` (aspect
 * ratio preserved). When ``maxWidth`` is null or the source is already within
 * bounds, the source canvas is returned unchanged.
 */
function scaleCanvasToWidth(
  source: HTMLCanvasElement,
  maxWidth: number | null,
): HTMLCanvasElement {
  if (maxWidth === null || source.width <= maxWidth) return source;
  const scale = maxWidth / source.width;
  const target = document.createElement("canvas");
  target.width = Math.max(1, Math.round(source.width * scale));
  target.height = Math.max(1, Math.round(source.height * scale));
  const ctx = target.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target;
}

/** Encodes a canvas to a base64 JPEG (no data-URL prefix), honoring the
 *  operator's capture-quality knob. */
function encodeCanvas(source: HTMLCanvasElement): string {
  const { jpegQuality, maxFrameWidth } = getCaptureQualityParams();
  const output = scaleCanvasToWidth(source, maxFrameWidth);
  return output.toDataURL("image/jpeg", jpegQuality).split(",")[1];
}

/**
 * Pull ``count`` frames from the shared, warm camera stream and stitch them
 * into a horizontal collage. Because snapshots come from the same stream that
 * feeds the live preview AND are cropped to the operator's exact on-screen
 * framing (``object-cover`` + digital PTZ zoom/pan), the produced bytes match
 * what the operator currently sees — including any zoom they configured.
 *
 * Faces are blurred per frame for privacy parity with the legacy path.
 */
async function captureFromSharedStream(
  deviceId: string,
  count: number,
  intervalMs: number,
): Promise<string> {
  const handle = await acquireStream(deviceId);
  try {
    const frames: HTMLCanvasElement[] = [];
    for (let i = 0; i < count; i++) {
      if (i > 0) await delay(intervalMs);
      // ``snapshotLatest`` already replays the operator's preview framing.
      let frame = await handle.snapshotLatest();
      try {
        const blurred = await blurFacesInCanvas(frame);
        if (blurred !== frame) frame = blurred;
      } catch {
        // Fail-open: keep the unblurred frame rather than dropping it.
      }
      frames.push(frame);
    }
    if (frames.length === 0) {
      throw new Error("captureFromSharedStream: no frames captured");
    }
    if (frames.length === 1) {
      return encodeCanvas(frames[0]);
    }
    // All shared snapshots share the operator's framing → identical size.
    const fw = frames[0].width;
    const fh = frames[0].height;
    const collage = document.createElement("canvas");
    collage.width = fw * frames.length;
    collage.height = fh;
    const ctx = collage.getContext("2d")!;
    frames.forEach((f, i) => ctx.drawImage(f, i * fw, 0, fw, fh));
    const { jpegQuality, maxFrameWidth } = getCaptureQualityParams();
    const collageMaxWidth =
      maxFrameWidth === null ? null : maxFrameWidth * frames.length;
    const output = scaleCanvasToWidth(collage, collageMaxWidth);
    return output.toDataURL("image/jpeg", jpegQuality).split(",")[1];
  } finally {
    handle.release();
  }
}

/**
 * Captures a single, usable frame from the specified camera device and
 * returns it as a base64-encoded JPEG string (without the
 * `data:image/jpeg;base64,` prefix).
 *
 * To avoid shipping the dark/black first frame the device camera emits
 * while auto-exposure warms up, this function pulls
 * `SINGLE_FRAME_DISCARD_COUNT` leading frames, discards them, and returns
 * the next frame (i.e. the 3rd pulled frame by default). Faces in the
 * returned frame are blurred via ``blurFacesInCanvas`` for privacy parity
 * with ``captureMultiFrame``.
 */
export async function captureFrame(deviceId: string): Promise<string> {
  // When a live preview / scan loop already has this camera open, capture from
  // that shared stream so the frame matches the operator's on-screen framing
  // (object-cover crop + any digital PTZ zoom/pan) exactly.
  if (isCameraStreamActive(deviceId)) {
    try {
      return await captureFromSharedStream(deviceId, 1, FRAME_INTERVAL_MS);
    } catch {
      // Fall through to a fresh capture session below.
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
  });

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();

    await new Promise<void>((resolve) => {
      if (video.videoWidth > 0) {
        resolve();
      } else {
        video.onloadeddata = () => resolve();
      }
    });

    await delay(WARMUP_MS);

    const w = video.videoWidth;
    const h = video.videoHeight;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    const totalCaptures = SINGLE_FRAME_DISCARD_COUNT + 1;
    for (let i = 0; i < totalCaptures; i++) {
      if (i > 0) await delay(FRAME_INTERVAL_MS);
      ctx.drawImage(video, 0, 0);
    }

    try {
      const blurred = await blurFacesInCanvas(canvas);
      if (blurred !== canvas) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(blurred, 0, 0);
      }
    } catch {
      // Fail-open: ship the raw kept frame if the blur pipeline throws.
    }

    const { jpegQuality, maxFrameWidth } = getCaptureQualityParams();
    const output = scaleCanvasToWidth(canvas, maxFrameWidth);
    const dataUrl = output.toDataURL("image/jpeg", jpegQuality);
    return dataUrl.split(",")[1];
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/**
 * Captures multiple frames from the specified camera device at fixed
 * intervals from a single stream session, and stitches them horizontally
 * into a single JPEG collage. Returns the collage as a base64-encoded JPEG
 * string (without the `data:image/jpeg;base64,` prefix).
 *
 * The first captured frame is always discarded (auto-exposure warm-up
 * produces a dark/unreliable image). The collage contains `count` usable
 * frames starting from the second capture onward.
 */
export async function captureMultiFrame(
  deviceId: string,
  count: number = FRAME_COUNT,
  intervalMs: number = FRAME_INTERVAL_MS,
): Promise<string> {
  // Prefer the shared, warm stream so the collage frames match the operator's
  // live preview framing (object-cover crop + digital PTZ zoom/pan) exactly.
  if (isCameraStreamActive(deviceId)) {
    try {
      return await captureFromSharedStream(deviceId, count, intervalMs);
    } catch {
      // Fall through to a fresh capture session below.
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
  });

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();

    await new Promise<void>((resolve) => {
      if (video.videoWidth > 0) {
        resolve();
      } else {
        video.onloadeddata = () => resolve();
      }
    });

    await delay(WARMUP_MS);

    const w = video.videoWidth;
    const h = video.videoHeight;

    const singleCanvas = document.createElement("canvas");
    singleCanvas.width = w;
    singleCanvas.height = h;
    const singleCtx = singleCanvas.getContext("2d")!;

    const totalCaptures = count + 1;
    const allFrames: ImageData[] = [];
    for (let i = 0; i < totalCaptures; i++) {
      if (i > 0) await delay(intervalMs);
      try {
        singleCtx.drawImage(video, 0, 0);
        // Redact faces in-place before reading the pixels we'll stitch into
        // the collage. ``blurFacesInCanvas`` returns the source canvas
        // unchanged when there are no faces, the model isn't ready, or
        // anything throws — so the read below is always safe.
        const blurred = await blurFacesInCanvas(singleCanvas);
        if (blurred !== singleCanvas) {
          singleCtx.clearRect(0, 0, w, h);
          singleCtx.drawImage(blurred, 0, 0);
        }
        allFrames.push(singleCtx.getImageData(0, 0, w, h));
      } catch {
        // Fail-open: if anything in the blur path explodes, fall back to the
        // raw frame we just drew so we still ship *something* to the user.
        try {
          allFrames.push(singleCtx.getImageData(0, 0, w, h));
        } catch {
          // If even the raw read fails, skip this frame.
        }
      }
    }

    const frames = allFrames.slice(1);

    if (frames.length === 0) {
      throw new Error("Failed to capture any frames");
    }

    const collage = document.createElement("canvas");
    collage.width = w * frames.length;
    collage.height = h;
    const ctx = collage.getContext("2d")!;
    for (let i = 0; i < frames.length; i++) {
      ctx.putImageData(frames[i], i * w, 0);
    }

    // Apply the operator's capture-quality knob: downscale the collage so each
    // frame's effective width respects ``maxFrameWidth``, then encode at the
    // chosen JPEG quality. "sharp" keeps native resolution + quality 1.0.
    const { jpegQuality, maxFrameWidth } = getCaptureQualityParams();
    const collageMaxWidth =
      maxFrameWidth === null ? null : maxFrameWidth * frames.length;
    const output = scaleCanvasToWidth(collage, collageMaxWidth);
    const dataUrl = output.toDataURL("image/jpeg", jpegQuality);
    return dataUrl.split(",")[1];
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}
