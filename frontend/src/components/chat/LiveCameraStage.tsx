import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Radio,
  RotateCcw,
  Square,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useLiveStore } from "../../stores/liveStore";
import { useAlertStore } from "../../stores/alertStore";
import { useThemeStore } from "../../stores/themeStore";
import { useT } from "../../utils/i18n";
import {
  acquire,
  setOperatorView,
  clearOperatorView,
  type CameraStreamHandle,
} from "../../services/cameraStreamManager";
import {
  segmentVideo,
  prewarmObjectSegmenter,
  type CategoryMask,
} from "../../services/objectSegmenter";
import type { ActiveCamera } from "../../stores/liveStore";

// Stable reference for the "no live cameras" case. Returning a fresh `[]` from
// a zustand selector on every render makes the snapshot never compare equal,
// which drives an infinite render loop (white-screen crash) under React 18's
// useSyncExternalStore. Reuse one frozen array instead.
const EMPTY_CAMERAS: ActiveCamera[] = [];

// User-resizable feed dimensions are persisted globally so the chosen size
// survives conversation switches and reloads.
const SIZE_KEY = "ghost:livePreviewSize";
const MIN_W = 220;
const MIN_H = 140;

interface FeedSize {
  /** ``null`` means "fill the container width" (the un-resized default). */
  width: number | null;
  height: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

// Digital PTZ (color view) bounds. The default grayscale view is untouched;
// PTZ is a separate, opt-in display mode layered purely with CSS transforms.
const PTZ_MIN_ZOOM = 1;
const PTZ_MAX_ZOOM = 8;
const PTZ_WHEEL_FACTOR = 1.18;

interface Pan {
  x: number;
  y: number;
}

// Clamp the pan offset (in CSS px) so the zoomed video never reveals an empty
// edge: at zoom ``z`` the frame can shift at most half the overflow each way.
function clampPan(p: Pan, zoom: number, frame: HTMLElement | null): Pan {
  if (!frame) return p;
  const maxX = Math.max(0, (frame.clientWidth * (zoom - 1)) / 2);
  const maxY = Math.max(0, (frame.clientHeight * (zoom - 1)) / 2);
  return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) };
}

// A finished, downloadable recording held in-tile until the operator grabs it.
interface RecordedClip {
  id: number;
  url: string;
  name: string;
  secs: number;
  ext: string;
}

// Pick the best container/codec the browser will actually record. WebM/VP9 is
// the preferred quality tier; we fall back gracefully (Safari prefers MP4).
function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return undefined;
}

