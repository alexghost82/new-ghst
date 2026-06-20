import { create } from "zustand";
import type { CameraFramePayload, ExpertReport, Message } from "../types/api";
import { api } from "../api/client";
import { EXPERT_PREPARING_MARKER } from "../utils/expertReportMarker";
import { useExpertStore } from "./expertStore";
import { sanitizeBrand, sanitizeRefusal } from "../utils/sanitize";
import { getSafeStreamingDisplay } from "../services/streamDisplayGuard";
import { useLanguageStore, type Locale } from "./languageStore";
import { useConversationStore } from "./conversationStore";
import { useConversationGroupsStore } from "./conversationGroupsStore";
import { useConversationActivityStore } from "./conversationActivityStore";
import { useAutoNamingStore } from "./autoNamingStore";
import { useCelebrationStore, mentionsNoa } from "./celebrationStore";
import { assignmentFor } from "../utils/conversationGroups";
import {
  SITE_PREPARING_MARKER,
  SITE_REPORT_MARKER,
} from "../utils/siteReportMarker";

interface MessageState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  /** Content for the currently-streaming assistant bubble (single-camera or
   * the active camera in multi-camera mode). */
  streamingContent: string;
  /** Source image displayed inside the currently-streaming bubble. For
   * multi-camera turns, this is the image of the active camera. */
  streamingSourceImage: string | null;
  /** Camera label shown above the currently-streaming assistant bubble, when
   * the response is tied to a specific camera. */
  streamingCameraLabel: string | null;
  /** A Sitelligence scan is in flight. Suppresses the default streaming bubble
   *  (its progress is shown by the dedicated in-chat scan-progress card). */
  siteScanActive: boolean;
  error: string | null;
  abortController: AbortController | null;
  /** A history refresh requested *during* an active stream on the open
   *  conversation. Deferred until the stream finishes so it can't wipe the
   *  in-flight reply (see ``fetchMessages``). */
  pendingRefetch: { conversationId: string; userId: string } | null;

  fetchMessages: (conversationId: string, userId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    userId: string,
    content: string,
    imageBase64?: string,
    cameraFrames?: CameraFramePayload[],
    mode?: "chat" | "site_intelligence" | "expert",
  ) => Promise<void>;
  /** Ghost Expert: generate the recommendation set from a captured frame +
   *  the interrogation history, swapping a transient "preparing" card for the
   *  downloadable report card. Returns the report (or null on failure). */
  runExpertGenerate: (
    conversationId: string,
    userId: string,
    frameBase64?: string,
  ) => Promise<ExpertReport | null>;
  /** Button-driven Sitelligence scan: shows a rotating scan-progress card,
   *  streams the structured report silently, then swaps in a downloadable
   *  report card (the full report never renders as a raw chat bubble). */
  runSiteIntelligence: (
    conversationId: string,
    userId: string,
    frameBase64: string,
  ) => Promise<void>;
  clearMessages: () => void;
  cancelStream: () => void;
  dismissError: () => void;

  /** Insert a transient "preparing PDF report" card while a report-capable
   *  task run is in flight. No-op when the task's conversation isn't the one
   *  currently open, and deduped per task so a retrigger/refresh can't stack
   *  duplicate placeholders. */
  addPreparingReport: (conversationId: string, taskId: string) => void;
  /** Flip the transient card to an error state (generation failed). */
  failPreparingReport: (taskId: string) => void;
  /** Remove the transient card (report arrived, or the run produced none). */
  clearPreparingReport: (taskId: string) => void;
}

/** Client-only sentinel for the transient report-generation card. Mirrors the
 *  `[[GHOST_TASK_REPORT:<id>]]` marker style parsed by MessageBubble, but never
 *  persisted server-side — it only lives in the active conversation's message
 *  list until the real report card replaces it. */
export const TASK_PREPARING_PREFIX = "[[GHOST_TASK_PREPARING:";

