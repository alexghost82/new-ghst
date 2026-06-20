import { create } from "zustand";
import type { CameraFramePayload, ChatStreamEvent, Message } from "../types/api";
import { api } from "../api/client";
import { sanitizeBrand, sanitizeRefusal } from "../utils/sanitize";
import { getSafeStreamingDisplay } from "../services/streamDisplayGuard";
import { useLanguageStore } from "./languageStore";
import { useLiveStore } from "./liveStore";
import { useConversationStore } from "./conversationStore";
import { useConversationGroupsStore } from "./conversationGroupsStore";
import {
  conversationIdsForArea,
  conversationIdsForGroup,
} from "../utils/conversationGroups";
import { captureMultiFrame } from "../utils/cameraCapture";

export interface BroadcastScope {
  type: "area" | "group";
  id: string;
  name: string;
}

export interface BroadcastCamera {
  device_id: string;
  label: string;
}

export interface BroadcastConversation {
  id: string;
  title: string;
}

/** Two ways to question a scope:
 *  - ``search`` (חפש עכשיו) — capture a live frame per camera, reply per camera.
 *  - ``explore`` (חקור) — answer from each conversation's stored history. */
export type BroadcastMode = "search" | "explore";

/** A directed send aimed at a single member of the scope instead of the whole
 *  scope. The "/" picker always produces a ``conversation`` target; a reply on
 *  an explore reply produces a ``conversation`` target; a reply on a search
 *  reply produces a ``camera`` target (re-question that one device). */
export type BroadcastTarget =
  | { kind: "conversation"; id: string; title: string }
  | { kind: "camera"; deviceId: string; label: string };

interface BroadcastState {
  activeScope: BroadcastScope | null;
  mode: BroadcastMode;
  /** Participating cameras — the deduped union of every saved camera across
   *  the conversations in the scope. */
  cameras: BroadcastCamera[];
  /** Conversations in the scope, used as the explore-mode targets. */
  scopeConversations: BroadcastConversation[];
  loadingCameras: boolean;
  /** Ephemeral transcript — never persisted to the server. */
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingSourceImage: string | null;
  streamingCameraLabel: string | null;
  error: string | null;
  /** A directed-send target chosen via the "/" picker or a reply button.
   *  When set, the next send goes only to this member of the scope. */
  pendingTarget: BroadcastTarget | null;
  /** Maps each transcript message id to the scope member it concerns — the
   *  directed target on a user bubble, or the producing member on a Ghost
   *  reply (powering its reply button). */
  targetByMessageId: Record<string, BroadcastTarget>;
  /** Bumped whenever a target is set from outside the composer (reply button)
   *  so the composer can re-focus its textarea. */
  focusComposerNonce: number;

  openScope: (scope: BroadcastScope, userId: string) => Promise<void>;
  setMode: (mode: BroadcastMode) => void;
  close: () => void;
  setTarget: (target: BroadcastTarget) => void;
  clearTarget: () => void;
  sendBroadcast: (
    userId: string,
    content: string,
    target?: BroadcastTarget | null,
  ) => Promise<void>;
  dismissError: () => void;
}

