import { create } from "zustand";
import type {
  AutomationConfirmResult,
  AutomationDraft,
  AutomationKind,
} from "../types/api";
import { api } from "../api/client";
import { sanitizeBrand } from "../utils/sanitize";
import { useAlertStore } from "./alertStore";
import { useMessageStore } from "./messageStore";
import { useTaskStore } from "./taskStore";

interface AutomationState {
  /** Per-conversation drafts cache. */
  drafts: Record<string, AutomationDraft[]>;
  /** Global "model is extracting fields" flag, drives the composer effect. */
  parsing: boolean;
  error: string | null;

  fetchDrafts: (conversationId: string, userId: string) => Promise<void>;
  parse: (
    conversationId: string,
    userId: string,
    kind: AutomationKind,
    text: string,
    locale: "he" | "en",
  ) => Promise<AutomationDraft | null>;
  updateDraft: (
    draftId: string,
    userId: string,
    payloadPatch: Record<string, unknown>,
  ) => Promise<void>;
  confirm: (
    draftId: string,
    userId: string,
    activate: boolean,
  ) => Promise<AutomationConfirmResult | null>;
  dismiss: (draftId: string, userId: string) => Promise<void>;
  getDraftById: (draftId: string) => AutomationDraft | null;
  clearError: () => void;
}

function upsertDraft(
  drafts: Record<string, AutomationDraft[]>,
  draft: AutomationDraft,
): Record<string, AutomationDraft[]> {
  const list = drafts[draft.conversation_id] ?? [];
  const exists = list.some((d) => d.id === draft.id);
  const next = exists
    ? list.map((d) => (d.id === draft.id ? draft : d))
    : [...list, draft];
  return { ...drafts, [draft.conversation_id]: next };
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  drafts: {},
  parsing: false,
  error: null,

  fetchDrafts: async (conversationId, userId) => {
    const res = await api.listAutomationDrafts(conversationId, userId);
    if (res.ok && res.data) {
      set((s) => ({
        drafts: { ...s.drafts, [conversationId]: res.data! },
      }));
    }
  },

  parse: async (conversationId, userId, kind, text, locale) => {
    set({ parsing: true, error: null });
    const clientNow = new Date().toISOString();
    const res = await api.parseAutomation(
      conversationId,
      userId,
      kind,
      text,
      locale,
      clientNow,
    );
    if (res.ok && res.data) {
      set((s) => ({ drafts: upsertDraft(s.drafts, res.data!), parsing: false }));
      // The parse persisted a user message + the draft widget marker message;
      // pull them into the open thread so the card renders immediately.
      void useMessageStore.getState().fetchMessages(conversationId, userId);
      return res.data;
    }
    set({
      parsing: false,
      error: sanitizeBrand(
        res.error?.message ?? "Ghost could not read that request",
      ),
    });
    return null;
  },

  updateDraft: async (draftId, userId, payloadPatch) => {
    const res = await api.updateAutomationDraft(draftId, userId, payloadPatch);
    if (res.ok && res.data) {
      set((s) => ({ drafts: upsertDraft(s.drafts, res.data!) }));
    } else if (!res.ok) {
      set({
        error: sanitizeBrand(res.error?.message ?? "Failed to update draft"),
      });
    }
  },

  confirm: async (draftId, userId, activate) => {
    const res = await api.confirmAutomationDraft(draftId, userId, activate);
    if (res.ok && res.data) {
      const result = res.data;
      set((s) => ({ drafts: upsertDraft(s.drafts, result.draft) }));
      const convId = result.draft.conversation_id;
      // Let the existing engines pick up the new automation.
      if (result.draft.kind === "task") {
        void useTaskStore.getState().fetchTasks(convId, userId);
      } else {
        void useAlertStore.getState().fetchRules(convId, userId);
        if (activate) {
          useAlertStore.getState().setAlertModeFromConversation(convId, true);
        }
      }
      return result;
    }
    set({
      error: sanitizeBrand(res.error?.message ?? "Failed to confirm draft"),
    });
    return null;
  },

  dismiss: async (draftId, userId) => {
    const res = await api.dismissAutomationDraft(draftId, userId);
    if (res.ok && res.data) {
      set((s) => ({ drafts: upsertDraft(s.drafts, res.data!.draft) }));
    } else if (!res.ok) {
      set({
        error: sanitizeBrand(res.error?.message ?? "Failed to dismiss draft"),
      });
    }
  },

  getDraftById: (draftId) => {
    for (const list of Object.values(get().drafts)) {
      const found = list.find((d) => d.id === draftId);
      if (found) return found;
    }
    return null;
  },

  clearError: () => set({ error: null }),
}));
