import { useRef, useEffect, useState, useCallback } from "react";
import type { Message } from "../types/api";
import {
  resolveScrollState,
  shouldPinToBottom,
  pickScrollBehavior,
} from "./chatScrollUtils";

interface UseChatAutoScrollArgs {
  messages: Message[];
  streamingContent: string;
  activeConversationId: string | null;
}

interface UseChatAutoScroll {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  showJumpButton: boolean;
  onScroll: () => void;
  jumpToBottom: () => void;
}

/**
 * Encapsulates the chat message-list auto-scroll behavior. Behavior is
 * intentionally identical to the previous inline implementation in
 * ``MessageList`` — it now delegates the decision logic to the pure,
 * unit-tested helpers in ``chatScrollUtils`` so it can never silently drift.
 *
 *  - tracks whether the view is pinned to the bottom (``autoScroll``);
 *  - shows a "jump to latest" affordance when the operator scrolls up;
 *  - re-arms and glides to the bottom when a brand-new user message arrives or
 *    a different conversation is opened;
 *  - pins instantly while content streams in (and on late height changes via a
 *    ResizeObserver) so the snap never lags behind growing content.
 */
export function useChatAutoScroll({
  messages,
  streamingContent,
  activeConversationId,
}: UseChatAutoScrollArgs): UseChatAutoScroll {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  // Identity of the last message we've seen, used to detect when a brand-new
  // message (e.g. one the user just sent, by typing or by voice) arrives.
  const lastMessageIdRef = useRef<string | null>(null);
  // Tracks the conversation currently rendered so we can snap to the latest
  // message every time a different conversation is opened.
  const prevConversationRef = useRef<string | null>(activeConversationId);
  // Last observed scrollTop, used to tell user up-scrolls apart from our own
  // programmatic bottom-pinning (which only ever increases scrollTop).
  const lastScrollTopRef = useRef(0);
  // Mirror of autoScroll so the ResizeObserver always reads the latest value
  // without needing to re-subscribe on every toggle.
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    const el = containerRef.current;
    if (el) lastScrollTopRef.current = el.scrollTop;
  }, []);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { showJumpButton: nextShow, autoScroll: nextAuto } =
      resolveScrollState(
        autoScrollRef.current,
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        lastScrollTopRef.current,
      );
    lastScrollTopRef.current = el.scrollTop;
    setShowJumpButton(nextShow);
    setAutoScroll(nextAuto);
  }, []);

  // Opening a (different) conversation always re-arms auto-scroll and glides
  // to the most recent message, regardless of where the previous conversation
  // was scrolled to.
  useEffect(() => {
    if (prevConversationRef.current !== activeConversationId) {
      prevConversationRef.current = activeConversationId;
      lastMessageIdRef.current = null;
      setAutoScroll(true);
      setShowJumpButton(false);
    }
  }, [activeConversationId]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ?? null;
    // A freshly appended user message means the user just sent something
    // (typed or via the voice send phrase) — pull the view to the bottom even
    // if they had scrolled up.
    const isNewUserMessage =
      lastMessage?.role === "user" && lastId !== lastMessageIdRef.current;
    lastMessageIdRef.current = lastId;

    if (isNewUserMessage) {
      setAutoScroll(true);
      setShowJumpButton(false);
    }

    if (shouldPinToBottom({ autoScroll, isNewUserMessage })) {
      // A brand-new user message glides smoothly; while content streams in we
      // pin instantly so the snap can never lag behind the growing height and
      // falsely look like the user scrolled away.
      scrollToBottom(pickScrollBehavior({ isNewUserMessage }));
    }
  }, [messages, streamingContent, autoScroll, scrollToBottom]);

  // Height of the rendered content can change outside the message/token render
  // cycle (async markdown, images loading, late token flushes). Whenever it
  // grows while auto-scroll is engaged, snap to the bottom so the view always
  // shows the latest content.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (autoScrollRef.current) {
        scrollToBottom("auto");
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  const jumpToBottom = useCallback(() => {
    scrollToBottom("smooth");
    setAutoScroll(true);
    setShowJumpButton(false);
  }, [scrollToBottom]);

  return {
    containerRef,
    contentRef,
    bottomRef,
    showJumpButton,
    onScroll,
    jumpToBottom,
  };
}