function preparingId(taskId: string): string {
  return `preparing-${taskId}`;
}

// Monotonic token guarding against out-of-order fetchMessages responses: when
// the operator switches conversations quickly, a slow earlier response must
// not overwrite the newer conversation's messages.
let fetchSeq = 0;

function preparingContent(
  taskId: string,
  status: "pending" | "failed",
): string {
  return `${TASK_PREPARING_PREFIX}${taskId}:${status}]]`;
}

function buildAssistantMessage(
  serverId: string | undefined,
  conversationId: string,
  content: string,
  cameraLabel: string | null,
  imagePath: string | null,
  sequenceNumber: number,
): Message {
  return {
    id: serverId ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: conversationId,
    role: "assistant",
    content,
    token_estimate: Math.ceil(content.length / 4),
    created_at: new Date().toISOString(),
    sequence_number: sequenceNumber,
    image_path: imagePath,
    camera_label: cameraLabel,
  };
}

/**
 * Auto-naming orchestrator. The frontend decides *when* and *whether* to
 * (re)summarise a conversation's title; the server generates the text.
 *
 * Skipped entirely when:
 *  - the title is operator-locked (``title_source === 'manual'`` — a manual
 *    rename or an incident-investigation conversation),
 *  - the conversation lives inside an area/group (product rule: those are
 *    manual-only),
 *  - auto-naming is disabled globally or for this conversation.
 *
 * Timing: the first assistant reply names it in ~4 words; thereafter every 4
 * new messages refreshes it in up to 6 words.
 */
