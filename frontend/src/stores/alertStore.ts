import { create } from "zustand";
import type { AlertEvent, AlertRule } from "../types/api";
import { api } from "../api/client";
import { consumeLastScanStart } from "../services/alertLatencyTracker";
import { sanitizeBrand } from "../utils/sanitize";
import { useLanguageStore } from "./languageStore";
import { useConversationStore } from "./conversationStore";
import { useMessageStore } from "./messageStore";
import { useUserStore } from "./userStore";
import { useAlertRuntimeStore } from "./alertRuntimeStore";
import { TRIAL_ALERT_MAX_MS } from "../config/demoAccess";

// In the public trial the shared ghostdemo agent may keep alert mode armed for
// at most TRIAL_ALERT_MAX_MS continuously. We track one pending auto-off timer
// per conversation at module scope so it survives panel unmounts / navigation.
const trialAutoOffTimers = new Map<string, number>();

function clearTrialAutoOff(conversationId: string) {
  const id = trialAutoOffTimers.get(conversationId);
  if (id !== undefined) {
    window.clearTimeout(id);
    trialAutoOffTimers.delete(conversationId);
  }
}

export type SubmitScanOutcome =
  | { status: "ok"; detected: boolean }
  | { status: "skipped" }
  | { status: "error"; message: string };

interface AlertState {
  /** Per-conversation rules cache. */
  rules: Record<string, AlertRule[]>;
  /** Per-conversation alert mode toggle (mirrors backend column). */
  alertModeEnabled: Record<string, boolean>;
  /** Trial only: absolute epoch-ms when alert mode auto-disarms (for the
   *  countdown chip). Null/absent when no auto-off is pending. */
  trialAlertExpiresAt: Record<string, number | null>;
  /** Active (unacknowledged) alert that should block the UI. */
  activeAlert: AlertEvent | null;
  /** Title of the conversation that produced ``activeAlert`` (cached so
   *  the overlay can render even if the user is on a different chat). */
  activeAlertConversationTitle: string | null;
  /** Per-conversation in-flight scan flag. */
  scanning: Record<string, boolean>;
  /** Per-conversation rules-loading flag. */
  loadingRules: Record<string, boolean>;
  /** Latest user-facing error (rate-limit, network, …). */
  error: string | null;

  fetchRules: (conversationId: string, userId: string) => Promise<void>;
  addRule: (
    conversationId: string,
    userId: string,
    description: string,
  ) => Promise<AlertRule | null>;
  updateRule: (
    ruleId: string,
    userId: string,
    data: Partial<{ description: string; is_active: boolean }>,
  ) => Promise<void>;
  deleteRule: (ruleId: string, userId: string) => Promise<void>;

  toggleAlertMode: (
    conversationId: string,
    userId: string,
    enabled: boolean,
  ) => Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }>;
  setAlertModeFromConversation: (
    conversationId: string,
    enabled: boolean,
  ) => void;

  submitScan: (
    conversationId: string,
    userId: string,
    imageBase64: string,
    conversationTitle?: string,
    deviceId?: string,
    cameraLabel?: string,
  ) => Promise<SubmitScanOutcome>;

  /** Internal: called by the SSE consumer when the backend pushes an event. */
  _receivePushedEvent: (payload: {
    event: AlertEvent;
    conversation_id: string;
    conversation_title_hint?: string | null;
  }) => void;

  acknowledgeAlert: (userId: string) => Promise<void>;
  dismissAlert: () => void;
  clearError: () => void;
}

