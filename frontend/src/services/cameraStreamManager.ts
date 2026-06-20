/**
 * Refcounted, persistent camera stream manager.
 *
 * Each ``deviceId`` is backed by a single hidden ``<video>`` element fed by a
 * shared ``MediaStream``. While a stream is active we keep a ring buffer of
 * up to ``BUFFER_SIZE`` recent decoded frames as ``ImageBitmap`` so any
 * consumer can grab the freshest frame in ~1ms via :func:`acquire().snapshotLatest`.
 *
 * Streams are reference counted: ``release()`` only stops the camera when the
 * last consumer hands back its ref. Multiple alert loops scanning the same
 * camera therefore share **one** ``getUserMedia`` session — no more 200–500ms
 * cold-open per cycle, no flicker, no double permission prompts.
 *
 * The frame loop uses ``HTMLVideoElement.requestVideoFrameCallback`` when
 * available and falls back to ``setInterval(100ms)`` otherwise. Captures are
 * throttled to roughly 10fps regardless of source — that's more than enough
 * to keep the buffer fresh while staying cheap on the main thread.
 */

const BUFFER_SIZE = 3;
const MIN_FRAME_INTERVAL_MS = 100;

/**
 * The operator's current on-screen framing for a camera, as displayed in the
 * live preview tile. ``snapshotLatest`` replays this exact framing onto the
 * captured native frame so the bytes sent for processing/display match what
 * the operator actually sees — the ``object-cover`` crop plus any digital PTZ
 * zoom/pan they configured. ``null``/absent means "no preview is framing this
 * device" → snapshots fall back to the full native FOV.
 */
export interface OperatorView {
  /** Display box width in CSS px (the tile's client width). */
  frameW: number;
  /** Display box height in CSS px (the tile's client height). */
  frameH: number;
  /** Digital zoom factor (1 = no zoom). */
  zoom: number;
  /** Pan offset in CSS px, matching the tile's CSS ``translate``. */
  panX: number;
  panY: number;
}

const operatorViews = new Map<string, OperatorView>();

function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Publish the operator's current preview framing for ``deviceId``. Called by
 * the live preview tile whenever its size / zoom / pan changes so subsequent
 * snapshots (alerts, tracking, thumbnails) crop to exactly what is on screen.
 */
export function setOperatorView(deviceId: string, view: OperatorView): void {
  operatorViews.set(deviceId, view);
}

/** Drop the published framing for ``deviceId`` → snapshots revert to full FOV. */
export function clearOperatorView(deviceId: string): void {
  operatorViews.delete(deviceId);
}

/**
 * Whether a live, warm shared stream is currently open for ``deviceId`` (i.e.
 * the live preview / a scan loop already has it running). Callers use this to
 * decide whether they can pull operator-framed snapshots from the shared
 * stream instead of opening a fresh, full-FOV ``getUserMedia`` session.
 */
export function isCameraStreamActive(deviceId: string): boolean {
  return !!slots.get(deviceId)?.stream;
}

type RVFCMetadata = {
  presentationTime: DOMHighResTimeStamp;
  expectedDisplayTime: DOMHighResTimeStamp;
  width: number;
  height: number;
  mediaTime: number;
  presentedFrames: number;
  processingDuration?: number;
};

type RVFC = (now: DOMHighResTimeStamp, metadata: RVFCMetadata) => void;

// The ``requestVideoFrameCallback`` API is now part of the base
// ``HTMLVideoElement`` lib types — we just reuse the metadata type
// (``RVFCMetadata``) we already declared above to keep the field names
// stable across older browsers that ship slightly different shapes.
type VideoWithRVFC = HTMLVideoElement;

interface BufferedFrame {
  bitmap: ImageBitmap;
  timestamp: number;
  width: number;
  height: number;
}

interface StreamSlot {
  deviceId: string;
  stream: MediaStream | null;
  video: VideoWithRVFC;
  consumers: Set<symbol>;
  buffer: BufferedFrame[];
  acquiring: Promise<void> | null;
  acquiringError: Error | null;
  rvfcHandle: number | null;
  rafTimer: ReturnType<typeof setInterval> | null;
  lastCaptureMs: number;
  capturing: boolean;
}

export interface CameraStreamHandle {
  /** Unique ref token used by release(). */
  readonly ref: symbol;
  readonly deviceId: string;
  /**
   * Returns a freshly-allocated canvas drawn from the most recent buffered
   * frame at the stream's native resolution. Cheap (~1–5ms); the caller is
   * responsible for any downscaling/encoding.
   */
  snapshotLatest: () => Promise<HTMLCanvasElement>;
  /**
   * The live ``MediaStream`` backing this device, or ``null`` if the stream
   * has been torn down. Attach it to a visible ``<video>`` (`srcObject`) for a
   * smooth, native, zero-latency preview that shares the single underlying
   * ``getUserMedia`` session — no extra camera open, no duplicate prompt.
   */
  getStream: () => MediaStream | null;
  /** Idempotent: drops this consumer's ref and tears down the stream
   *  iff no other consumer is still using it. */
  release: () => void;
  /**
   * Timestamps of frames currently in the ring buffer (oldest → newest),
   * monotonic via ``performance.now``. Useful for the optional motion gate.
   */
  bufferTimestamps: () => number[];
}