async function maybeAutoNameConversation(
  conversationId: string,
  locale: Locale,
): Promise<void> {
  const conv = useConversationStore
    .getState()
    .conversations.find((c) => c.id === conversationId);
  if (!conv) return;
  if (conv.title_source === "manual") return;

  const groups = useConversationGroupsStore.getState();
  const assignment = assignmentFor(conversationId, {
    areas: groups.areas,
    groups: groups.groups,
  });
  if (assignment.areaId || assignment.groupId) return;

  const autoStore = useAutoNamingStore.getState();
  if (!autoStore.isEffectiveEnabled(conversationId)) return;

  const messages = useMessageStore.getState().messages;
  const total = messages.length;
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  if (assistantCount === 0) return;

  const lastNamed = autoStore.lastNamedCount[conversationId] ?? 0;
  const isFirstReply = lastNamed === 0;
  const shouldName = isFirstReply || total - lastNamed >= 4;
  if (!shouldName) return;

  const res = await api.generateAutoTitle(conversationId, {
    locale,
    max_words: isFirstReply ? 4 : 6,
  });
  if (res.ok && res.data) {
    const updated = res.data;
    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, ...updated } : c,
      ),
    }));
    autoStore.setLastNamedCount(conversationId, total);
  }
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: "",
  streamingSourceImage: null,
  streamingCameraLabel: null,
  siteScanActive: false,
  error: null,
  abortController: null,
  pendingRefetch: null,

  fetchMessages: async (conversationId, userId) => {
    // A history refresh fired (task/alert landed) while a reply is streaming
    // into the conversation the operator is watching. Replacing the message
    // list now would wipe the in-flight reply and let tokens write into a
    // cleared list. Defer it: the stream's teardown flushes pendingRefetch.
    if (
      get().isStreaming &&
      useConversationStore.getState().activeConversationId === conversationId
    ) {
      set({ pendingRefetch: { conversationId, userId } });
      return;
    }
    const seq = ++fetchSeq;
    // Clear + enter loading atomically so neither the previous conversation's
    // messages nor the empty-state flash while the new history loads.
    set({ messages: [], isLoading: true, error: null });
    const res = await api.getMessages(conversationId, userId);
    // A newer switch superseded this fetch — drop the stale response.
    if (seq !== fetchSeq) return;
    if (res.ok && res.data) {
      set({ messages: res.data, isLoading: false });
    } else {
      set({
        isLoading: false,
        error: sanitizeBrand(res.error?.message ?? "Failed to fetch messages"),
      });
    }
  },

  sendMessage: async (
    conversationId,
    userId,
    content,
    imageBase64,
    cameraFrames,
    mode,
  ) => {
    const isMulti = !!cameraFrames && cameraFrames.length > 0;
    const tempUserId = `temp-${Date.now()}`;
    const optimisticImagePath = imageBase64
      ? `data:image/jpeg;base64,${imageBase64}`
      : null;

    const userMessage: Message = {
      id: tempUserId,
      conversation_id: conversationId,
      role: "user",
      content,
      token_estimate: Math.ceil(content.length / 4),
      created_at: new Date().toISOString(),
      sequence_number: get().messages.length + 1,
      image_path: optimisticImagePath,
    };

    // Fresh abort controller per send so the operator's Stop button can
    // actually tear down the in-flight fetch (and the SSE reader unwinds).
    const abortController = new AbortController();

    set((s) => ({
      messages: [...s.messages, userMessage],
      isStreaming: true,
      streamingContent: "",
      streamingSourceImage: optimisticImagePath,
      streamingCameraLabel: null,
      error: null,
      abortController,
    }));

    const locale = useLanguageStore.getState().locale;

    // Declared in the function scope (not inside the try) so the catch can read
    // the partial reply when the operator aborts mid-stream and commit it.
    let accumulated = "";
    let activeCameraLabel: string | null = null;
    let serverAssistantMessageId: string | undefined;

    try {
      const stream = await api.sendMessage(
        conversationId,
        userId,
        content,
        imageBase64,
        cameraFrames,
        locale,
        mode,
        undefined,
        abortController.signal,
      );
      const reader = stream.getReader();

      let serverUserMessageId: string | undefined;
      let serverUserImagePath: string | null | undefined;
      const cameraIndexByLabel = new Map<string, number>();
      if (cameraFrames) {
        cameraFrames.forEach((f, i) => cameraIndexByLabel.set(f.label, i));
      }

      const commitCurrentBubble = (
        finalMessageId: string | undefined,
        finalImagePath: string | null,
      ) => {
        if (!accumulated) return;
        const sanitized = sanitizeRefusal(accumulated, locale);
        if (mentionsNoa(sanitized)) {
          useCelebrationStore.getState().celebrate();
        }
        const assistant = buildAssistantMessage(
          finalMessageId,
          conversationId,
          sanitized,
          activeCameraLabel,
          finalImagePath,
          get().messages.length + 1,
        );
        set((s) => ({
          messages: [...s.messages, assistant],
          streamingContent: "",
          streamingCameraLabel: null,
          streamingSourceImage: isMulti ? null : s.streamingSourceImage,
        }));
        accumulated = "";
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value.type === "user_message") {
          serverUserMessageId = value.user_message_id;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === tempUserId
                ? { ...m, id: value.user_message_id, image_path: null }
                : m,
            ),
          }));
        } else if (value.type === "camera_start") {
          activeCameraLabel = value.label;
          accumulated = "";
          const idx = cameraIndexByLabel.get(value.label);
          const sourceImage =
            idx !== undefined && cameraFrames
              ? `data:image/jpeg;base64,${cameraFrames[idx].image_base64}`
              : null;
          set({
            streamingContent: "",
            streamingCameraLabel: value.label,
            streamingSourceImage: sourceImage,
          });
        } else if (value.type === "camera_done") {
          const finalImagePath = value.image_path ?? null;
          commitCurrentBubble(value.message_id, finalImagePath);
        } else if (value.type === "token") {
          accumulated += value.token;
          // Guard the live display: a refusal can never reach the UI mid-stream
          // (P0), and a partially-streamed refusal opener stays withheld until
          // it resolves. Clean text streams with no added latency.
          set({ streamingContent: getSafeStreamingDisplay(accumulated, locale) });
        } else if (value.type === "done") {
          serverAssistantMessageId = value.message_id;
          serverUserImagePath = value.user_image_path ?? null;
          if (!serverUserMessageId) {
            serverUserMessageId = value.user_message_id;
          }
          // Ghost Expert: the interrogation gathered enough context — prompt
          // the operator to authorize a live frame pull on their next turn.
          if (value.expert_ready) {
            useExpertStore.getState().setAwaitingConsent();
          }
        }
      }

      if (!isMulti) {
        const sanitizedContent = sanitizeRefusal(accumulated, locale);
        if (mentionsNoa(sanitizedContent)) {
          useCelebrationStore.getState().celebrate();
        }
        const resolvedImagePath =
          serverUserImagePath ?? optimisticImagePath ?? null;

        const assistantMessage = buildAssistantMessage(
          serverAssistantMessageId,
          conversationId,
          sanitizedContent,
          null,
          null,
          get().messages.length + 2,
        );

        set((s) => ({
          messages: [
            ...s.messages.map((m) =>
              m.id === tempUserId
                ? {
                    ...m,
                    id: serverUserMessageId ?? m.id,
                    image_path: resolvedImagePath,
                  }
                : m,
            ),
            assistantMessage,
          ],
          isStreaming: false,
          streamingContent: "",
          streamingSourceImage: null,
          streamingCameraLabel: null,
          abortController: null,
        }));
      } else {
        set({
          isStreaming: false,
          streamingContent: "",
          streamingSourceImage: null,
          streamingCameraLabel: null,
          abortController: null,
        });
      }

      // A history refresh that arrived mid-stream (task/alert) was deferred to
      // avoid wiping the in-flight reply — run it now that the stream is done.
      const pending = get().pendingRefetch;
      if (pending) {
        set({ pendingRefetch: null });
        void get().fetchMessages(pending.conversationId, pending.userId);
      }

      // Surface this conversation at the top of the list (auto-read since the
      // operator is the one sending here).
      useConversationActivityStore
        .getState()
        .markActivity(conversationId, "message");

      // Best-effort: refresh the conversation's display name from Ghost's
      // replies. Never blocks the chat and silently no-ops on failure.
      void maybeAutoNameConversation(conversationId, locale);
    } catch (err) {
      // Operator pressed Stop -> the fetch/reader was aborted on purpose.
      // Tear down quietly; never surface it as an error.
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        abortController.signal.aborted;
      // Keep the partial reply that arrived before Stop (sanitized like any
      // committed reply). This is the SOLE place a partial is committed —
      // cancelStream only aborts — so the bubble can never be duplicated.
      if (aborted && accumulated) {
        const partial = buildAssistantMessage(
          serverAssistantMessageId,
          conversationId,
          sanitizeRefusal(accumulated, locale),
          activeCameraLabel,
          null,
          get().messages.length + 1,
        );
        set((s) => ({ messages: [...s.messages, partial] }));
      }
      set({
        isStreaming: false,
        streamingContent: "",
        streamingSourceImage: null,
        streamingCameraLabel: null,
        abortController: null,
        // Drop any deferred refetch: re-fetching here would clobber the partial
        // we just saved. It will resurface on the next natural history load.
        pendingRefetch: null,
        error: aborted
          ? null
          : sanitizeBrand(
              err instanceof Error ? err.message : "Failed to send message",
            ),
      });
    }
  },

  runSiteIntelligence: async (conversationId, userId, frameBase64) => {
    const locale = useLanguageStore.getState().locale;
    const tempUserId = `temp-${Date.now()}`;
    const optimisticImagePath = `data:image/jpeg;base64,${frameBase64}`;
    const preparingMessageId = `site-preparing-${conversationId}`;
    const requestContent = "Sitelligence\u2120 Report";

    const userMessage: Message = {
      id: tempUserId,
      conversation_id: conversationId,
      role: "user",
      content: requestContent,
      token_estimate: 0,
      created_at: new Date().toISOString(),
      sequence_number: get().messages.length + 1,
      image_path: optimisticImagePath,
    };
    const preparingMessage: Message = {
      id: preparingMessageId,
      conversation_id: conversationId,
      role: "assistant",
      content: SITE_PREPARING_MARKER,
      token_estimate: 0,
      created_at: new Date().toISOString(),
      sequence_number: get().messages.length + 2,
    };

    const abortController = new AbortController();
    set((s) => ({
      messages: [...s.messages, userMessage, preparingMessage],
      isStreaming: true,
      siteScanActive: true,
      streamingContent: "",
      streamingSourceImage: null,
      streamingCameraLabel: null,
      error: null,
      abortController,
    }));

    let accumulated = "";
    let serverAssistantMessageId: string | undefined;
    let serverUserMessageId: string | undefined;
    let serverUserImagePath: string | null | undefined;
    let gotDone = false;

    try {
      const stream = await api.sendMessage(
        conversationId,
        userId,
        requestContent,
        frameBase64,
        undefined,
        locale,
        "site_intelligence",
        undefined,
        abortController.signal,
      );
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.type === "token") {
          accumulated += value.token;
        } else if (value.type === "done") {
          gotDone = true;
          serverAssistantMessageId = value.message_id;
          serverUserMessageId = value.user_message_id;
          serverUserImagePath = value.user_image_path ?? null;
        }
      }

      if (!gotDone || !accumulated.trim()) {
        throw new Error("Empty Sitelligence response");
      }

      // Prefix with the report marker so the chat renders a download card (and
      // the long report never shows as a raw bubble). Mirrors the store-only
      // marker the backend persists, so a refresh reconstructs the same card.
      const reportContent =
        SITE_REPORT_MARKER + sanitizeRefusal(accumulated, locale);
      const assistant = buildAssistantMessage(
        serverAssistantMessageId,
        conversationId,
        reportContent,
        null,
        null,
        get().messages.length + 1,
      );

      set((s) => ({
        messages: [
          ...s.messages
            .filter((m) => m.id !== preparingMessageId)
            .map((m) =>
              m.id === tempUserId
                ? {
                    ...m,
                    id: serverUserMessageId ?? m.id,
                    image_path: serverUserImagePath ?? optimisticImagePath,
                  }
                : m,
            ),
          assistant,
        ],
        isStreaming: false,
        siteScanActive: false,
        streamingContent: "",
        streamingSourceImage: null,
        streamingCameraLabel: null,
        abortController: null,
      }));

      const pending = get().pendingRefetch;
      if (pending) {
        set({ pendingRefetch: null });
        void get().fetchMessages(pending.conversationId, pending.userId);
      }
      useConversationActivityStore
        .getState()
        .markActivity(conversationId, "message");
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        abortController.signal.aborted;
      set((s) => ({
        messages: aborted
          ? s.messages.filter((m) => m.id !== preparingMessageId)
          : s.messages.map((m) =>
              m.id === preparingMessageId
                ? { ...m, content: `${SITE_PREPARING_MARKER}:failed` }
                : m,
            ),
        isStreaming: false,
        siteScanActive: false,
        streamingContent: "",
        streamingSourceImage: null,
        streamingCameraLabel: null,
        abortController: null,
        pendingRefetch: null,
        error: aborted
          ? null
          : sanitizeBrand(
              err instanceof Error ? err.message : "Sitelligence scan failed",
            ),
      }));
    }
  },

  runExpertGenerate: async (conversationId, userId, frameBase64) => {
    const locale = useLanguageStore.getState().locale;
    const preparingId = `expert-preparing-${conversationId}`;
    const userTempId = `temp-expert-${Date.now()}`;
    const optimisticImagePath = frameBase64
      ? `data:image/jpeg;base64,${frameBase64}`
      : null;

    const userMessage: Message = {
      id: userTempId,
      conversation_id: conversationId,
      role: "user",
      content: "Ghost Expert",
      token_estimate: 0,
      created_at: new Date().toISOString(),
      sequence_number: get().messages.length + 1,
      image_path: optimisticImagePath,
    };
    const preparing: Message = {
      id: preparingId,
      conversation_id: conversationId,
      role: "assistant",
      content: EXPERT_PREPARING_MARKER,
      token_estimate: 0,
      created_at: new Date().toISOString(),
      sequence_number: get().messages.length + 2,
    };
    set((s) => ({ messages: [...s.messages, userMessage, preparing] }));

    const res = await api.generateExpert(
      conversationId,
      userId,
      frameBase64,
      locale,
    );

    if (!res.ok || !res.data) {
      // Drop the optimistic placeholders so the thread isn't left dangling.
      set((s) => ({
        messages: s.messages.filter(
          (m) => m.id !== preparingId && m.id !== userTempId,
        ),
        error: sanitizeBrand(res.error?.message ?? "Expert generation failed"),
      }));
      return null;
    }

    const report = res.data;
    const reportMessage = buildAssistantMessage(
      report.assistant_message_id,
      conversationId,
      `[[GHOST_EXPERT_REPORT:${report.report_id}]]`,
      null,
      null,
      get().messages.length + 1,
    );

    set((s) => ({
      messages: [
        ...s.messages
          .filter((m) => m.id !== preparingId)
          .map((m) =>
            m.id === userTempId
              ? {
                  ...m,
                  id: report.user_message_id ?? m.id,
                  image_path: report.user_image_path ?? optimisticImagePath,
                }
              : m,
          ),
        reportMessage,
      ],
    }));

    useConversationActivityStore
      .getState()
      .markActivity(conversationId, "message");
    return report;
  },

  clearMessages: () => {
    // Abort any in-flight stream so switching conversations mid-response can't
    // keep writing tokens into the newly opened conversation.
    get().abortController?.abort();
    set({
      messages: [],
      isStreaming: false,
      siteScanActive: false,
      streamingContent: "",
      streamingSourceImage: null,
      streamingCameraLabel: null,
      error: null,
      abortController: null,
      pendingRefetch: null,
    });
  },

  cancelStream: () => {
    // Only abort. The in-flight reader rejects with AbortError and
    // sendMessage's catch handles teardown AND commits the partial reply, so
    // there is a single owner of that commit (no duplicate bubble) and the
    // partial is never silently discarded.
    get().abortController?.abort();
  },

  dismissError: () => set({ error: null }),

  addPreparingReport: (conversationId, taskId) => {
    const activeId = useConversationStore.getState().activeConversationId;
    if (activeId !== conversationId) return;
    const id = preparingId(taskId);
    set((s) => {
      if (s.messages.some((m) => m.id === id)) return s;
      const placeholder: Message = {
        id,
        conversation_id: conversationId,
        role: "assistant",
        content: preparingContent(taskId, "pending"),
        token_estimate: 0,
        created_at: new Date().toISOString(),
        sequence_number: s.messages.length + 1,
      };
      return { messages: [...s.messages, placeholder] };
    });
  },

  failPreparingReport: (taskId) => {
    const id = preparingId(taskId);
    set((s) => {
      if (!s.messages.some((m) => m.id === id)) return s;
      return {
        messages: s.messages.map((m) =>
          m.id === id
            ? { ...m, content: preparingContent(taskId, "failed") }
            : m,
        ),
      };
    });
  },

  clearPreparingReport: (taskId) => {
    const id = preparingId(taskId);
    set((s) => {
      if (!s.messages.some((m) => m.id === id)) return s;
      return { messages: s.messages.filter((m) => m.id !== id) };
    });
  },
}));
