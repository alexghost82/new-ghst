import { create } from "zustand";
import type { CameraSetupItem, SavedCamera } from "../types/api";
import { api } from "../api/client";

export interface ActiveCamera {
  device_id: string;
  label: string;
}

interface LiveState {
  /** Map of conversation -> active camera setup for the current session. */
  liveConversations: Record<string, ActiveCamera[]>;
  /** Persisted defaults keyed by conversation, fetched from the backend. */
  savedCameras: Record<string, SavedCamera[]>;
  /** Loading flag for the persistence layer per conversation. */
  loadingSaved: Record<string, boolean>;
  /** Controls the camera selector modal visibility. */
  showCameraSelector: boolean;
  /** When true the in-chat live camera stage is minimized to a slim bar.
   *  Global (not per-conversation) so the user's fold preference persists
   *  while switching between live conversations. */
  previewCollapsed: boolean;

  enableLive: (conversationId: string, cameras: ActiveCamera[]) => void;
  disableLive: (conversationId: string) => void;
  isLive: (conversationId: string) => boolean;
  getActiveCameras: (conversationId: string) => ActiveCamera[];

  fetchSavedCameras: (conversationId: string, userId: string) => Promise<void>;
  saveCameraSetup: (
    conversationId: string,
    userId: string,
    cameras: CameraSetupItem[],
  ) => Promise<SavedCamera[] | null>;
  clearCameraSetup: (conversationId: string, userId: string) => Promise<void>;
  removeSavedCamera: (
    conversationId: string,
    userId: string,
    deviceId: string,
  ) => Promise<void>;

  openCameraSelector: () => void;
  closeCameraSelector: () => void;

  setPreviewCollapsed: (collapsed: boolean) => void;
  togglePreviewCollapsed: () => void;
}

export const useLiveStore = create<LiveState>((set, get) => ({
  liveConversations: {},
  savedCameras: {},
  loadingSaved: {},
  showCameraSelector: false,
  previewCollapsed: false,

  enableLive: (conversationId, cameras) =>
    set((s) => ({
      liveConversations: {
        ...s.liveConversations,
        [conversationId]: cameras,
      },
      showCameraSelector: false,
    })),

  disableLive: (conversationId) =>
    set((s) => {
      const next = { ...s.liveConversations };
      delete next[conversationId];
      return { liveConversations: next };
    }),

  isLive: (conversationId) => {
    const list = get().liveConversations[conversationId];
    return Array.isArray(list) && list.length > 0;
  },

  getActiveCameras: (conversationId) =>
    get().liveConversations[conversationId] ?? [],

  fetchSavedCameras: async (conversationId, userId) => {
    set((s) => ({
      loadingSaved: { ...s.loadingSaved, [conversationId]: true },
    }));
    const res = await api.listCameras(conversationId, userId);
    if (res.ok && res.data) {
      set((s) => ({
        savedCameras: { ...s.savedCameras, [conversationId]: res.data! },
        loadingSaved: { ...s.loadingSaved, [conversationId]: false },
      }));
    } else {
      set((s) => ({
        loadingSaved: { ...s.loadingSaved, [conversationId]: false },
      }));
    }
  },

  saveCameraSetup: async (conversationId, userId, cameras) => {
    const res = await api.saveCameras(conversationId, userId, cameras);
    if (res.ok && res.data) {
      set((s) => ({
        savedCameras: { ...s.savedCameras, [conversationId]: res.data! },
      }));
      return res.data;
    }
    return null;
  },

  clearCameraSetup: async (conversationId, userId) => {
    const res = await api.clearCameras(conversationId, userId);
    if (res.ok) {
      set((s) => {
        const nextSaved = { ...s.savedCameras };
        delete nextSaved[conversationId];
        const nextLive = { ...s.liveConversations };
        delete nextLive[conversationId];
        return { savedCameras: nextSaved, liveConversations: nextLive };
      });
    }
  },

  removeSavedCamera: async (conversationId, userId, deviceId) => {
    const current = get().savedCameras[conversationId] ?? [];
    const filtered = current
      .filter((c) => c.device_id !== deviceId)
      .map((c, idx) => ({
        device_id: c.device_id,
        label: c.label,
        position: idx,
      }));

    const res = await api.saveCameras(conversationId, userId, filtered);
    if (res.ok && res.data) {
      set((s) => {
        const updatedActive = (s.liveConversations[conversationId] ?? []).filter(
          (c) => c.device_id !== deviceId,
        );
        const nextLive = { ...s.liveConversations };
        if (updatedActive.length > 0) {
          nextLive[conversationId] = updatedActive;
        } else {
          delete nextLive[conversationId];
        }
        return {
          savedCameras: { ...s.savedCameras, [conversationId]: res.data! },
          liveConversations: nextLive,
        };
      });
    }
  },

  openCameraSelector: () => set({ showCameraSelector: true }),
  closeCameraSelector: () => set({ showCameraSelector: false }),

  setPreviewCollapsed: (collapsed) => set({ previewCollapsed: collapsed }),
  togglePreviewCollapsed: () =>
    set((s) => ({ previewCollapsed: !s.previewCollapsed })),
}));