const slots = new Map<string, StreamSlot>();

function createSlot(deviceId: string): StreamSlot {
  const video = document.createElement("video") as VideoWithRVFC;
  video.playsInline = true;
  video.muted = true;
  // Keep the element off the DOM — it's purely a frame source.
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.setAttribute("aria-hidden", "true");
  return {
    deviceId,
    stream: null,
    video,
    consumers: new Set(),
    buffer: [],
    acquiring: null,
    acquiringError: null,
    rvfcHandle: null,
    rafTimer: null,
    lastCaptureMs: 0,
    capturing: false,
  };
}

function waitForReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (video.videoWidth > 0 && video.readyState >= 2) {
      resolve();
      return;
    }
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("loadedmetadata", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("loadedmetadata", onReady, { once: true });
  });
}

async function startStream(slot: StreamSlot): Promise<void> {
  // Request the highest practical resolution the device can deliver. The feed
  // is the single shared source for the live preview, digital PTZ zoom, alert
  // scanning and snapshots — a higher native resolution is what makes deep
  // zoom legible (e.g. reading a phone screen in someone's hand) instead of a
  // smeared upscale of a 480p frame. ``ideal`` never rejects, so cameras that
  // top out lower simply give their best; we don't force ``exact``.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: slot.deviceId },
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      frameRate: { ideal: 30 },
    },
  });
  slot.stream = stream;
  slot.video.srcObject = stream;
  // Detect device removal / OS-level revocation. If any track ends we tear
  // the slot down so the next ``acquire`` re-opens cleanly and consumers
  // immediately see a snapshot failure (which surfaces in the UI).
  for (const track of stream.getTracks()) {
    track.addEventListener(
      "ended",
      () => {
        if (slots.get(slot.deviceId) === slot) {
          teardown(slot);
          slots.delete(slot.deviceId);
        }
      },
      { once: true },
    );
  }
  try {
    await slot.video.play();
  } catch {
    // Autoplay may block in some browsers — readiness check below still works
    // because the stream is attached even without play(). If frames never
    // arrive, snapshotLatest will throw and the consumer's loop will retry.
  }
  await waitForReady(slot.video);
  startFrameLoop(slot);
}

function startFrameLoop(slot: StreamSlot): void {
  const v = slot.video;
  if (typeof v.requestVideoFrameCallback === "function") {
    const cb: RVFC = (now) => {
      if (now - slot.lastCaptureMs >= MIN_FRAME_INTERVAL_MS) {
        slot.lastCaptureMs = now;
        void captureFrame(slot, now);
      }
      if (slot.stream && v.requestVideoFrameCallback) {
        slot.rvfcHandle = v.requestVideoFrameCallback(cb);
      }
    };
    slot.rvfcHandle = v.requestVideoFrameCallback(cb);
  } else {
    slot.rafTimer = setInterval(() => {
      void captureFrame(slot, performance.now());
    }, MIN_FRAME_INTERVAL_MS);
  }
}

async function captureFrame(slot: StreamSlot, timestamp: number): Promise<void> {
  if (slot.capturing) return;
  const v = slot.video;
  if (v.videoWidth === 0 || v.videoHeight === 0) return;
  slot.capturing = true;
  try {
    const bitmap = await createImageBitmap(v);
    if (!slot.stream) {
      bitmap.close();
      return;
    }
    slot.buffer.push({
      bitmap,
      timestamp,
      width: v.videoWidth,
      height: v.videoHeight,
    });
    while (slot.buffer.length > BUFFER_SIZE) {
      const evicted = slot.buffer.shift();
      evicted?.bitmap.close();
    }
  } catch {
    // Skip this frame — single failures are non-fatal.
  } finally {
    slot.capturing = false;
  }
}

function teardown(slot: StreamSlot): void {
  if (
    slot.rvfcHandle !== null &&
    typeof slot.video.cancelVideoFrameCallback === "function"
  ) {
    slot.video.cancelVideoFrameCallback(slot.rvfcHandle);
  }
  slot.rvfcHandle = null;
  if (slot.rafTimer !== null) {
    clearInterval(slot.rafTimer);
    slot.rafTimer = null;
  }
  for (const frame of slot.buffer) {
    frame.bitmap.close();
  }
  slot.buffer = [];
  if (slot.stream) {
    slot.stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        // ignore
      }
    });
    slot.stream = null;
  }
  try {
    slot.video.srcObject = null;
  } catch {
    // ignore
  }
}

