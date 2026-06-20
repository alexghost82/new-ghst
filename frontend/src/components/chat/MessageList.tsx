import { ArrowDown } from "lucide-react";
import { useMessageStore } from "../../stores/messageStore";
import { useConversationStore } from "../../stores/conversationStore";
import MessageBubble from "./MessageBubble";
import GhostIcon from "../shared/GhostIcon";
import type { Message } from "../../types/api";
import { useT } from "../../utils/i18n";
import { useChatAutoScroll } from "../../hooks/useChatAutoScroll";

function findSourceImage(
  messages: Message[],
  assistantIndex: number,
): string | null {
  const current = messages[assistantIndex];
  if (current?.camera_label && current.image_path) {
    return current.image_path;
  }
  for (let i = assistantIndex - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === "user") {
      return m.image_path ?? null;
    }
    if (m.role === "assistant") {
      return null;
    }
  }
  return null;
}

export default function MessageList() {
  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    streamingSourceImage,
    streamingCameraLabel,
    siteScanActive,
  } = useMessageStore();
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId,
  );
  const t = useT();

  // Auto-scroll behavior lives in a dedicated hook backed by pure, unit-tested
  // helpers (``chatScrollUtils``). Behavior is identical to before; the
  // component is now just wiring.
  const {
    containerRef,
    contentRef,
    bottomRef,
    showJumpButton,
    onScroll,
    jumpToBottom,
  } = useChatAutoScroll({ messages, streamingContent, activeConversationId });

  // During a Sitelligence scan the progress is shown by the dedicated in-chat
  // scan-progress card, so the generic streaming bubble is suppressed.
  const streamingPlaceholder: Message | null = isStreaming && !siteScanActive
    ? {
        id: "streaming",
        conversation_id: "",
        role: "assistant",
        content: "",
        token_estimate: 0,
        created_at: new Date().toISOString(),
        sequence_number: messages.length + 1,
      }
    : null;

  return (
    <div
      ref={containerRef}
      data-tour="message-list"
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
    >
      <div ref={contentRef} className="max-w-chat mx-auto">
        {isLoading && messages.length === 0 ? (
          // Loading skeleton while a conversation's history is fetched, so the
          // empty "how can I help" state never flashes mid-switch.
          <div className="space-y-6 pt-2" aria-busy aria-label={t("loading")}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`h-16 rounded-2xl bg-ghost-surface/60 animate-pulse ${
                    i % 2 === 0 ? "w-3/5" : "w-2/5"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="relative flex flex-col items-center justify-center h-full min-h-[440px] text-center px-6">
            <div className="ghost-ambient" aria-hidden>
              <div
                className="ghost-ambient__blob ghost-ambient__blob--1"
                style={{
                  top: -30,
                  left: "50%",
                  marginLeft: -220,
                  width: 440,
                  height: 440,
                  background:
                    "radial-gradient(circle, rgb(96 116 132 / 0.4), transparent 70%)",
                }}
              />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <GhostIcon size={56} className="mb-5" />
              <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted mb-3">
                Ghost // Session
              </span>
              <p className="font-raanana text-[20px] font-semibold leading-tight text-ghost-text-primary">
                {t("howCanIHelp")}
              </p>
              <p className="font-raanana mt-1.5 text-[13.5px] text-ghost-text-secondary">
                {t("writeMessageBelow")}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                sourceImageUrl={
                  msg.role === "assistant" ? findSourceImage(messages, idx) : null
                }
                cameraLabel={msg.camera_label ?? null}
              />
            ))}
            {streamingPlaceholder && (
              <MessageBubble
                message={streamingPlaceholder}
                isStreaming
                streamingContent={streamingContent}
                sourceImageUrl={streamingSourceImage}
                cameraLabel={streamingCameraLabel}
              />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {showJumpButton && (
        <button
          onClick={jumpToBottom}
          className="
            fixed bottom-24 start-1/2 -translate-x-1/2 z-10
            bg-ghost-surface/90 backdrop-blur-sm border border-ghost-border-subtle
            text-ghost-text-secondary hover:text-ghost-text-primary
            rounded-full ps-3 pe-3.5 py-1.5 text-small
            flex items-center gap-1.5
            shadow-[0_1px_3px_rgba(0,0,0,0.18)] hover:bg-ghost-surface-hover
            transition-all duration-[160ms]
          "
        >
          <ArrowDown size={14} />
          {t("jumpToLatest")}
        </button>
      )}
    </div>
  );
}