function findConversationIdForRule(
  rules: Record<string, AlertRule[]>,
  ruleId: string,
): string | null {
  for (const [convId, list] of Object.entries(rules)) {
    if (list.some((r) => r.id === ruleId)) return convId;
  }
  return null;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  rules: {},
  alertModeEnabled: {},
  trialAlertExpiresAt: {},
  activeAlert: null,
  activeAlertConversationTitle: null,
  scanning: {},
  loadingRules: {},
  error: null,

  fetchRules: async (conversationId, userId) => {
    set((s) => ({
      loadingRules: { ...s.loadingRules, [conversationId]: true },
    }));
    const res = await api.listAlertRules(conversationId, userId);
    if (res.ok && res.data) {
      set((s) => ({
        rules: { ...s.rules, [conversationId]: res.data! },
        loadingRules: { ...s.loadingRules, [conversationId]: false },
      }));
    } else {
      set((s) => ({
        loadingRules: { ...s.loadingRules, [conversationId]: false },
        error: sanitizeBrand(
          res.error?.message ?? "Failed to load alert rules",
        ),
      }));
    }
  },

  addRule: async (conversationId, userId, description) => {
    const trimmed = description.trim();
    if (!trimmed) return null;
    const res = await api.createAlertRule(conversationId, userId, trimmed);
    if (res.ok && res.data) {
      set((s) => ({
        rules: {
          ...s.rules,
          [conversationId]: [...(s.rules[conversationId] ?? []), res.data!],
        },
      }));
      return res.data;
    }
    set({
      error: sanitizeBrand(res.error?.message ?? "Failed to create alert rule"),
    });
    return null;
  },

  updateRule: async (ruleId, userId, data) => {
    const conversationId = findConversationIdForRule(get().rules, ruleId);
    if (!conversationId) return;

    set((s) => ({
      rules: {
        ...s.rules,
        [conversationId]: (s.rules[conversationId] ?? []).map((r) =>
          r.id === ruleId ? { ...r, ...data } : r,
        ),
      },
    }));

    const res = await api.updateAlertRule(ruleId, userId, data);
    if (res.ok && res.data) {
      set((s) => ({
        rules: {
          ...s.rules,
          [conversationId]: (s.rules[conversationId] ?? []).map((r) =>
            r.id === ruleId ? res.data! : r,
          ),
        },
      }));
    } else if (!res.ok) {
      set({
        error: sanitizeBrand(
          res.error?.message ?? "Failed to update alert rule",
        ),
      });
    }
  },

  deleteRule: async (ruleId, userId) => {
    const conversationId = findConversationIdForRule(get().rules, ruleId);
    if (!conversationId) return;

    const previous = get().rules[conversationId] ?? [];
    set((s) => ({
      rules: {
        ...s.rules,
        [conversationId]: previous.filter((r) => r.id !== ruleId),
      },
    }));

    const res = await api.deleteAlertRule(ruleId, userId);
    if (!res.ok) {
      set((s) => ({
        rules: { ...s.rules, [conversationId]: previous },
        error: sanitizeBrand(
          res.error?.message ?? "Failed to delete alert rule",
        ),
      }));
    }
  },

  toggleAlertMode: async (conversationId, userId, enabled) => {
    // Any explicit toggle cancels a pending trial auto-off; we reschedule it
    // below only when arming inside a trial session.
    clearTrialAutoOff(conversationId);

    set((s) => ({
      alertModeEnabled: { ...s.alertModeEnabled, [conversationId]: enabled },
      trialAlertExpiresAt: {
        ...s.trialAlertExpiresAt,
        [conversationId]: null,
      },
    }));
    const res = await api.setAlertMode(conversationId, userId, enabled);
    if (!res.ok) {
      const message = sanitizeBrand(
        res.error?.message ?? "Failed to update alert mode",
      );
      set((s) => ({
        alertModeEnabled: {
          ...s.alertModeEnabled,
          [conversationId]: !enabled,
        },
        // Validation errors are surfaced inline by the panel; don't double up
        // with the global error banner for the well-known guard codes.
        error:
          res.error?.code === "ALERT_NO_CAMERA" ||
          res.error?.code === "ALERT_NO_ACTIVE_RULE"
            ? s.error
            : message,
      }));
      return {
        ok: false,
        errorCode: res.error?.code,
        errorMessage: message,
      };
    }

    // Trial cap: a visitor without their own user (shared ghostdemo agent) may
    // keep alert mode armed for at most TRIAL_ALERT_MAX_MS, then it auto-stops.
    if (enabled && useUserStore.getState().sessionType === "trial") {
      const expiresAt = Date.now() + TRIAL_ALERT_MAX_MS;
      set((s) => ({
        trialAlertExpiresAt: {
          ...s.trialAlertExpiresAt,
          [conversationId]: expiresAt,
        },
      }));
      const timerId = window.setTimeout(() => {
        trialAutoOffTimers.delete(conversationId);
        // Only act if alert mode is still on for this conversation.
        if (!get().alertModeEnabled[conversationId]) return;
        set((s) => ({
          alertModeEnabled: {
            ...s.alertModeEnabled,
            [conversationId]: false,
          },
          trialAlertExpiresAt: {
            ...s.trialAlertExpiresAt,
            [conversationId]: null,
          },
        }));
        void api.setAlertMode(conversationId, userId, false);
        useAlertRuntimeStore.getState().resetConversation(conversationId);
      }, TRIAL_ALERT_MAX_MS);
      trialAutoOffTimers.set(conversationId, timerId);
    }

    return { ok: true };
  },

  setAlertModeFromConversation: (conversationId, enabled) => {
    set((s) => ({
      alertModeEnabled: { ...s.alertModeEnabled, [conversationId]: enabled },
    }));
  },

  submitScan: async (
    conversationId,
    userId,
    imageBase64,
    conversationTitle,
    deviceId,
    cameraLabel,
  ) => {
    if (get().scanning[conversationId]) return { status: "skipped" };
    set((s) => ({ scanning: { ...s.scanning, [conversationId]: true } }));

    try {
      const locale = useLanguageStore.getState().locale;
      const res = await api.scanAlertFrame(
        conversationId,
        userId,
        imageBase64,
        locale,
        deviceId,
        cameraLabel,
      );
      // Open the overlay immediately from the POST response.
      //
      // Earlier versions made this the sole trigger; a later refactor
      // moved it to SSE-only ("``_receivePushedEvent``") to avoid a
      // double-trigger. In practice the dev-server proxy / browser
      // network stack can buffer the SSE channel for several seconds
      // under load, so operators perceived alerts as "stuck". Restoring
      // the POST-side open is the fastest path the system can produce
      // (the moment the scan returns) and the SSE side now dedupes on
      // ``event.id`` so it never fires a second overlay for the same
      // alert.
      if (res.ok && res.data?.detected && res.data.event) {
        const event = res.data.event;
        const convStore = useConversationStore.getState();
        const current = get().activeAlert;
        if (!current || current.id !== event.id) {
          const conv = convStore.conversations.find(
            (c) => c.id === conversationId,
          );
          const title = conv?.title ?? conversationTitle ?? null;
          const scanStart = consumeLastScanStart(conversationId);
          if (scanStart !== null) {
            const perceivedMs = Math.round(performance.now() - scanStart);
            const budgetMs = 1800;
            const status =
              perceivedMs <= budgetMs ? "WITHIN" : "OVER";
            console.info(
              `[alertEngine] overlay-from-post conv=${conversationId.slice(0, 8)} ` +
                `event=${event.id.slice(0, 8)} ` +
                `perceived_latency_ms=${perceivedMs} budget_ms=${budgetMs} status=${status}`,
            );
          }
          set({
            activeAlert: event,
            activeAlertConversationTitle: title,
          });
        }
        if (convStore.activeConversationId === conversationId) {
          useMessageStore
            .getState()
            .fetchMessages(conversationId, userId);
        }
        return { status: "ok", detected: true };
      }
      if (!res.ok) {
        const message = sanitizeBrand(
          res.error?.message ?? "Failed to scan alert frame",
        );
        set({ error: message });
        return { status: "error", message };
      }
      return { status: "ok", detected: false };
    } finally {
      set((s) => ({
        scanning: { ...s.scanning, [conversationId]: false },
      }));
    }
  },

  _receivePushedEvent: (payload) => {
    // Trial isolation. Every public-trial visitor shares the single ghostdemo
    // user, so the per-user SSE stream (``/users/{id}/alerts/stream``) carries
    // events generated by EVERY visitor. Surface only events for conversations
    // in THIS visitor's IP-scoped list so a visitor never sees another
    // visitor's alert. Standard / admin (8+0) sessions keep the full stream.
    if (useUserStore.getState().sessionType === "trial") {
      const ownsConversation = useConversationStore
        .getState()
        .conversations.some((c) => c.id === payload.conversation_id);
      if (!ownsConversation) return;
    }

    const current = get().activeAlert;
    // Dedup against the POST fast-path: if ``submitScan`` already
    // opened this exact event, swallow the SSE echo silently.
    if (current?.id === payload.event.id) return;
    // Existing behaviour: only one alert overlay at a time. If another
    // alert is still on screen waiting for the operator to acknowledge,
    // the new one is dropped — the canonical record is still in the DB
    // and shows up in the alerts list and via fetchMessages below.
    if (current) return;

    const scanStart = consumeLastScanStart(payload.conversation_id);
    if (scanStart !== null) {
      const perceivedMs = Math.round(performance.now() - scanStart);
      const budgetMs = 1800;
      const status = perceivedMs <= budgetMs ? "WITHIN" : "OVER";
      console.info(
        `[alertEngine] overlay-from-sse conv=${payload.conversation_id.slice(0, 8)} ` +
          `event=${payload.event.id.slice(0, 8)} ` +
          `perceived_latency_ms=${perceivedMs} budget_ms=${budgetMs} status=${status}`,
      );
    }

    const conv = useConversationStore
      .getState()
      .conversations.find((c) => c.id === payload.conversation_id);
    const title = conv?.title ?? payload.conversation_title_hint ?? null;
    set({
      activeAlert: payload.event,
      activeAlertConversationTitle: title,
    });
    const activeUserId = useUserStore.getState().activeUserId;
    const activeConvId =
      useConversationStore.getState().activeConversationId;
    if (activeUserId && activeConvId === payload.conversation_id) {
      useMessageStore
        .getState()
        .fetchMessages(payload.conversation_id, activeUserId);
    }
  },

  acknowledgeAlert: async (userId) => {
    const event = get().activeAlert;
    if (!event) return;
    set({ activeAlert: null, activeAlertConversationTitle: null });
    const res = await api.acknowledgeAlertEvent(event.id, userId);
    if (!res.ok) {
      set({
        error: sanitizeBrand(
          res.error?.message ?? "Failed to acknowledge alert",
        ),
      });
    }
  },

  dismissAlert: () =>
    set({ activeAlert: null, activeAlertConversationTitle: null }),

  clearError: () => set({ error: null }),
}));
