import { create } from "zustand";
import type { ExpertReport, Message } from "../types/api";
import { api } from "../api/client";
import { captureFrame } from "../utils/cameraCapture";
import { sanitizeBrand } from "../utils/sanitize";
import { t } from "../utils/i18n";
import { useLanguageStore } from "./languageStore";
import { useConversationStore } from "./conversationStore";
import { useUserStore } from "./userStore";
import { useLiveStore } from "./liveStore";
import { useMessageStore } from "./messageStore";

export type ExpertPhase =
  | "idle"
  | "intro"
  | "interrogating"
  | "awaiting-consent"
  | "thinking"
  | "done";

const THINK_MIN_MS = 4200;
const THINK_MAX_MS = 6800;

interface ExpertState {
  active: boolean;
  phase: ExpertPhase;
  /** Cached recommendation reports, keyed by report id (for the in-chat card). */
  reports: Record<string, ExpertReport>;
  error: string | null;

  /** Operator typed "expert" — engage the dramatic overlay intro. */
  activate: () => void;
  /** Intro finished — engage the interrogation (opening message + composer). */
  beginInterrogation: () => void;
  /** Ghost emitted the readiness marker — ask the operator to allow a frame. */
  setAwaitingConsent: () => void;
  /** Operator consented verbally — pull a frame, run the thinking overlay, and
   *  generate the recommendation set. */
  confirmAndGenerate: () => Promise<void>;
  /** Leave Expert mode entirely (hides overlay, restores normal composer). */
  deactivate: () => void;
  /** Lookup a cached report (the card falls back to a fetch when absent). */
  getReport: (reportId: string) => ExpertReport | undefined;
  cacheReport: (report: ExpertReport) => void;
  clearError: () => void;
}

function appendAssistant(content: string): void {
  const convId = useConversationStore.getState().activeConversationId;
  if (!convId) return;
  const msg: Message = {
    id: `expert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: convId,
    role: "assistant",
    content,
    token_estimate: 0,
    created_at: new Date().toISOString(),
    sequence_number: useMessageStore.getState().messages.length + 1,
  };
  useMessageStore.setState((s) => ({ messages: [...s.messages, msg] }));
}

function pickDeviceId(conversationId: string): string | null {
  const live = useLiveStore.getState();
  const active = live.getActiveCameras(conversationId);
  if (active.length > 0) return active[0].device_id;
  const saved = live.savedCameras[conversationId] ?? [];
  return saved.length > 0 ? saved[0].device_id : null;
}

export const useExpertStore = create<ExpertState>((set, get) => ({
  active: false,
  phase: "idle",
  reports: {},
  error: null,

  activate: () => {
    if (get().active) return;
    set({ active: true, phase: "intro", error: null });
  },

  beginInterrogation: () => {
    if (get().phase !== "intro") return;
    const locale = useLanguageStore.getState().locale;
    appendAssistant(t(locale, "expertOpening"));
    set({ phase: "interrogating" });
  },

  setAwaitingConsent: () => {
    if (!get().active) return;
    set({ phase: "awaiting-consent" });
  },

  confirmAndGenerate: async () => {
    const locale = useLanguageStore.getState().locale;
    const conversationId = useConversationStore.getState().activeConversationId;
    const userId = useUserStore.getState().activeUserId;
    if (!conversationId || !userId) return;

    const deviceId = pickDeviceId(conversationId);
    if (!deviceId) {
      set({ error: t(locale, "expertNoCameraError") });
      appendAssistant(t(locale, "expertNoCameraError"));
      return;
    }

    set({ phase: "thinking", error: null });

    // Minimum on-screen "thinking" window (4.2–6.8s) so the smoked-glass
    // processing overlay always reads as deliberate, regardless of API speed.
    const minDelay = THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS);
    const dwell = new Promise<void>((resolve) => setTimeout(resolve, minDelay));

    try {
      let frameBase64: string | undefined;
      try {
        frameBase64 = await captureFrame(deviceId);
      } catch {
        // Fall through — generation can still run on the interrogation text.
        frameBase64 = undefined;
      }

      const report = await useMessageStore
        .getState()
        .runExpertGenerate(conversationId, userId, frameBase64);
      await dwell;

      if (report) {
        get().cacheReport(report);
        set({ phase: "done", active: false });
      } else {
        set({
          phase: "interrogating",
          error: t(locale, "expertReportApplyError"),
        });
      }
    } catch (err) {
      await dwell;
      set({
        phase: "interrogating",
        error: sanitizeBrand(
          err instanceof Error ? err.message : t(locale, "expertReportApplyError"),
        ),
      });
    }
  },

  deactivate: () => set({ active: false, phase: "idle", error: null }),

  getReport: (reportId) => get().reports[reportId],

  cacheReport: (report) =>
    set((s) => ({ reports: { ...s.reports, [report.report_id]: report } })),

  clearError: () => set({ error: null }),
}));
