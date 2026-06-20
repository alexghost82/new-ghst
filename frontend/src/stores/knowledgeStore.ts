import { create } from "zustand";
import type { KnowledgeSource } from "../types/api";
import { api } from "../api/client";

interface KnowledgeState {
  sources: KnowledgeSource[];
  isLoading: boolean;
  uploadProgress: "idle" | "uploading" | "processing" | "done" | "error";
  error: string | null;

  fetchSources: (userId: string) => Promise<void>;
  uploadFile: (userId: string, file: File, tags?: string[]) => Promise<void>;
  createText: (
    userId: string,
    content: string,
    tags?: string[],
  ) => Promise<void>;
  deleteSource: (id: string, userId: string) => Promise<void>;
  toggleActive: (id: string, userId: string) => Promise<void>;
  updateSource: (
    id: string,
    userId: string,
    data: Partial<{ filename: string; content: string }>,
  ) => Promise<boolean>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  sources: [],
  isLoading: false,
  uploadProgress: "idle",
  error: null,

  fetchSources: async (userId) => {
    set({ isLoading: true, error: null });
    const res = await api.listKnowledgeSources(userId);
    if (res.ok && res.data) {
      set({ sources: res.data, isLoading: false });
    } else {
      set({
        isLoading: false,
        error: res.error?.message ?? "Failed to fetch knowledge sources",
      });
    }
  },

  uploadFile: async (userId, file, tags) => {
    set({ uploadProgress: "uploading", error: null });
    const res = await api.uploadKnowledgeFile(userId, file, tags);
    if (res.ok && res.data) {
      set((s) => ({
        sources: [res.data!, ...s.sources],
        uploadProgress: "done",
      }));
    } else {
      set({
        uploadProgress: "error",
        error: res.error?.message ?? "Upload failed",
      });
    }
  },

  createText: async (userId, content, tags) => {
    set({ uploadProgress: "processing", error: null });
    const res = await api.createKnowledgeText(userId, content, tags);
    if (res.ok && res.data) {
      set((s) => ({
        sources: [res.data!, ...s.sources],
        uploadProgress: "done",
      }));
    } else {
      set({
        uploadProgress: "error",
        error: res.error?.message ?? "Failed to create knowledge entry",
      });
    }
  },

  deleteSource: async (id, userId) => {
    const prev = get().sources;
    set((s) => ({ sources: s.sources.filter((k) => k.id !== id) }));
    const res = await api.deleteKnowledgeSource(id, userId);
    if (!res.ok) {
      set({ sources: prev, error: res.error?.message ?? "Failed to delete" });
    }
  },

  toggleActive: async (id, userId) => {
    const source = get().sources.find((s) => s.id === id);
    if (!source) return;
    const res = await api.updateKnowledgeSource(id, userId, {
      is_active: !source.is_active,
    });
    if (res.ok && res.data) {
      set((s) => ({
        sources: s.sources.map((k) =>
          k.id === id ? { ...k, is_active: !k.is_active } : k,
        ),
      }));
    }
  },

  updateSource: async (id, userId, data) => {
    const res = await api.updateKnowledgeSource(id, userId, data);
    if (res.ok && res.data) {
      set((s) => ({
        sources: s.sources.map((k) =>
          k.id === id ? { ...k, ...res.data! } : k,
        ),
      }));
      return true;
    }
    set({ error: res.error?.message ?? "Failed to update source" });
    return false;
  },
}));