function fmtClock(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Filesystem-safe, human-readable clip name: "<camera>-2026-06-09_18-06-12".
function buildClipName(label: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const safe =
    (label || "camera").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ||
    "camera";
  return `${safe}-${stamp}`;
}

function loadSize(): FeedSize | null {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<FeedSize>;
    if (typeof v?.height === "number") {
      return {
        width: typeof v.width === "number" ? v.width : null,
        height: v.height,
      };
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

function saveSize(s: FeedSize): void {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(s));
  } catch {
    // ignore quota / privacy-mode failures
  }
}

function defaultSize(): FeedSize {
  const h =
    typeof window !== "undefined"
      ? Math.round(Math.min(window.innerHeight * 0.4, 460))
      : 320;
  return { width: null, height: h };
}

// Throttle on-device segmentation to ~8fps; the native video keeps playing at
// full frame rate underneath, only the mask overlay refreshes at this cadence.
const DETECT_INTERVAL_MS = 120;

// Pascal VOC class indices (DeepLab-v3 label map).
const PERSON_CLASS = 15;
const VEHICLE_CLASSES = new Set([1, 2, 4, 6, 7, 14, 19]);

// Mask fill colours (RGBA). Person = cyan, vehicle = amber.
const PERSON_RGBA: [number, number, number, number] = [34, 211, 238, 130];
const VEHICLE_RGBA: [number, number, number, number] = [251, 191, 36, 130];

// Reused offscreen canvas the silhouette mask is rasterized into before being
// scaled onto the display overlay. One per tile via a ref-less module cache is
// unsafe across tiles, so each paint call lazily creates/reuses via closure.
/**
 * Rasterize a category mask into an RGBA silhouette canvas: person/vehicle
 * pixels get a translucent colour, everything else stays fully transparent.
 * Returns ``null`` when no person/vehicle pixels are present.
 */
function buildSilhouetteCanvas(
  mask: CategoryMask,
  scratch: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const { data, width, height } = mask;
  if (width === 0 || height === 0) return null;
  if (scratch.width !== width) scratch.width = width;
  if (scratch.height !== height) scratch.height = height;
  const ctx = scratch.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(width, height);
  const px = img.data;
  let painted = false;
  for (let i = 0; i < data.length; i += 1) {
    const cls = data[i];
    const o = i * 4;
    if (cls === PERSON_CLASS) {
      px[o] = PERSON_RGBA[0];
      px[o + 1] = PERSON_RGBA[1];
      px[o + 2] = PERSON_RGBA[2];
      px[o + 3] = PERSON_RGBA[3];
      painted = true;
    } else if (VEHICLE_CLASSES.has(cls)) {
      px[o] = VEHICLE_RGBA[0];
      px[o + 1] = VEHICLE_RGBA[1];
      px[o + 2] = VEHICLE_RGBA[2];
      px[o + 3] = VEHICLE_RGBA[3];
      painted = true;
    } else {
      px[o + 3] = 0;
    }
  }
  if (!painted) return null;
  ctx.putImageData(img, 0, 0);
  return scratch;
}

/**
 * Paint the silhouette mask onto the display overlay, mapped through the same
 * ``object-cover`` transform the video uses so the mask aligns pixel-for-pixel
 * with the cropped feed. ``mask`` of ``null`` clears the overlay.
 */
function paintSegmentation(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  mask: CategoryMask | null,
  scratch: HTMLCanvasElement,
): void {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW === 0 || cssH === 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.round(cssW * dpr);
  const bh = Math.round(cssH * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  if (!mask) return;
  const silhouette = buildSilhouetteCanvas(mask, scratch);
  if (!silhouette) return;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  // ``object-cover`` scales by the larger ratio and center-crops the overflow.
  const scale = Math.max(cssW / vw, cssH / vh);
  const renderedW = vw * scale;
  const renderedH = vh * scale;
  const offsetX = (cssW - renderedW) / 2;
  const offsetY = (cssH - renderedH) / 2;

  // Smoothing softens the upscaled mask edges into a clean silhouette.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    silhouette,
    0,
    0,
    silhouette.width,
    silhouette.height,
    offsetX,
    offsetY,
    renderedW,
    renderedH,
  );
}

/**
 * In-chat live camera stage. Renders the conversation's active cameras as a
 * smooth, native ``<video>`` feed (zero-latency, shares the single underlying
 * ``getUserMedia`` session via ``cameraStreamManager``). Sits directly above
 * the composer so the operator sees the field in real time while chatting.
 *
 * Only mounts when the active conversation is in live mode with >=1 camera.
 * Can be minimized to a slim bar, re-expanded, and freely resized (width +
 * height) by dragging either of the bottom corner handles.
 */
export default function LiveCameraStage() {
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId,
  );
  const cameras =
    useLiveStore((s) =>
      activeConversationId
        ? s.liveConversations[activeConversationId]
        : undefined,
    ) ?? EMPTY_CAMERAS;
  const collapsed = useLiveStore((s) => s.previewCollapsed);
  const togglePreviewCollapsed = useLiveStore((s) => s.togglePreviewCollapsed);
  const t = useT();

  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ centerX: number; top: number; maxW: number } | null>(
    null,
  );
  const [size, setSize] = useState<FeedSize>(() => loadSize() ?? defaultSize());

  if (!activeConversationId || cameras.length === 0) return null;

  const countLabel =
    cameras.length > 1
      ? t("liveCamerasActive").replace("{count}", String(cameras.length))
      : t("liveCameraActive");

  const gridCols = cameras.length === 1 ? 1 : 2;

  const beginResize = (e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const parentWidth = box.parentElement?.clientWidth ?? rect.width;
    dragRef.current = {
      centerX: rect.left + rect.width / 2,
      top: rect.top,
      maxW: parentWidth,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const moveResize = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const maxH = window.innerHeight * 0.8;
    // Width grows symmetrically around the box center so the feed stays
    // centered while either bottom corner is dragged.
    const width = Math.round(
      clamp(2 * Math.abs(e.clientX - d.centerX), MIN_W, d.maxW),
    );
    const height = Math.round(clamp(e.clientY - d.top, MIN_H, maxH));
    setSize({ width, height });
  };

  const endResize = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setSize((s) => {
      saveSize(s);
      return s;
    });
  };

  const handleProps = {
    onPointerDown: beginResize,
    onPointerMove: moveResize,
    onPointerUp: endResize,
    onPointerCancel: endResize,
  };

  return (
    <div className="flex-shrink-0 px-4 pt-1 pb-1">
      <div className="max-w-chat mx-auto">
        <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-ghost-text-primary animate-pulse flex-shrink-0" />
            <span className="text-xs font-medium text-ghost-text-secondary truncate">
              {countLabel}
            </span>
          </span>
          <button
            type="button"
            onClick={togglePreviewCollapsed}
            className="
              flex-shrink-0 inline-flex items-center gap-1
              text-[12px] text-ghost-text-muted hover:text-ghost-text-secondary
              rounded-full px-2 py-1
              hover:bg-ghost-surface-hover transition-colors duration-[100ms]
            "
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? t("livePreviewExpand") : t("livePreviewCollapse")
            }
            title={collapsed ? t("livePreviewExpand") : t("livePreviewCollapse")}
          >
            {collapsed ? (
              <>
                <Radio size={13} />
                <span>{t("livePreviewExpand")}</span>
                <ChevronUp size={14} />
              </>
            ) : (
              <>
                <span>{t("livePreviewCollapse")}</span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>

        {!collapsed && (
          <div
            ref={boxRef}
            className="ghost-visint-stage relative mx-auto"
            style={{
              width: size.width != null ? `${size.width}px` : "100%",
              height: `${size.height}px`,
              maxWidth: "100%",
            }}
          >
            <div
              className="grid gap-2 w-full h-full"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                gridAutoRows: "minmax(0, 1fr)",
              }}
            >
              {cameras.map((cam) => (
                <LiveCameraTile
                  key={cam.device_id}
                  deviceId={cam.device_id}
                  label={cam.label}
                />
              ))}
            </div>

            <ResizeHandle corner="bl" {...handleProps} />
            <ResizeHandle corner="br" {...handleProps} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResizeHandle({
  corner,
  ...handlers
}: {
  corner: "bl" | "br";
} & Pick<
  React.HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
>) {
  const isLeft = corner === "bl";
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      {...handlers}
      className={`
        group absolute bottom-0 z-10 w-7 h-7 touch-none
        flex items-end ${isLeft ? "left-0 justify-start" : "right-0 justify-end"}
        ${isLeft ? "cursor-nesw-resize" : "cursor-nwse-resize"}
      `}
    >
      <span
        className={`
          m-1 w-3 h-3 border-white/70
          ${isLeft ? "border-l-2 border-b-2 rounded-bl" : "border-r-2 border-b-2 rounded-br"}
          opacity-50 group-hover:opacity-90 transition-opacity duration-[120ms]
        `}
        aria-hidden="true"
      />
    </div>
  );
}

type TileStatus = "connecting" | "live" | "error";
type AudioStatus = "off" | "loading" | "on" | "unavailable";

/**
 * Acquire a live audio MediaStream from the microphone that belongs to the
 * same physical device as the chosen camera (matched by ``groupId``). This is
 * a separate ``getUserMedia`` session from the shared video stream so toggling
 * audio never disturbs the latency-critical video frame loop / alert scan.
 *
 * Falls back to the default audio input when no group match is found. Returns
 * ``null`` when the device exposes no microphone the browser will grant.
 */
async function acquireDeviceAudio(
  videoDeviceId: string,
): Promise<MediaStream | null> {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) return null;

  let groupId: string | undefined;
  try {
    const devices = await md.enumerateDevices();
    groupId = devices.find(
      (d) => d.kind === "videoinput" && d.deviceId === videoDeviceId,
    )?.groupId;
    const audioMatch = groupId
      ? devices.find((d) => d.kind === "audioinput" && d.groupId === groupId)
      : undefined;
    if (audioMatch?.deviceId) {
      try {
        return await md.getUserMedia({
          audio: { deviceId: { exact: audioMatch.deviceId } },
        });
      } catch {
        // Fall through to the generic request below.
      }
    }
  } catch {
    // enumerateDevices can fail before permission — fall through.
  }

  try {
    return await md.getUserMedia({ audio: true });
  } catch {
    return null;
  }
}

