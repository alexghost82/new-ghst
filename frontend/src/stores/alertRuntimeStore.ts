/**
 * Runtime status for the alert subsystem.
 *
 * This store is intentionally separate from :mod:`alertStore`:
 *
 * - ``alertStore`` owns the **persisted** state (rules, mode toggle, active
 *   alert event) and talks to the backend.
 * - ``alertRuntimeStore`` owns the **ephemeral** state of the local
 *   detection pipeline: is the camera actually streaming, is a scan in
 *   flight, did the push channel just drop, etc.
 *
 * The UI reads from this store to render dots, badges, "scanning…" hints
 * and error banners. The data is produced by :mod:`alertEngine`,
 * :mod:`alertStream` and :mod:`cameraStreamManager` (via the engine).
 */

import { create } from "zustand";

export type AlertConnectionStatus =
  | "idle"
  | "no_camera"
  | "no_rules"
  | "activating"
  | "connecting"
  | "connected"
  | "scanning"
  | "error";

export interface ConversationAlertRuntime {
  status: AlertConnectionStatus;
  cameraLabel: string | null;
  deviceId: string | null;
  /** ``Date.now()`` of the last *successful* scan POST. */
  lastScanAt: number | null;
  /** Last user-visible error message; cleared on the next successful step. */
  lastError: string | null;
  /** Counts consecutive acquire/snapshot/scan failures; resets on success. */
  consecutiveFailures: number;
}

interface AlertRuntimeState {
  byConversation: Record<string, ConversationAlertRuntime>;
  sseConnected: boolean;
  sseLastConnectedAt: number | null;
  /** Set while a manual "test connection" run is in flight, per conversation. */
  testing: Record<string, boolean>;

  setStatus: (
    conversationId: string,
    status: AlertConnectionStatus,
    patch?: Partial<ConversationAlertRuntime>,
  ) => void;
  reportScanStart: (conversationId: string) => void;
  reportScanSuccess: (conversationId: string) => void;
  reportFailure: (
    conversationId: string,
    error: string,
    nextStatus?: AlertConnectionStatus,
  ) => void;
  resetConversation: (conversationId: string) => void;
  setSseConnected: (connected: boolean) => void;
  setTesting: (conversationId: string, testing: boolean) => void;
  getRuntime: (conversationId: string) => ConversationAlertRuntime;
}

const EMPTY: ConversationAlertRuntime = {
  status: "idle",
  cameraLabel: null,
  deviceId: null,
  lastScanAt: null,
  lastError: null,
  consecutiveFailures: 0,
};

function mergeRuntime(
  prev: ConversationAlertRuntime | undefined,
  patch: Partial<ConversationAlertRuntime>,
): ConversationAlertRuntime {
  return { ...EMPTY, ...prev, ...patch };
}

export const useAlertRuntimeStore = create<AlertRuntimeState>((set, get) => ({
  byConversation: {},
  sseConnected: false,
  sseLastConnectedAt: null,
  testing: {},

  setStatus: (conversationId, status, patch) => {
    set((s) => ({
      byConversation: {
        ...s.byConversation,
        [conversationId]: mergeRuntime(s.byConversation[conversationId], {
          status,
          ...(patch ?? {}),
        }),
      },
    }));
  },

  reportScanStart: (conversationId) => {
    set((s) => {
      const prev = s.byConversation[conversationId];
      if (prev?.status === "scanning") return s;
      return {
        byConversation: {
          ...s.byConversation,
          [conversationId]: mergeRuntime(prev, { status: "scanning" }),
        },
      };
    });
  },

  reportScanSuccess: (conversationId) => {
    set((s) => ({
      byConversation: {
        ...s.byConversation,
        [conversationId]: mergeRuntime(s.byConversation[conversationId], {
          status: "connected",
          lastScanAt: Date.now(),
          lastError: null,
          consecutiveFailures: 0,
        }),
      },
    }));
  },

  reportFailure: (conversationId, error, nextStatus = "error") => {
    set((s) => {
      const prev = s.byConversation[conversationId];
      const failures = (prev?.consecutiveFailures ?? 0) + 1;
      return {
        byConversation: {
          ...s.byConversation,
          [conversationId]: mergeRuntime(prev, {
            status: nextStatus,
            lastError: error,
            consecutiveFailures: failures,
          }),
        },
      };
    });
  },

  resetConversation: (conversationId) => {
    set((s) => {
      const next = { ...s.byConversation };
      delete next[conversationId];
      const nextTesting = { ...s.testing };
      delete nextTesting[conversationId];
      return { byConversation: next, testing: nextTesting };
    });
  },

  setSseConnected: (connected) => {
    set((s) => ({
      sseConnected: connected,
      sseLastConnectedAt: connected ? Date.now() : s.sseLastConnectedAt,
    }));
  },

  setTesting: (conversationId, testing) => {
    set((s) => ({
      testing: { ...s.testing, [conversationId]: testing },
    }));
  },

  getRuntime: (conversationId) =>
    get().byConversation[conversationId] ?? EMPTY,
}));

/** Convenience selector for components that just need the basic shape. */
export function selectRuntime(
  state: AlertRuntimeState,
  conversationId: string | null,
): ConversationAlertRuntime {
  if (!conversationId) return EMPTY;
  return state.byConversation[conversationId] ?? EMPTY;
}