async function snapshotLatest(deviceId: string): Promise<HTMLCanvasElement> {
  const slot = slots.get(deviceId);
  if (!slot) {
    throw new Error(`cameraStreamManager: no active stream for ${deviceId}`);
  }
  // Brief wait for first frame if the buffer is still warming up.
  if (slot.buffer.length === 0) {
    const start = performance.now();
    while (slot.buffer.length === 0 && performance.now() - start < 500) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  const latest = slot.buffer[slot.buffer.length - 1];
  if (!latest) {
    throw new Error(
      `cameraStreamManager: no frames available for ${deviceId} yet`,
    );
  }

  // Source region to lift from the native frame. Defaults to the whole frame
  // (full FOV); when the operator has a preview framing this device, we crop
  // to the exact on-screen region instead.
  const vw = latest.width;
  const vh = latest.height;
  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;

  const view = operatorViews.get(deviceId);
  if (view && view.frameW > 0 && view.frameH > 0 && vw > 0 && vh > 0) {
    // The preview renders the video with CSS ``object-cover`` (scale by the
    // larger ratio, center-crop the overflow) and then applies a digital PTZ
    // ``translate(panX, panY) scale(zoom)`` about the center. We invert that
    // transform to recover the source-pixel rectangle that is actually on
    // screen, so the snapshot is byte-for-byte the operator's framing.
    const coverScale = Math.max(view.frameW / vw, view.frameH / vh);
    const zoom = view.zoom > 0 ? view.zoom : 1;
    // Visible source size = (display box / zoom) mapped back through cover scale.
    sw = view.frameW / (zoom * coverScale);
    sh = view.frameH / (zoom * coverScale);
    // Visible center in source px (pan shifts the framing, in CSS px).
    const cx = vw / 2 - view.panX / (zoom * coverScale);
    const cy = vh / 2 - view.panY / (zoom * coverScale);
    sw = Math.min(sw, vw);
    sh = Math.min(sh, vh);
    sx = clampNum(cx - sw / 2, 0, vw - sw);
    sy = clampNum(cy - sh / 2, 0, vh - sh);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("cameraStreamManager: 2d context unavailable");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    latest.bitmap,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function bufferTimestamps(deviceId: string): number[] {
  const slot = slots.get(deviceId);
  if (!slot) return [];
  return slot.buffer.map((f) => f.timestamp);
}

function getStream(deviceId: string): MediaStream | null {
  return slots.get(deviceId)?.stream ?? null;
}

function releaseRef(deviceId: string, ref: symbol): void {
  const slot = slots.get(deviceId);
  if (!slot) return;
  slot.consumers.delete(ref);
  if (slot.consumers.size === 0 && !slot.acquiring) {
    teardown(slot);
    slots.delete(deviceId);
  }
}

/**
 * Acquire a refcounted handle on the camera identified by ``deviceId``. The
 * first acquirer opens the underlying stream; subsequent acquirers share it.
 *
 * The returned handle MUST be released exactly once via ``handle.release()``
 * (or via :func:`releaseAll`). Failure to release leaks the camera until the
 * tab is closed.
 */
export async function acquire(
  deviceId: string,
): Promise<CameraStreamHandle> {
  let slot = slots.get(deviceId);
  if (!slot) {
    slot = createSlot(deviceId);
    slots.set(deviceId, slot);
  }
  if (!slot.stream && !slot.acquiring) {
    slot.acquiringError = null;
    slot.acquiring = startStream(slot).finally(() => {
      slot!.acquiring = null;
    });
  }
  if (slot.acquiring) {
    try {
      await slot.acquiring;
    } catch (err) {
      slot.acquiringError = err instanceof Error ? err : new Error(String(err));
      // No consumers were registered yet, so we can tear down the half-built
      // slot to make the next acquire() start fresh.
      if (slot.consumers.size === 0 && slots.get(deviceId) === slot) {
        teardown(slot);
        slots.delete(deviceId);
      }
      throw slot.acquiringError;
    }
  }
  const ref = Symbol("ghost-cam-consumer");
  slot.consumers.add(ref);
  return {
    ref,
    deviceId,
    snapshotLatest: () => snapshotLatest(deviceId),
    getStream: () => getStream(deviceId),
    release: () => releaseRef(deviceId, ref),
    bufferTimestamps: () => bufferTimestamps(deviceId),
  };
}

/** Force-release all active streams. Useful in tests and on full app teardown. */
export function releaseAll(): void {
  for (const [deviceId, slot] of Array.from(slots.entries())) {
    teardown(slot);
    slots.delete(deviceId);
  }
}

/** For debugging: number of active streams currently held. */
export function activeStreamCount(): number {
  return slots.size;
}
