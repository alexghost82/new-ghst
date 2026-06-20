import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "../types/api";
import { useLiveStore } from "../stores/liveStore";
import { useAlertStore } from "../stores/alertStore";
import { acquire, type CameraStreamHandle } from "../services/cameraStreamManager";

const POLL_INTERVAL_MS = 600;
const THUMB_SIZE = 96;

/**
 * Draws the freshest camera frame (a native-resolution canvas) into a small,
 * square, center-cropped JPEG data URL suitable for an avatar thumbnail.
 */
function toThumbnailDataUrl(source: HTMLCanvasElement): string | null {
  const sw = source.width;
  const sh = source.height;
  if (sw === 0 || sh === 0) return null;
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  const out = document.createElement("canvas");
  out.width = THUMB_SIZE;
  out.height = THUMB_SIZE;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
  try {
    return out.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

interface CameraThumbnailState {
  /** Last captured frame as a data URL. Persists after hover ends. */
  thumbnailUrl: string | null;
  /** True while a live stream is actively feeding the thumbnail. */
  isLive: boolean;
  /** Whether this conversation has a default camera worth previewing. */
  hasCamera: boolean;
  /** Begin live preview (call on hover / focus). */
  start: () => void;
  /** Stop live preview (call on mouse-leave / blur / unmount). */
  stop: () => void;
}

export function useConversationCameraThumbnail(
  conversation: Conversation,
  activeUserId: string | null,
  enabled = true,
): CameraThumbnailState {
  const conversationId = conversation.id;

  const savedCameras = useLiveStore((s) => s.savedCameras[conversationId]);
  const activeCameras = useLiveStore((s) => s.liveConversations[conversationId]);

  const hasCamera =
    (conversation.camera_count ?? 0) > 0 ||
    (savedCameras?.length ?? 0) > 0 ||
    (activeCameras?.length ?? 0) > 0;

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const handleRef = useRef<CameraStreamHandle | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveDeviceId = useCallback((): string | null => {
    const live = useLiveStore.getState();
    const active = live.getActiveCameras(conversationId);
    if (active.length > 0) return active[0].device_id;
    const saved = live.savedCameras[conversationId] ?? [];
    if (saved.length > 0) return saved[0].device_id;
    return null;
  }, [conversationId]);

  const teardown = useCallback(() => {
    runIdRef.current += 1;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (handleRef.current) {
      handleRef.current.release();
      handleRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    if (mountedRef.current) setIsLive(false);
  }, [teardown]);

  const start = useCallback(() => {
    if (!enabled || !hasCamera) return;
    // Alerts are top priority: don't spin up a hover-preview poll while an
    // alert scan loop is running — it competes for the camera + main thread.
    if (
      Object.values(useAlertStore.getState().alertModeEnabled).some(Boolean)
    ) {
      return;
    }
    // Already streaming for this item.
    if (handleRef.current || intervalRef.current) return;

    const runId = ++runIdRef.current;

    const begin = async () => {
      // Lazily load the persisted default camera if we don't know it yet.
      if (
        resolveDeviceId() === null &&
        activeUserId &&
        useLiveStore.getState().savedCameras[conversationId] === undefined
      ) {
        await useLiveStore
          .getState()
          .fetchSavedCameras(conversationId, activeUserId);
      }
      if (runId !== runIdRef.current) return;

      const deviceId = resolveDeviceId();
      if (!deviceId) return;

      let handle: CameraStreamHandle;
      try {
        handle = await acquire(deviceId);
      } catch {
        return; // Permission denied / device missing — keep the fallback avatar.
      }
      if (runId !== runIdRef.current) {
        handle.release();
        return;
      }
      handleRef.current = handle;

      const capture = async () => {
        const current = handleRef.current;
        if (!current || runId !== runIdRef.current) return;
        try {
          const canvas = await current.snapshotLatest();
          const url = toThumbnailDataUrl(canvas);
          if (url && mountedRef.current && runId === runIdRef.current) {
            setThumbnailUrl(url);
            setIsLive(true);
          }
        } catch {
          // Buffer not ready yet — next tick will retry.
        }
      };

      void capture();
      intervalRef.current = setInterval(() => void capture(), POLL_INTERVAL_MS);
    };

    void begin();
  }, [enabled, hasCamera, activeUserId, conversationId, resolveDeviceId]);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return { thumbnailUrl, isLive, hasCamera, start, stop };
}
