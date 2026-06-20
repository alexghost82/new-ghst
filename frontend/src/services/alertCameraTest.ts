/**
 * Pre-flight check for the alert mode camera pipeline.
 *
 * Acquires the camera the alert engine would pick for a conversation, waits
 * for the first frame to land in the ring buffer, then releases the handle.
 * Returns a structured result the UI can act on (success → enable alert
 * mode; failure → show actionable error).
 *
 * Safe to call repeatedly: leverages the same refcounted stream manager so
 * a parallel alert loop on the same device is unaffected.
 */

import { acquire as acquireStream } from "./cameraStreamManager";
import { useLiveStore } from "../stores/liveStore";

export type AlertCameraTestErrorCode =
  | "no_camera"
  | "permission_denied"
  | "device_busy"
  | "no_frame"
  | "unknown";

export interface AlertCameraTestResult {
  ok: boolean;
  deviceId: string | null;
  cameraLabel: string | null;
  errorCode?: AlertCameraTestErrorCode;
  errorMessage?: string;
}

function pickCameraForConversation(
  conversationId: string,
): { deviceId: string; label: string } | null {
  const live = useLiveStore.getState();
  const active = live.getActiveCameras(conversationId);
  if (active.length > 0) {
    return { deviceId: active[0].device_id, label: active[0].label };
  }
  const saved = live.savedCameras[conversationId] ?? [];
  if (saved.length > 0) {
    return { deviceId: saved[0].device_id, label: saved[0].label };
  }
  return null;
}

function classifyError(err: unknown): {
  code: AlertCameraTestErrorCode;
  message: string;
} {
  const e = err as { name?: string; message?: string } | null | undefined;
  const name = e?.name ?? "";
  const message = e?.message ?? String(err ?? "Unknown error");
  if (name === "NotAllowedError" || name === "SecurityError") {
    return { code: "permission_denied", message };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return { code: "device_busy", message };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { code: "no_camera", message };
  }
  return { code: "unknown", message };
}

/**
 * Run a pre-flight check for ``conversationId`` and return whether the alert
 * mode pipeline can be enabled right now.
 *
 * Implementation: acquire → snapshotLatest → release. Both acquire and
 * snapshot already wait for the first decoded frame internally, so a
 * successful return guarantees the camera is genuinely producing pixels.
 */
export async function testAlertCameraConnection(
  conversationId: string,
): Promise<AlertCameraTestResult> {
  const picked = pickCameraForConversation(conversationId);
  if (!picked) {
    return {
      ok: false,
      deviceId: null,
      cameraLabel: null,
      errorCode: "no_camera",
      errorMessage: "No camera configured for this conversation.",
    };
  }

  let handle: Awaited<ReturnType<typeof acquireStream>> | null = null;
  try {
    handle = await acquireStream(picked.deviceId);
    const canvas = await handle.snapshotLatest();
    if (canvas.width === 0 || canvas.height === 0) {
      return {
        ok: false,
        deviceId: picked.deviceId,
        cameraLabel: picked.label,
        errorCode: "no_frame",
        errorMessage: "Camera did not produce a frame.",
      };
    }
    return {
      ok: true,
      deviceId: picked.deviceId,
      cameraLabel: picked.label,
    };
  } catch (err) {
    const classified = classifyError(err);
    return {
      ok: false,
      deviceId: picked.deviceId,
      cameraLabel: picked.label,
      errorCode: classified.code,
      errorMessage: classified.message,
    };
  } finally {
    try {
      handle?.release();
    } catch {
      // ignore release errors during cleanup
    }
  }
}
