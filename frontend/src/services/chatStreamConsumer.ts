import type { ChatStreamEvent } from "../types/api";
import { sanitizeRefusal } from "../utils/sanitize";
import { getSafeStreamingDisplay } from "./streamDisplayGuard";

/**
 * Pure, framework-free model of how a Ghost chat SSE stream is consumed into
 * displayable bubbles. The live stores (``messageStore`` / ``broadcastStore``)
 * implement the same semantics imperatively; this reducer exists so those
 * semantics are *specified and unit-tested* in isolation:
 *
 *  - every visible token is passed through {@link getSafeStreamingDisplay} so a
 *    refusal can never reach the UI mid-stream (P0 rule, defense-in-depth);
 *  - committed bubbles are sanitized with {@link sanitizeRefusal};
 *  - an ``abort`` (operator pressed Stop) commits whatever partial reply was
 *    accumulated — it is never silently discarded;
 *  - multi-camera turns commit one bubble per ``camera_done``.
 */

export interface CommittedBubble {
  /** Sanitized, display-safe content. */
  content: string;
  cameraLabel: string | null;
  messageId?: string;
  imagePath: string | null;
}

export interface StreamConsumerState {
  /** Raw buffer for the in-flight bubble (pre-sanitization). */
  accumulated: string;
  /** Display-safe projection of {@link accumulated} for the streaming bubble. */
  display: string;
  activeCameraLabel: string | null;
  committed: CommittedBubble[];
  serverUserMessageId?: string;
  serverAssistantMessageId?: string;
  userImagePath: string | null;
  /** True once the stream ended or was aborted. */
  finished: boolean;
}

export type ConsumerEvent =
  | ChatStreamEvent
  | { type: "abort" }
  | { type: "end"; isMulti: boolean };

export interface ConsumerConfig {
  locale: "he" | "en";
}

export function initialConsumerState(): StreamConsumerState {
  return {
    accumulated: "",
    display: "",
    activeCameraLabel: null,
    committed: [],
    userImagePath: null,
    finished: false,
  };
}

function commitBubble(
  state: StreamConsumerState,
  locale: "he" | "en",
  opts: { messageId?: string; imagePath: string | null },
): StreamConsumerState {
  if (!state.accumulated) return state;
  const bubble: CommittedBubble = {
    content: sanitizeRefusal(state.accumulated, locale),
    cameraLabel: state.activeCameraLabel,
    messageId: opts.messageId,
    imagePath: opts.imagePath,
  };
  return {
    ...state,
    committed: [...state.committed, bubble],
    accumulated: "",
    display: "",
  };
}

export function consumerReducer(
  state: StreamConsumerState,
  event: ConsumerEvent,
  config: ConsumerConfig,
): StreamConsumerState {
  const { locale } = config;
  switch (event.type) {
    case "user_message":
      return { ...state, serverUserMessageId: event.user_message_id };

    case "camera_start":
      return {
        ...state,
        activeCameraLabel: event.label,
        accumulated: "",
        display: "",
      };

    case "camera_done":
      return commitBubble(state, locale, {
        messageId: event.message_id,
        imagePath: event.image_path ?? null,
      });

    case "token": {
      const accumulated = state.accumulated + event.token;
      return {
        ...state,
        accumulated,
        display: getSafeStreamingDisplay(accumulated, locale),
      };
    }

    case "done":
      return {
        ...state,
        serverAssistantMessageId: event.message_id,
        userImagePath: event.user_image_path ?? state.userImagePath,
        serverUserMessageId: state.serverUserMessageId ?? event.user_message_id,
      };

    case "abort": {
      // Operator pressed Stop — preserve the partial reply, never discard it.
      const committed = commitBubble(state, locale, {
        messageId: state.serverAssistantMessageId,
        imagePath: null,
      });
      return { ...committed, finished: true };
    }

    case "end": {
      if (event.isMulti) {
        // Multi-camera turns already committed per camera_done.
        return { ...state, finished: true };
      }
      const committed = commitBubble(state, locale, {
        messageId: state.serverAssistantMessageId,
        imagePath: state.userImagePath,
      });
      return { ...committed, finished: true };
    }

    default:
      return state;
  }
}

/** Convenience: fold a full event sequence into a final state. */
export function runConsumer(
  events: ConsumerEvent[],
  config: ConsumerConfig,
): StreamConsumerState {
  return events.reduce(
    (state, event) => consumerReducer(state, event, config),
    initialConsumerState(),
  );
}
