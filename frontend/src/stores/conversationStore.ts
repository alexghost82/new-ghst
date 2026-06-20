import { create } from "zustand";
import type {
  Conversation,
  PersonaTone,
  Proactivity,
  OperatorProfile,
  EscalationContact,
} from "../types/api";
import { api } from "../api/client";
import {
  applyConversationOrder,
  bumpToFront,
  loadConversationOrder,
  saveConversationOrder,
  syncConversationOrder,
} from "../utils/conversationOrder";
import { useUserStore } from "./userStore";

const TRIAL_LEAD_KEY = "ghost_trial_lead";

// In a public-trial session, stamp the visitor's captured lead (name / email /
// phone) onto every conversation they open, so the admin (8+0) can see who
// started it. Returns undefined for non-trial sessions.
function trialLeadForCreate():
  | { name?: string; email?: string; phone?: string }
  | undefined {
  if (useUserStore.getState().sessionType !== "trial") return undefined;
  try {
    const raw = window.localStorage.getItem(TRIAL_LEAD_KEY);
    if (!raw) return undefined;
    const p = JSON.parse(raw) as Partial<{
      name: string;
      email: string;
      phone: string;
    }>;
    if (!p.name && !p.email && !p.phone) return undefined;
    return { name: p.name, email: p.email, phone: p.phone };
  } catch {
    return undefined;
  }
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchConversations: (userId: string, scopeByIp?: boolean) => Promise<void>;
  createConversation: (
    userId: string,
    title?: string,
    systemPrompt?: string,
  ) => Promise<Conversation | null>;
  deleteConversation: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  updateConversation: (
    id: string,
    data: Partial<{
      title: string;
      system_prompt: string;
      accuracy_level: number;
      response_length: "short" | "medium" | "long";
      image_detail: "low" | "high";
      agent_name: string;
      role_mission: string;
      site_type: string;
      focus_priorities: string;
      ignore_scope: string;
      site_baseline: string;
      persona_tone: PersonaTone;
      dry_humor: boolean;
      proactivity: Proactivity;
      operator_profile: OperatorProfile;
      critical_event_definition: string;
      escalation_contacts: EscalationContact[];
      quiet_hours: string;
    }>,
  ) => Promise<void>;
  reorderConversations: (orderedIds: string[]) => void;
  /** Move a conversation to the top of the flat list (preserving the manual
   *  order of the rest) and refresh its local activity timestamp. Used on new
   *  message / report / alert activity so the most recently active
   *  conversation surfaces first. No-op when the conversation isn't loaded. */
  bumpConversation: (id: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  error: null,

  fetchConversations: async (userId, scopeByIp = false) => {
    set({ isLoading: true, error: null });
    const res = await api.listConversations(userId, scopeByIp);
    if (res.ok && res.data) {
      const ordered = applyConversationOrder(res.data, userId);
      syncConversationOrder(userId, res.data);
      set({ conversations: ordered, isLoading: false });
    } else {
      set({
        isLoading: false,
        error: res.error?.message ?? "Failed to fetch conversations",
      });
    }
  },

  createConversation: async (userId, title, systemPrompt) => {
    set({ isLoading: true, error: null });
    const res = await api.createConversation(
      userId,
      title,
      systemPrompt,
      trialLeadForCreate(),
    );
    if (res.ok && res.data) {
      set((s) => {
        const order = [res.data!.id, ...loadConversationOrder(userId)];
        saveConversationOrder(userId, order);
        return {
          conversations: [res.data!, ...s.conversations],
          activeConversationId: res.data!.id,
          isLoading: false,
        };
      });
      return res.data;
    }
    set({
      isLoading: false,
      error: res.error?.message ?? "Failed to create conversation",
    });
    return null;
  },

  deleteConversation: async (id) => {
    const prev = get().conversations;
    const userId = prev.find((c) => c.id === id)?.user_id;
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id ? null : s.activeConversationId,
    }));
    if (userId) {
      saveConversationOrder(
        userId,
        loadConversationOrder(userId).filter((cid) => cid !== id),
      );
    }
    const res = await api.deleteConversation(id);
    if (!res.ok) {
      set({ conversations: prev, error: res.error?.message ?? "Failed to delete" });
    }
  },

  setActive: (id) => set({ activeConversationId: id }),

  updateConversation: async (id, data) => {
    const res = await api.updateConversation(id, data);
    if (res.ok && res.data) {
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, ...res.data! } : c,
        ),
      }));
    }
  },

  reorderConversations: (orderedIds) => {
    set((s) => {
      const byId = new Map(s.conversations.map((c) => [c.id, c]));
      const conversations = orderedIds
        .map((id) => byId.get(id))
        .filter((c): c is Conversation => !!c);
      const userId = conversations[0]?.user_id;
      if (userId) saveConversationOrder(userId, orderedIds);
      return { conversations };
    });
  },

  bumpConversation: (id) => {
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.id === id);
      if (idx < 0) return s;
      const conv = s.conversations[idx];
      const userId = conv.user_id;
      if (userId) {
        saveConversationOrder(
          userId,
          bumpToFront(loadConversationOrder(userId), id),
        );
      }
      // Keep the displayed "time ago" fresh and re-sort the flat list.
      const bumped = { ...conv, updated_at: new Date().toISOString() };
      const conversations = [
        bumped,
        ...s.conversations.filter((c) => c.id !== id),
      ];
      return { conversations };
    });
  },
}));
