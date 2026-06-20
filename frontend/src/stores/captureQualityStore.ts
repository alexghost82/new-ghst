import { create } from "zustand";

// Photo capture quality the operator can tune from Advanced settings. It
// controls how the camera frame(s) sent for analysis are encoded:
//   - "fast":     downscaled + lighter compression  -> smaller image, quickest
//   - "balanced": mild downscale + good compression  -> middle ground
//   - "sharp":    full resolution, maximum quality   -> previous behaviour
// Defaults to "sharp" so there is zero change unless the operator opts in.
export type CaptureQuality = "fast" | "balanced" | "sharp";

export interface CaptureQualityParams {
  // JPEG encode quality (0..1) passed to canvas.toDataURL.
  jpegQuality: number;
  // Maximum width (px) of a single captured frame before encoding. ``null``
  // means no downscale (keep the camera's native resolution).
  maxFrameWidth: number | null;
}

const PARAMS: Record<CaptureQuality, CaptureQualityParams> = {
  fast: { jpegQuality: 0.7, maxFrameWidth: 854 },
  balanced: { jpegQuality: 0.85, maxFrameWidth: 1280 },
  sharp: { jpegQuality: 1.0, maxFrameWidth: null },
};

const STORAGE_KEY = "ghost-capture-quality";
const DEFAULT_QUALITY: CaptureQuality = "sharp";

function readStored(): CaptureQuality {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "fast" || raw === "balanced" || raw === "sharp"
    ? raw
    : DEFAULT_QUALITY;
}

interface CaptureQualityState {
  quality: CaptureQuality;
  setQuality: (quality: CaptureQuality) => void;
}

export const useCaptureQualityStore = create<CaptureQualityState>((set) => ({
  quality: readStored(),
  setQuality: (quality) => {
    localStorage.setItem(STORAGE_KEY, quality);
    set({ quality });
  },
}));

// Read the active capture params outside React (e.g. from the capture util)
// without subscribing to the store.
export function getCaptureQualityParams(): CaptureQualityParams {
  return PARAMS[useCaptureQualityStore.getState().quality];
}
