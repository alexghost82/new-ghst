import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import type { Message } from "../../types/api";
import { api } from "../../api/client";
import { useUserStore } from "../../stores/userStore";
import { useIncidentStore } from "../../stores/incidentStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import { sanitizeBrand, sanitizeRefusal } from "../../utils/sanitize";
import { getSafeStreamingDisplay } from "../../services/streamDisplayGuard";

interface IncidentInvestigationChatProps {
  incidentId: string;
}

/**
 * Standalone chat surface for incident investigation. Doesn't share
 * state with the global ``messageStore`` (which is bound to the active
 * sidebar conversation) — that keeps the operator's main chat session
 * intact even when they're investigating in parallel.
 */
export default function IncidentInvestigationChat({
  incidentId,
}: IncidentInvestigationChatProps) {
  const t = useT();
  const locale = useLanguageStore((s) => s.locale);
  const activeUserId = useUserStore((s) => s.activeUserId);
  const startInvestigation = useIncidentStore((s) => s.startInvestigation);
  const cachedConvId = useIncidentStore(
    (s) => s.investigationConversations[incidentId],
  );

  const [conversationId, setConversationId] = useState<string | null>(
    cachedConvId ?? null,
  );
  const [bootstrapping, setBootstrapping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (cachedConvId && cachedConvId !== conversationId) {
      setConversationId(cachedConvId);
    }
  }, [cachedConvId, conversationId]);

  useEffect(() => {
    if (!conversationId || !activeUserId) return;
    let cancelled = false;
    (async () => {
      const res = await api.getMessages(conversationId, activeUserId);
      if (cancelled) return;
      if (res.ok && res.data) setMessages(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, activeUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingContent]);

  const handleStart = async () => {
    if (!activeUserId) return;
    setBootstrapping(true);
    const result = await startInvestigation(incidentId, activeUserId);
    setBootstrapping(false);
    if (result?.conversation_id) {
      setConversationId(result.conversation_id);
    }
  };

  const handleSend = async () => {
    if (!conversationId || !activeUserId) return;
    const content = input.trim();
    if (!content) return;
    setInput("");
    setError(null);

    const optimisticUser: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: "user",
      content,
      token_estimate: Math.ceil(content.length / 4),
      created_at: new Date().toISOString(),
      sequence_number: messages.length + 1,
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const stream = await api.sendMessage(
        conversationId,
        activeUserId,
        content,
        undefined,
        undefined,
        locale,
      );
      const reader = stream.getReader();
      let accumulated = "";
      let serverAssistantId: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.type === "token") {
          accumulated += value.token;
          setStreamingContent(accumulated);
        } else if (value.type === "done") {
          serverAssistantId = value.message_id;
        }
      }

      const sanitized = sanitizeRefusal(accumulated, locale);
      const assistant: Message = {
        id: serverAssistantId ?? `assist-${Date.now()}`,
        conversation_id: conversationId,
        role: "assistant",
        content: sanitized,
        token_estimate: Math.ceil(sanitized.length / 4),
        created_at: new Date().toISOString(),
        sequence_number: messages.length + 2,
      };
      setMessages((prev) => [...prev, assistant]);
      setStreamingContent("");
      setIsStreaming(false);
    } catch (err) {
      setIsStreaming(false);
      setStreamingContent("");
      setError(
        sanitizeBrand(
          err instanceof Error ? err.message : "Investigation request failed",
        ),
      );
    }
  };

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <Sparkles size={28} className="text-ghost-text-muted mb-3 opacity-80" />
        <p className="text-small text-ghost-text-secondary max-w-sm leading-relaxed">
          {t("investigationStartHint")}
        </p>
        <button
          onClick={handleStart}
          disabled={bootstrapping}
          className="mt-4 px-4 py-2 rounded-lg bg-ghost-text-primary text-ghost-bg text-small font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {bootstrapping ? t("loading") : t("startInvestigation")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-1 py-2 space-y-3"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-small leading-relaxed whitespace-pre-wrap break-words ${
              m.role === "user"
                ? "ms-auto bg-ghost-text-primary text-ghost-bg"
                : "me-auto bg-ghost-surface text-ghost-text-primary border border-ghost-border-subtle"
            }`}
          >
            {m.role === "assistant"
              ? sanitizeRefusal(sanitizeBrand(m.content), locale)
              : sanitizeBrand(m.content)}
          </div>
        ))}
        {isStreaming && streamingContent && (
          <div className="me-auto max-w-[85%] rounded-xl px-3 py-2 text-small leading-relaxed whitespace-pre-wrap break-words bg-ghost-surface text-ghost-text-primary border border-ghost-border-subtle">
            {getSafeStreamingDisplay(streamingContent, locale)}
          </div>
        )}
        {isStreaming && !streamingContent && (
          <div className="me-auto inline-flex items-center gap-1.5 text-xs text-ghost-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse" />
            <span>{t("waitingForReply")}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-ghost-text-secondary px-2 py-1">{error}</p>
      )}

      <div className="flex items-stretch gap-2 pt-2 border-t border-ghost-border-subtle">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t("investigationChatPlaceholder")}
          disabled={isStreaming}
          className="flex-1 bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-primary/45 disabled:opacity-60"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="px-3 rounded-lg bg-ghost-text-primary text-ghost-bg text-small font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
          aria-label={t("startInvestigation")}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