function buildAssistantMessage(
  content: string,
  cameraLabel: string | null,
  imagePath: string | null,
  sequenceNumber: number,
): Message {
  return {
    id: `bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: "",
    role: "assistant",
    content,
    token_estimate: Math.ceil(content.length / 4),
    created_at: new Date().toISOString(),
    sequence_number: sequenceNumber,
    image_path: imagePath,
    camera_label: cameraLabel,
  };
}

/** Resolve the conversation ids that fall inside a scope (area or group). */
function resolveScopeConversationIds(scope: BroadcastScope): string[] {
  const groupsState = useConversationGroupsStore.getState();
  if (scope.type === "area") {
    const area = groupsState.areas.find((a) => a.id === scope.id);
    return area
      ? conversationIdsForArea(area, {
          areas: groupsState.areas,
          groups: groupsState.groups,
        })
      : [];
  }
  const group = groupsState.groups.find((g) => g.id === scope.id);
  return group ? conversationIdsForGroup(group) : [];
}

/** Map the scope's conversation ids to ``{ id, title }`` using the cached
 *  conversation list, preserving scope order. Conversations missing from the
 *  cache are skipped (they can't be explored without a title anyway). */
function resolveScopeConversations(scope: BroadcastScope): BroadcastConversation[] {
  const ids = resolveScopeConversationIds(scope);
  const byId = new Map(
    useConversationStore.getState().conversations.map((c) => [c.id, c]),
  );
  const result: BroadcastConversation[] = [];
  for (const id of ids) {
    const conv = byId.get(id);
    if (conv) result.push({ id: conv.id, title: conv.title });
  }
  return result;
}

/** Resolve the union of saved cameras for every conversation in a scope,
 *  loading any that aren't cached yet. Deduplicates by ``device_id`` so a
 *  physical camera shared across conversations is only broadcast to once. */
async function resolveScopeCameras(
  scope: BroadcastScope,
  userId: string,
): Promise<BroadcastCamera[]> {
  const conversationIds = resolveScopeConversationIds(scope);

  const live = useLiveStore.getState();

  await Promise.all(
    conversationIds
      .filter((id) => !live.savedCameras[id])
      .map((id) => live.fetchSavedCameras(id, userId)),
  );

  const saved = useLiveStore.getState().savedCameras;
  const byDevice = new Map<string, BroadcastCamera>();
  for (const convId of conversationIds) {
    for (const cam of saved[convId] ?? []) {
      if (!byDevice.has(cam.device_id)) {
        byDevice.set(cam.device_id, {
          device_id: cam.device_id,
          label: cam.label,
        });
      }
    }
  }
  return Array.from(byDevice.values());
}

/** Resolve the deduped saved cameras for a single conversation (a directed
 *  search target), loading them from the backend if not already cached. */
async function camerasForConversation(
  conversationId: string,
  userId: string,
): Promise<BroadcastCamera[]> {
  const live = useLiveStore.getState();
  if (!live.savedCameras[conversationId]) {
    await live.fetchSavedCameras(conversationId, userId);
  }
  const saved = useLiveStore.getState().savedCameras[conversationId] ?? [];
  const byDevice = new Map<string, BroadcastCamera>();
  for (const cam of saved) {
    if (!byDevice.has(cam.device_id)) {
      byDevice.set(cam.device_id, { device_id: cam.device_id, label: cam.label });
    }
  }
  return Array.from(byDevice.values());
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  activeScope: null,
  mode: "search",
  cameras: [],
  scopeConversations: [],
  loadingCameras: false,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  streamingSourceImage: null,
  streamingCameraLabel: null,
  error: null,
  pendingTarget: null,
  targetByMessageId: {},
  focusComposerNonce: 0,

  openScope: async (scope, userId) => {
    set({
      activeScope: scope,
      // Always reopen in the default "search" mode.
      mode: "search",
      cameras: [],
      // Conversations in scope are resolved synchronously from the cached
      // conversation list — they back the "explore" mode targets.
      scopeConversations: resolveScopeConversations(scope),
      loadingCameras: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
      streamingSourceImage: null,
      streamingCameraLabel: null,
      error: null,
      pendingTarget: null,
      targetByMessageId: {},
    });
    try {
      const cameras = await resolveScopeCameras(scope, userId);
      // Guard against a race where the user closed/switched scope mid-fetch.
      if (get().activeScope?.id !== scope.id) return;
      set({ cameras, loadingCameras: false });
    } catch {
      if (get().activeScope?.id !== scope.id) return;
      set({ cameras: [], loadingCameras: false });
    }
  },

  setMode: (mode) => {
    if (get().isStreaming) return;
    set({
      mode,
      // Clear any transient streaming preview when toggling modes.
      streamingContent: "",
      streamingSourceImage: null,
      streamingCameraLabel: null,
      error: null,
    });
  },

  setTarget: (target) =>
    set((s) => ({
      pendingTarget: target,
      focusComposerNonce: s.focusComposerNonce + 1,
      error: null,
    })),

  clearTarget: () => set({ pendingTarget: null }),

  close: () =>
    set({
      activeScope: null,
      mode: "search",
      cameras: [],
      scopeConversations: [],
      loadingCameras: false,
      messages: [],
      pendingTarget: null,
      targetByMessageId: {},
      isStreaming: false,
      streamingContent: "",
      streamingSourceImage: null,
      streamingCameraLabel: null,
      error: null,
    }),

  sendBroadcast: async (userId, content, target) => {
    const { cameras, scopeConversations, activeScope, mode } = get();
    if (!activeScope) return;

    // A directed send aims at one scope member. A ``camera`` target can only be
    // re-questioned live (search), so it forces the search transport; otherwise
    // the active mode decides.
    const directed = target ?? null;
    const useExplore = directed?.kind !== "camera" && mode === "explore";

    if (!useExplore && directed === null && cameras.length === 0) return;
    if (useExplore) {
      const ids =
        directed?.kind === "conversation"
          ? [directed.id]
          : scopeConversations.map((c) => c.id);
      if (ids.length === 0) return;
    }

    const userMessage: Message = {
      id: `bc-user-${Date.now()}`,
      conversation_id: "",
      role: "user",
      content,
      token_estimate: Math.ceil(content.length / 4),
      created_at: new Date().toISOString(),
      sequence_number: get().messages.length + 1,
      image_path: null,
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      // Record the directed target on the user bubble (if any) and consume the
      // pending target — a directed send is a one-shot.
      targetByMessageId: directed
        ? { ...s.targetByMessageId, [userMessage.id]: directed }
        : s.targetByMessageId,
      pendingTarget: null,
      isStreaming: true,
      streamingContent: "",
      streamingSourceImage: null,
      streamingCameraLabel: null,
      error: null,
    }));

    const stopWithError = (message: string) =>
      set({
        isStreaming: false,
        streamingContent: "",
        streamingSourceImage: null,
        streamingCameraLabel: null,
        error: sanitizeBrand(message),
      });

    const locale = useLanguageStore.getState().locale;

    // ``metaByLabel`` maps a stream segment label back to its source frame and
    // device. In search mode this holds a freshly captured frame per camera; in
    // explore mode it stays empty (no live capture, source image always null).
    const metaByLabel = new Map<string, { image: string; deviceId: string }>();

    let stream: ReadableStream<ChatStreamEvent>;

    if (useExplore) {
      const conversationIds =
        directed?.kind === "conversation"
          ? [directed.id]
          : scopeConversations.map((c) => c.id);
      try {
        stream = await api.sendBroadcastExplore(
          userId,
          content,
          conversationIds,
          locale,
          activeScope.name,
        );
      } catch (err) {
        stopWithError(
          err instanceof Error ? err.message : "Failed to send broadcast",
        );
        return;
      }
    } else {
      // Resolve which cameras to capture: a single device for a camera target,
      // the target conversation's cameras for a conversation target, or the
      // whole scope otherwise.
      let captureList: BroadcastCamera[];
      if (directed?.kind === "camera") {
        captureList = [{ device_id: directed.deviceId, label: directed.label }];
      } else if (directed?.kind === "conversation") {
        captureList = await camerasForConversation(directed.id, userId);
        if (captureList.length === 0) {
          stopWithError("Failed to capture any camera frame");
          return;
        }
      } else {
        captureList = cameras;
      }

      // Capture a fresh frame from every participating camera. Skip cameras
      // that fail so one offline device doesn't sink the whole broadcast.
      const frames: CameraFramePayload[] = [];
      for (const cam of captureList) {
        try {
          const b64 = await captureMultiFrame(cam.device_id);
          frames.push({
            device_id: cam.device_id,
            label: cam.label,
            image_base64: b64,
          });
        } catch {
          // skip this camera
        }
      }

      if (frames.length === 0) {
        stopWithError("Failed to capture any camera frame");
        return;
      }

      frames.forEach((f) =>
        metaByLabel.set(f.label, {
          image: `data:image/jpeg;base64,${f.image_base64}`,
          deviceId: f.device_id,
        }),
      );

      try {
        stream = await api.sendBroadcastMessage(
          userId,
          content,
          frames,
          locale,
          activeScope.name,
        );
      } catch (err) {
        stopWithError(
          err instanceof Error ? err.message : "Failed to send broadcast",
        );
        return;
      }
    }

    try {
      const reader = stream.getReader();

      let accumulated = "";
      let activeCameraLabel: string | null = null;
      let activeConversationId: string | null = null;

      const commitCurrentBubble = () => {
        if (!accumulated) return;
        const sanitized = sanitizeRefusal(accumulated, locale);
        const meta = activeCameraLabel
          ? metaByLabel.get(activeCameraLabel)
          : undefined;
        const imagePath = meta?.image ?? null;
        const assistant = buildAssistantMessage(
          sanitized,
          activeCameraLabel,
          imagePath,
          get().messages.length + 1,
        );
        // Tag the reply with the scope member that produced it, powering its
        // reply button: a conversation (explore) or a camera (search).
        let replyTarget: BroadcastTarget | null = null;
        if (activeConversationId) {
          replyTarget = {
            kind: "conversation",
            id: activeConversationId,
            title: activeCameraLabel ?? "",
          };
        } else if (activeCameraLabel && meta) {
          replyTarget = {
            kind: "camera",
            deviceId: meta.deviceId,
            label: activeCameraLabel,
          };
        }
        set((s) => ({
          messages: [...s.messages, assistant],
          targetByMessageId: replyTarget
            ? { ...s.targetByMessageId, [assistant.id]: replyTarget }
            : s.targetByMessageId,
          streamingContent: "",
          streamingCameraLabel: null,
          streamingSourceImage: null,
        }));
        accumulated = "";
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value.type === "camera_start") {
          activeCameraLabel = value.label;
          activeConversationId = value.conversation_id ?? null;
          accumulated = "";
          set({
            streamingContent: "",
            streamingCameraLabel: value.label,
            streamingSourceImage: metaByLabel.get(value.label)?.image ?? null,
          });
        } else if (value.type === "camera_done") {
          commitCurrentBubble();
        } else if (value.type === "token") {
          accumulated += value.token;
          // Same live refusal guard as the main chat (P0 defense-in-depth).
          set({ streamingContent: getSafeStreamingDisplay(accumulated, locale) });
        }
      }

      // Flush any trailing content the server didn't bracket with camera_done.
      commitCurrentBubble();

      set({
        isStreaming: false,
        streamingContent: "",
        streamingSourceImage: null,
        streamingCameraLabel: null,
      });
    } catch (err) {
      stopWithError(
        err instanceof Error ? err.message : "Failed to send broadcast",
      );
    }
  },

  dismissError: () => set({ error: null }),
}));