function LiveCameraTile({
  deviceId,
  label,
}: {
  deviceId: string;
  label: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const panDragRef = useRef<
    { startX: number; startY: number; panX: number; panY: number } | null
  >(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSecsRef = useRef(0);
  const clipsRef = useRef<RecordedClip[]>([]);
  const clipIdRef = useRef(0);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  if (scratchRef.current === null) {
    scratchRef.current = document.createElement("canvas");
  }
  const [status, setStatus] = useState<TileStatus>("connecting");
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("off");
  // PTZ (color + digital zoom/pan) is an opt-in alternative to the default
  // grayscale "intel" view. ``ptz === false`` is the original, untouched mode.
  const [ptz, setPtz] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [clips, setClips] = useState<RecordedClip[]>([]);
  // Alerts are top priority: while alert mode is active anywhere, suspend the
  // per-frame segmentation overlay so MediaPipe inference never competes with
  // the latency-critical alert scan for the main thread / GPU.
  const alertActive = useAlertStore((s) =>
    Object.values(s.alertModeEnabled).some(Boolean),
  );
  const theme = useThemeStore((s) => s.theme);
  const t = useT();
  // Unique SVG filter id so multiple tiles don't clash on the shared sharpen
  // convolution used by PTZ mode.
  const sharpenId = `ghost-ptz-sharpen-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    let cancelled = false;
    let handle: CameraStreamHandle | null = null;

    const attach = async () => {
      setStatus("connecting");
      prewarmObjectSegmenter();
      try {
        handle = await acquire(deviceId);
        if (cancelled) {
          handle.release();
          handle = null;
          return;
        }
        const stream = handle.getStream();
        const video = videoRef.current;
        if (!stream || !video) {
          setStatus("error");
          return;
        }
        video.srcObject = stream;
        // Autoplay can reject if the tab is backgrounded; the stream is still
        // attached so it resumes on its own. We don't surface that as an error.
        video.play().catch(() => {});
        setStatus("live");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void attach();

    return () => {
      cancelled = true;
      const video = videoRef.current;
      if (video) {
        try {
          video.srcObject = null;
        } catch {
          // ignore
        }
      }
      handle?.release();
      handle = null;
    };
  }, [deviceId]);

  // Real-time segmentation → silhouette mask overlay loop. Runs only while
  // the feed is live.
  useEffect(() => {
    if (status !== "live") return;
    const video = videoRef.current;
    const canvas = overlayRef.current;
    const scratch = scratchRef.current;
    if (!video || !canvas || !scratch) return;
    if (alertActive || ptz) {
      // Clear any stale silhouette so the overlay doesn't freeze mid-mask.
      // In PTZ mode the feed is zoomed/panned, so a frame-aligned mask would
      // no longer line up — suspend it until the operator returns to default.
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let stopped = false;
    let raf = 0;
    let lastDetect = 0;

    const tick = async (now: number) => {
      if (stopped) return;
      if (now - lastDetect >= DETECT_INTERVAL_MS) {
        lastDetect = now;
        const mask = await segmentVideo(video);
        if (stopped) return;
        try {
          paintSegmentation(canvas, video, mask, scratch);
        } catch {
          // A bad frame must never break the live feed.
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [status, alertActive, ptz]);

  // Publish the operator's on-screen framing (display box size + digital PTZ
  // zoom/pan) so every snapshot consumer — alert scan, object tracking, the
  // sidebar thumbnail — captures the EXACT frame the operator sees, cropped
  // and zoomed identically. In the default (non-PTZ) view that is just the
  // ``object-cover`` crop (zoom 1, no pan); in PTZ view it includes the
  // operator's zoom and pan. Re-published on resize via ResizeObserver.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || status !== "live") {
      clearOperatorView(deviceId);
      return;
    }
    const publish = () => {
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      if (w <= 0 || h <= 0) return;
      setOperatorView(deviceId, {
        frameW: w,
        frameH: h,
        zoom: ptz ? zoom : 1,
        panX: ptz ? pan.x : 0,
        panY: ptz ? pan.y : 0,
      });
    };
    publish();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => publish())
        : null;
    ro?.observe(frame);
    return () => {
      ro?.disconnect();
      clearOperatorView(deviceId);
    };
  }, [deviceId, status, ptz, zoom, pan.x, pan.y]);

  // ── Digital PTZ controls (color mode only) ──────────────────────────────
  const applyZoom = (next: number) => {
    const z = clamp(next, PTZ_MIN_ZOOM, PTZ_MAX_ZOOM);
    setZoom(z);
    setPan((p) => clampPan(p, z, frameRef.current));
  };

  const resetPtz = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const togglePtz = () => {
    setPtz((on) => {
      if (on) resetPtz();
      return !on;
    });
  };

  // Wheel-to-zoom, attached natively so we can call preventDefault (React's
  // synthetic wheel handler is passive and would warn).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ptz) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? PTZ_WHEEL_FACTOR : 1 / PTZ_WHEEL_FACTOR;
      setZoom((prev) => {
        const z = clamp(prev * factor, PTZ_MIN_ZOOM, PTZ_MAX_ZOOM);
        setPan((p) => clampPan(p, z, frameRef.current));
        return z;
      });
    };
    video.addEventListener("wheel", onWheel, { passive: false });
    return () => video.removeEventListener("wheel", onWheel);
  }, [ptz]);

  const onPanPointerDown = (e: React.PointerEvent) => {
    if (!ptz || zoom <= 1) return;
    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPanPointerMove = (e: React.PointerEvent) => {
    const d = panDragRef.current;
    if (!d) return;
    const next = {
      x: d.panX + (e.clientX - d.startX),
      y: d.panY + (e.clientY - d.startY),
    };
    setPan(clampPan(next, zoom, frameRef.current));
  };

  const endPan = (e: React.PointerEvent) => {
    if (!panDragRef.current) return;
    panDragRef.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // ── In-channel video recording ──────────────────────────────────────────
  const startRecording = () => {
    if (recorderRef.current) return;
    const baseStream = videoRef.current?.srcObject as MediaStream | null;
    if (!baseStream) return;

    // Record the raw camera feed (full FOV, native resolution). If the
    // operator is currently monitoring audio, fold that track in too.
    const videoTracks = baseStream.getVideoTracks();
    const audioTracks = audioStreamRef.current?.getAudioTracks() ?? [];
    const recordStream = new MediaStream([...videoTracks, ...audioTracks]);

    const mimeType = pickRecorderMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(
        recordStream,
        mimeType ? { mimeType } : undefined,
      );
    } catch {
      return;
    }

    const ext = (rec.mimeType || mimeType || "video/webm").includes("mp4")
      ? "mp4"
      : "webm";
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size === 0) return;
      const url = URL.createObjectURL(blob);
      const clip: RecordedClip = {
        id: (clipIdRef.current += 1),
        url,
        name: `${buildClipName(label)}.${ext}`,
        secs: recordSecsRef.current,
        ext,
      };
      setClips((prev) => [...prev, clip]);
    };

    // Timeslice so dataavailable fires periodically — long recordings stay
    // memory-bounded and a crash still leaves recoverable chunks.
    rec.start(1000);
    recorderRef.current = rec;
    recordSecsRef.current = 0;
    setRecordSecs(0);
    setRecording(true);
    recordTimerRef.current = setInterval(() => {
      recordSecsRef.current += 1;
      setRecordSecs(recordSecsRef.current);
    }, 1000);
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
  };

  const downloadClip = (clip: RecordedClip) => {
    const a = document.createElement("a");
    a.href = clip.url;
    a.download = clip.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const deleteClip = (id: number) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((c) => c.id !== id);
    });
  };

  // Keep a ref mirror of clips so the unmount cleanup can revoke every blob
  // URL without re-running on each new clip.
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  // Stop any in-flight recording and free all blob URLs when the tile goes
  // away (conversation switch, camera removed, unmount).
  useEffect(() => {
    return () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, []);

  const ptzActive = zoom > 1 || pan.x !== 0 || pan.y !== 0;

  // Auto detail-enhancement: a center-weighted 3×3 sharpen convolution whose
  // strength grows with the digital zoom, recovering small details that the
  // upscale would otherwise smear. Divisor stays 1 (kernel sums to 1) so the
  // exposure is preserved.
  const sharpenK = clamp((zoom - 1) * 0.16, 0, 0.85);
  const sharpenKernel = `0 ${-sharpenK} 0 ${-sharpenK} ${1 + 4 * sharpenK} ${-sharpenK} 0 ${-sharpenK} 0`;
  const ptzFilter = `url(#${sharpenId}) contrast(1.06) saturate(1.05) brightness(1.02)`;

  const stopAudio = () => {
    const stream = audioStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((tr) => {
        try {
          tr.stop();
        } catch {
          // ignore
        }
      });
    }
    audioStreamRef.current = null;
    const el = audioRef.current;
    if (el) {
      try {
        el.srcObject = null;
      } catch {
        // ignore
      }
    }
  };

  // Stop monitoring audio whenever the device changes or the tile unmounts so
  // we never leak a microphone session.
  useEffect(() => {
    return () => stopAudio();
  }, [deviceId]);

  const toggleAudio = async () => {
    if (audioStatus === "on" || audioStatus === "loading") {
      stopAudio();
      setAudioStatus("off");
      return;
    }
    setAudioStatus("loading");
    const stream = await acquireDeviceAudio(deviceId);
    if (!stream) {
      setAudioStatus("unavailable");
      return;
    }
    audioStreamRef.current = stream;
    const el = audioRef.current;
    if (!el) {
      stopAudio();
      setAudioStatus("unavailable");
      return;
    }
    el.srcObject = stream;
    el.muted = false;
    try {
      await el.play();
      setAudioStatus("on");
    } catch {
      stopAudio();
      setAudioStatus("unavailable");
    }
  };

  const audioActive = audioStatus === "on";
  const audioLoading = audioStatus === "loading";

  return (
    <div
      ref={frameRef}
      className="ghost-visint-frame relative overflow-hidden rounded-2xl w-full h-full min-h-0"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onPointerDown={onPanPointerDown}
        onPointerMove={onPanPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className="absolute inset-0 w-full h-full object-cover block"
        style={{
          filter: ptz
            ? ptzFilter
            : "grayscale(1) contrast(1.05) brightness(1.02)",
          transform: ptz
            ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            : undefined,
          transformOrigin: "center center",
          transition: dragging ? "none" : "transform 140ms ease-out",
          cursor: ptz && zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
          touchAction: ptz ? "none" : undefined,
        }}
      />

      {ptz && (
        <svg
          width="0"
          height="0"
          aria-hidden="true"
          style={{ position: "absolute" }}
        >
          <filter
            id={sharpenId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feConvolveMatrix
              order="3"
              preserveAlpha="true"
              kernelMatrix={sharpenKernel}
            />
          </filter>
        </svg>
      )}

      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full z-[2] pointer-events-none"
        aria-hidden="true"
      />

      {!ptz && (
        <span className="ghost-visint-watermark" aria-hidden="true">
          <img
            src={
              theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png"
            }
            alt=""
            draggable={false}
          />
        </span>
      )}

      <span className="ghost-visint-camera" dir="auto">
        <Video size={11} strokeWidth={2} />
        <span className="ghost-visint-camera-name">{label}</span>
      </span>

      <span className="ghost-visint-stamp" dir="ltr" style={{ zIndex: 5 }}>
        <span className="inline-flex items-center gap-1.5 text-white/90 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-ghost-error animate-pulse" />
          LIVE
        </span>
      </span>

      {status === "live" && (
        <div
          className="absolute top-2 z-[6] flex flex-col gap-1"
          style={{ insetInlineStart: "0.5rem" }}
        >
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            className={`
              inline-flex items-center gap-1.5 h-8 rounded-full
              backdrop-blur-sm transition-colors duration-[120ms]
              ${recording ? "px-2.5 bg-ghost-error/90 text-white hover:bg-ghost-error" : "w-8 justify-center bg-black/45 text-white/85 hover:bg-black/65 hover:text-white"}
            `}
            aria-pressed={recording}
            aria-label={recording ? t("liveRecordStop") : t("liveRecordStart")}
            title={recording ? t("liveRecordStop") : t("liveRecordStart")}
          >
            {recording ? (
              <>
                <Square size={12} fill="currentColor" />
                <span className="text-[11px] font-medium tabular-nums">
                  {fmtClock(recordSecs)}
                </span>
              </>
            ) : (
              <Circle size={15} fill="currentColor" className="text-ghost-error" />
            )}
          </button>

          <button
            type="button"
            onClick={togglePtz}
            className={`
              inline-flex items-center justify-center w-8 h-8 rounded-full
              backdrop-blur-sm transition-colors duration-[120ms]
              ${
                ptz
                  ? "bg-white/85 text-black hover:bg-white"
                  : "bg-black/45 text-white/85 hover:bg-black/65 hover:text-white"
              }
            `}
            aria-pressed={ptz}
            aria-label={ptz ? t("liveViewDefault") : t("liveViewEnhance")}
            title={ptz ? t("liveViewDefault") : t("liveViewEnhance")}
          >
            {ptz ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {ptz && (
            <>
              <button
                type="button"
                onClick={() => applyZoom(zoom * PTZ_WHEEL_FACTOR)}
                disabled={zoom >= PTZ_MAX_ZOOM}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-sm bg-black/45 text-white/85 hover:bg-black/65 hover:text-white disabled:opacity-40 disabled:hover:bg-black/45 transition-colors duration-[120ms]"
                aria-label={t("liveZoomIn")}
                title={t("liveZoomIn")}
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={() => applyZoom(zoom / PTZ_WHEEL_FACTOR)}
                disabled={zoom <= PTZ_MIN_ZOOM}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-sm bg-black/45 text-white/85 hover:bg-black/65 hover:text-white disabled:opacity-40 disabled:hover:bg-black/45 transition-colors duration-[120ms]"
                aria-label={t("liveZoomOut")}
                title={t("liveZoomOut")}
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={resetPtz}
                disabled={!ptzActive}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-sm bg-black/45 text-white/85 hover:bg-black/65 hover:text-white disabled:opacity-40 disabled:hover:bg-black/45 transition-colors duration-[120ms]"
                aria-label={t("livePtzReset")}
                title={t("livePtzReset")}
              >
                <RotateCcw size={15} />
              </button>
            </>
          )}
        </div>
      )}

      {status === "live" && ptz && !dragging && clips.length === 0 && (
        <span
          className="absolute bottom-2 z-[5] px-2 py-1 rounded-full bg-black/45 backdrop-blur-sm text-[10px] text-white/80 pointer-events-none"
          style={{ insetInlineStart: "0.5rem" }}
          dir="auto"
        >
          {t("livePtzHint")}
        </span>
      )}

      {clips.length > 0 && (
        <div
          className="absolute bottom-2 z-[6] flex items-center gap-1.5 overflow-x-auto"
          style={{ insetInlineStart: "0.5rem", maxWidth: "calc(100% - 1rem)" }}
        >
          {clips.map((clip) => (
            <span
              key={clip.id}
              className="inline-flex items-center gap-1 flex-shrink-0 rounded-full bg-black/60 backdrop-blur-sm py-1 ps-2 pe-1 text-[11px] text-white/90"
            >
              <button
                type="button"
                onClick={() => downloadClip(clip)}
                className="inline-flex items-center gap-1 hover:text-white"
                aria-label={t("liveRecordDownload")}
                title={t("liveRecordDownload")}
              >
                <Download size={13} />
                <span className="tabular-nums">{fmtClock(clip.secs)}</span>
              </button>
              <button
                type="button"
                onClick={() => deleteClip(clip.id)}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white/50 hover:text-white"
                aria-label={t("liveRecordDelete")}
                title={t("liveRecordDelete")}
              >
                <Trash2 size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {status === "live" && (
        <button
          type="button"
          onClick={toggleAudio}
          disabled={audioLoading}
          className={`
            absolute bottom-2 z-[6] inline-flex items-center justify-center
            w-8 h-8 rounded-full backdrop-blur-sm transition-colors duration-[120ms]
            ${
              audioActive
                ? "bg-ghost-error/85 text-white hover:bg-ghost-error"
                : audioStatus === "unavailable"
                  ? "bg-black/40 text-white/45 hover:bg-black/55"
                  : "bg-black/45 text-white/85 hover:bg-black/65 hover:text-white"
            }
          `}
          style={{ insetInlineEnd: "0.5rem" }}
          aria-pressed={audioActive}
          aria-label={audioActive ? t("liveAudioMute") : t("liveAudioListen")}
          title={
            audioStatus === "unavailable"
              ? t("liveAudioUnavailable")
              : audioActive
                ? t("liveAudioMute")
                : t("liveAudioListen")
          }
        >
          {audioLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : audioActive ? (
            <Volume2 size={15} />
          ) : (
            <VolumeX size={15} />
          )}
        </button>
      )}

      <audio ref={audioRef} className="hidden" />


      {status !== "live" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-center px-3">
          <span className="text-[12px] text-white/80">
            {status === "error"
              ? t("livePreviewError")
              : t("livePreviewConnecting")}
          </span>
        </div>
      )}
    </div>
  );
}
