import { create } from "zustand";
import { useConversationStore } from "./conversationStore";
import { useConversationGroupsStore } from "./conversationGroupsStore";

export type ConversationEventKind = "message" | "alert" | "report";

export interface ConversationActivity {
  /** ISO timestamp of the most recent activity. */
  lastActivityAt: string;
  /** What produced the most recent activity (drives the unread preview). */
  lastEventKind: ConversationEventKind;
  /** True until the operator opens the conversation. */
  unread: boolean;
}

interface ActivityState {
  userId: string | null;
  activity: Record<string, ConversationActivity>;

  loadForUser: (userId: string) => void;
  reset: () => void;
  /** Record new activity: bumps the conversation to the top (preserving manual
   *  order/grouping) and marks it unread unless it's the conversation the
   *  operator is currently viewing (auto-read). */
  markActivity: (conversationId: string, kind: ConversationEventKind) => void;
  /** Clear the unread flag when a conversation is opened. */
  markRead: (conversationId: string) => void;
}

const storageKey = (userId: string) => `ghost-conversation-activity-${userId}`;

function load(userId: string): Record<string, ConversationActivity> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, ConversationActivity>)
      : {};
  } catch {
    return {};
  }
}

function persist(
  userId: string | null,
  activity: Record<string, ConversationActivity>,
): void {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(activity));
  } catch {
    // Storage can be full/unavailable — non-fatal, indicators just won't
    // survive a refresh.
  }
}

export const useConversationActivityStore = create<ActivityState>(
  (set, get) => ({
    userId: null,
    activity: {},

    loadForUser: (userId) => set({ userId, activity: load(userId) }),
    reset: () => set({ userId: null, activity: {} }),

    markActivity: (conversationId, kind) => {
      const activeId = useConversationStore.getState().activeConversationId;
      const isActive = activeId === conversationId;
      set((s) => {
        const next = {
          ...s.activity,
          [conversationId]: {
            lastActivityAt: new Date().toISOString(),
            lastEventKind: kind,
            unread: !isActive,
          },
        };
        persist(s.userId, next);
        return { activity: next };
      });
      // Surface the conversation at the top of its container.
      useConversationStore.getState().bumpConversation(conversationId);
      useConversationGroupsStore
        .getState()
        .bumpConversationWithinContainer(conversationId);
    },

    markRead: (conversationId) => {
      set((s) => {
        const rec = s.activity[conversationId];
        if (!rec || !rec.unread) return s;
        const next = {
          ...s.activity,
          [conversationId]: { ...rec, unread: false },
        };
        persist(s.userId, next);
        return { activity: next };
      });
    },
  }),
);
