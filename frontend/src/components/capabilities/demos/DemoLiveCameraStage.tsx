import { ChevronDown, Video } from "lucide-react";
import { useThemeStore } from "../../../stores/themeStore";
import { useLanguageStore } from "../../../stores/languageStore";

// Faithful, isolated replica of `components/chat/LiveCameraStage.tsx` (and its
// `LiveCameraTile`). The live `<video>` + MediaPipe segmentation are swapped for
// a static poster frame, but the framing, watermark, camera tag and LIVE stamp
// markup are copied 1:1 from the real tile.
function DemoTile({ label, src }: { label: string; src: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div className="ghost-visint-frame relative overflow-hidden rounded-2xl w-full h-full min-h-0">
      <img
        src={src}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover block"
        style={{ filter: "grayscale(1) contrast(1.05) brightness(1.02)" }}
        draggable={false}
      />
      <span className="ghost-visint-watermark" aria-hidden="true">
        <img
          src={theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png"}
          alt=""
          draggable={false}
        />
      </span>
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
    </div>
  );
}

export default function DemoLiveCameraStage() {
  const locale = useLanguageStore((s) => s.locale);
  const countLabel =
    locale === "he" ? "2 \u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05e4\u05e2\u05d9\u05dc\u05d5\u05ea" : "2 cameras live";
  const collapse = locale === "he" ? "\u05de\u05d6\u05e2\u05e8" : "Collapse";
  const cams =
    locale === "he"
      ? [
          { label: "\u05e9\u05e2\u05e8 \u05e8\u05d0\u05e9\u05d9 \u00b7 CAM-04", src: "/ghost-cam-gate-night.png" },
          { label: "\u05e8\u05e6\u05d9\u05e3 \u05e4\u05e8\u05d9\u05e7\u05d4 \u00b7 CAM-11", src: "/ghost-cam-dock-night.png" },
        ]
      : [
          { label: "Main Gate \u00b7 CAM-04", src: "/ghost-cam-gate-night.png" },
          { label: "Loading Bay \u00b7 CAM-11", src: "/ghost-cam-dock-night.png" },
        ];

  return (
    <div className="bg-ghost-bg py-4">
      <div className="flex-shrink-0 px-4">
        <div className="max-w-chat mx-auto">
          <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-ghost-text-primary animate-pulse flex-shrink-0" />
              <span className="text-xs font-medium text-ghost-text-secondary truncate">
                {countLabel}
              </span>
            </span>
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[12px] text-ghost-text-muted rounded-full px-2 py-1">
              <span>{collapse}</span>
              <ChevronDown size={14} />
            </span>
          </div>

          <div className="ghost-visint-stage relative mx-auto" style={{ height: 300, maxWidth: "100%" }}>
            <div
              className="grid gap-2 w-full h-full"
              style={{
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gridAutoRows: "minmax(0, 1fr)",
              }}
            >
              {cams.map((c) => (
                <DemoTile key={c.label} label={c.label} src={c.src} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
