import { useRef, useEffect, useState, useCallback } from "react";
import {
  ArrowUp,
  ArrowDown,
  MessagesSquare,
  Radio,
  Reply,
  Video,
  X,
} from "lucide-react";
import type { BroadcastMode } from "../../stores/broadcastStore";
import { useBroadcastStore } from "../../stores/broadcastStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useLiveStore } from "../../stores/liveStore";
import { useUserStore } from "../../stores/userStore";
import { useLanguageStore } from "../../stores/languageStore";
import MessageBubble from "./MessageBubble";
import ErrorBanner from "../shared/ErrorBanner";
import type { Message } from "../../types/api";
import { useT } from "../../utils/i18n";

/** Count the conversations in scope that actually have stored history — the
 *  explore-mode targets. A conversation with no messages can't be explored, so
 *  it doesn't count toward readiness. */
function useExploreReadyCount(): number {
  const scopeConversations = useBroadcastStore((s) => s.scopeConversations);
  const conversations = useConversationStore((s) => s.conversations);
  return scopeConversations.reduce((acc, c) => {
    const conv = conversations.find((x) => x.id === c.id);
    return acc + ((conv?.message_count ?? 0) > 0 ? 1 : 0);
  }, 0);
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 24;

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
    if (m.role === "user") return m.image_path ?? null;
    if (m.role === "assistant") return null;
  }
  return null;
}

export default function BroadcastChatArea() {
  const {
    activeScope,
    mode,
    setMode,
    cameras,
    loadingCameras,
    messages,
    isStreaming,
    streamingContent,
    streamingSourceImage,
    streamingCameraLabel,
    error,
    close,
    dismissError,
  } = useBroadcastStore();
  const exploreReadyCount = useExploreReadyCount();
  const t = useT();

  if (!activeScope) return null;

  const scopeTypeLabel =
    activeScope.type === "area" ? t("broadcastAreaScope") : t("broadcastGroupScope");

  return (
    <main className="flex-1 flex flex-col bg-ghost-bg min-w-0">
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle flex-shrink-0">
        <button
          type="button"
          onClick={close}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms] flex-shrink-0"
          aria-label={t("broadcastClose")}
          title={t("broadcastClose")}
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-ghost-surface flex items-center justify-center text-ghost-text-primary">
            <Radio size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[14px] font-semibold text-ghost-text-primary truncate">
                {activeScope.name}
              </span>
              <span className="flex-shrink-0 text-[11px] font-medium text-ghost-text-muted px-1.5 py-0.5 rounded-full border border-ghost-border-subtle">
                {scopeTypeLabel}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[12px] text-ghost-text-muted">
              {mode === "search" ? (
                <>
                  <Video size={11} aria-hidden="true" />
                  <span>
                    {loadingCameras
                      ? t("loading")
                      : t("broadcastCamerasCount").replace(
                          "{count}",
                          String(cameras.length),
                        )}
                  </span>
                </>
              ) : (
                <>
                  <MessagesSquare size={11} aria-hidden="true" />
                  <span>
                    {t("broadcastExploreCount").replace(
                      "{count}",
                      String(exploreReadyCount),
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <BroadcastModeToggle
          mode={mode}
          onChange={setMode}
          disabled={isStreaming}
        />
      </header>

      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

      <BroadcastMessageList
        messages={messages}
        mode={mode}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingSourceImage={streamingSourceImage}
        streamingCameraLabel={streamingCameraLabel}
        scopeName={activeScope.name}
        cameraCount={cameras.length}
        exploreReadyCount={exploreReadyCount}
        loadingCameras={loadingCameras}
      />

      <BroadcastComposer />
    </main>
  );
}

interface BroadcastModeToggleProps {
  mode: BroadcastMode;
  onChange: (mode: BroadcastMode) => void;
  disabled: boolean;
}

/** Segmented system control — two functional pills (חפש עכשיו / חקור). Pure
 *  Ghost tokens, subtle border, rounded-full, no decorative color: the active
 *  pill uses the monochrome accent inversion (`bg-ghost-accent text-ghost-bg`). */
function BroadcastModeToggle({ mode, onChange, disabled }: BroadcastModeToggleProps) {
  const t = useT();
  const modes: { id: BroadcastMode; label: string }[] = [
    { id: "search", label: t("broadcastModeSearch") },
    { id: "explore", label: t("broadcastModeExplore") },
  ];
  return (
    <div
      role="tablist"
      aria-label={t("broadcastModeSearch") + " / " + t("broadcastModeExplore")}
      className="flex-shrink-0 flex items-center gap-0.5 rounded-full border border-ghost-border-subtle bg-ghost-surface/40 p-0.5"
    >
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            disabled={disabled}
            className={`
              px-3 py-1 rounded-full text-[12px] font-medium
              transition-colors duration-[120ms]
              disabled:cursor-not-allowed disabled:opacity-60
              ${
                active
                  ? "bg-ghost-accent text-ghost-bg"
                  : "text-ghost-text-secondary hover:text-ghost-text-primary"
              }
            `}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

interface BroadcastMessageListProps {
  messages: Message[];
  mode: BroadcastMode;
  isStreaming: boolean;
  streamingContent: string;
  streamingSourceImage: string | null;
  streamingCameraLabel: string | null;
  scopeName: string;
  cameraCount: number;
  exploreReadyCount: number;
  loadingCameras: boolean;
}

function BroadcastMessageList({
  messages,
  mode,
  isStreaming,
  streamingContent,
  streamingSourceImage,
  streamingCameraLabel,
  scopeName,
  cameraCount,
  exploreReadyCount,
  loadingCameras,
}: BroadcastMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const targetByMessageId = useBroadcastStore((s) => s.targetByMessageId);
  const setTarget = useBroadcastStore((s) => s.setTarget);
  const t = useT();

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 120;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setShowJumpButton(!atBottom);
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, autoScroll]);

  const jumpToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
    setShowJumpButton(false);
  };

  const streamingPlaceholder: Message | null = isStreaming
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

  const noCameras = !loadingCameras && cameraCount === 0;
  const noHistory = exploreReadyCount === 0;

  let emptyTitle: string;
  let emptyHint: string;
  if (mode === "explore") {
    emptyTitle = noHistory
      ? t("broadcastExploreNoHistoryTitle")
      : t("broadcastExploreIntroTitle").replace("{name}", scopeName);
    emptyHint = noHistory
      ? t("broadcastExploreNoHistoryHint")
      : t("broadcastExploreIntroHint").replace(
          "{count}",
          String(exploreReadyCount),
        );
  } else {
    emptyTitle = noCameras
      ? t("broadcastNoCamerasTitle")
      : t("broadcastIntroTitle").replace("{name}", scopeName);
    emptyHint = noCameras
      ? t("broadcastNoCamerasHint")
      : t("broadcastIntroHint").replace("{count}", String(cameraCount));
  }

  return (
    <div
      ref={containerRef}
      onScroll={checkScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="max-w-chat mx-auto">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <div className="w-14 h-14 rounded-xl bg-ghost-surface flex items-center justify-center mb-4 text-ghost-text-secondary">
              {mode === "explore" ? (
                <MessagesSquare size={26} />
              ) : (
                <Radio size={26} />
              )}
            </div>
            <p className="text-ghost-text-secondary text-body">{emptyTitle}</p>
            <p className="text-ghost-text-muted text-small mt-1 max-w-sm">
              {emptyHint}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const replyTarget =
                msg.role === "assistant" ? targetByMessageId[msg.id] : undefined;
              return (
                <div key={msg.id} className="group/bcmsg">
                  <MessageBubble
                    message={msg}
                    sourceImageUrl={
                      msg.role === "assistant"
                        ? findSourceImage(messages, idx)
                        : null
                    }
                    cameraLabel={msg.camera_label ?? null}
                  />
                  {replyTarget && (
                    <div className="flex justify-start ps-11 -mt-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setTarget(replyTarget)}
                        className="
                          inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                          border border-ghost-border-subtle bg-ghost-surface/40
                          text-[11px] text-ghost-text-muted
                          hover:text-ghost-text-primary hover:bg-ghost-surface-hover
                          opacity-0 group-hover/bcmsg:opacity-100 focus:opacity-100
                          transition-[opacity,color,background-color] duration-[120ms]
                        "
                        aria-label={t("broadcastReply")}
                        title={t("broadcastReply")}
                      >
                        <Reply size={11} aria-hidden="true" />
                        <span>{t("broadcastReply")}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
            bg-ghost-surface border border-ghost-border-subtle
            text-ghost-text-secondary hover:text-ghost-text-primary
            rounded-full px-3 py-1.5 text-small
            flex items-center gap-1.5
            shadow-md hover:bg-ghost-surface-hover
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

function BroadcastComposer() {
  const [value, setValue] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pickerDismissed, setPickerDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    mode,
    cameras,
    scopeConversations,
    isStreaming,
    sendBroadcast,
    pendingTarget,
    setTarget,
    clearTarget,
    focusComposerNonce,
  } = useBroadcastStore();
  const exploreReadyCount = useExploreReadyCount();
  const conversations = useConversationStore((s) => s.conversations);
  const savedCameras = useLiveStore((s) => s.savedCameras);
  const { activeUserId } = useUserStore();
  const uiDir = useLanguageStore((s) => s.dir);
  const t = useT();

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lines = Math.min(
      MAX_ROWS,
      Math.max(MIN_ROWS, Math.ceil(el.scrollHeight / LINE_HEIGHT)),
    );
    el.style.height = `${lines * LINE_HEIGHT}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Re-focus the textarea when a target is set from outside (reply button).
  useEffect(() => {
    if (focusComposerNonce > 0) textareaRef.current?.focus();
  }, [focusComposerNonce]);

  // Whether a single conversation can be questioned in the active mode.
  const isConvReady = useCallback(
    (id: string) =>
      mode === "explore"
        ? (conversations.find((c) => c.id === id)?.message_count ?? 0) > 0
        : (savedCameras[id]?.length ?? 0) > 0,
    [mode, conversations, savedCameras],
  );

  const scopeReady =
    mode === "explore" ? exploreReadyCount > 0 : cameras.length > 0;

  // A directed target (chip) is always pre-validated as ready; otherwise the
  // whole scope must have at least one questionable member.
  const ready = pendingTarget
    ? pendingTarget.kind === "camera" || isConvReady(pendingTarget.id)
    : scopeReady;
  const blocked = !ready;

  // "/" at the very start of an empty-target input opens the conversation
  // picker; the text after "/" filters by title.
  const startTrimmed = value.replace(/^\s+/, "");
  const slashActive = !pendingTarget && startTrimmed.startsWith("/");
  const slashQuery = slashActive ? startTrimmed.slice(1).toLowerCase() : "";
  const matches = slashActive
    ? scopeConversations.filter((c) =>
        c.title.toLowerCase().includes(slashQuery),
      )
    : [];
  const showPicker = slashActive && !pickerDismissed;

  useEffect(() => {
    setHighlight(0);
  }, [slashQuery, showPicker]);

  const selectConversation = (conv: { id: string; title: string }) => {
    if (!isConvReady(conv.id)) return;
    setTarget({ kind: "conversation", id: conv.id, title: conv.title });
    setValue("");
    setPickerDismissed(false);
    textareaRef.current?.focus();
  };

  const canSend =
    value.trim().length > 0 && !isStreaming && ready && !!activeUserId;

  const handleSend = () => {
    if (!canSend) return;
    const text = value.trim();
    setValue("");
    sendBroadcast(activeUserId!, text, pendingTarget);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showPicker) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = matches[highlight];
        if (sel && isConvReady(sel.id)) selectConversation(sel);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPickerDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const targetLabel = pendingTarget
    ? pendingTarget.kind === "conversation"
      ? pendingTarget.title
      : pendingTarget.label
    : "";

  let placeholder: string;
  if (blocked) {
    placeholder = pendingTarget
      ? mode === "explore"
        ? t("broadcastTargetNotReadyExplore")
        : t("broadcastTargetNotReadySearch")
      : mode === "explore"
        ? t("broadcastExploreNoHistoryTitle")
        : t("broadcastNoCamerasPlaceholder");
  } else if (isStreaming) {
    placeholder = t("waitingForReply");
  } else {
    placeholder =
      mode === "explore"
        ? t("broadcastExplorePlaceholder")
        : t("broadcastPlaceholder");
  }

  const footer =
    !pendingTarget && !isStreaming && ready && value.trim().length === 0
      ? t("broadcastSlashHint")
      : mode === "explore"
        ? t("broadcastExploreDisclaimer")
        : t("broadcastDisclaimer");

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2">
      <div className="max-w-chat mx-auto relative">
        {showPicker && (
          <div
            className="
              absolute bottom-full inset-x-0 mb-2 z-20
              rounded-xl border border-ghost-border-subtle bg-ghost-surface
              shadow-lg overflow-hidden
            "
            dir={uiDir}
          >
            <div className="px-3 py-2 border-b border-ghost-border-subtle text-[11px] font-medium text-ghost-text-muted">
              {t("broadcastPickConversation")}
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {matches.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-ghost-text-muted">
                  {t("broadcastNoMatches")}
                </div>
              ) : (
                matches.map((c, i) => {
                  const convReady = isConvReady(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!convReady}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectConversation(c)}
                      className={`
                        w-full text-start px-3 py-2 flex items-center gap-2 text-[14px]
                        transition-colors duration-[100ms]
                        ${i === highlight && convReady ? "bg-ghost-surface-hover" : ""}
                        ${
                          convReady
                            ? "text-ghost-text-primary"
                            : "text-ghost-text-muted cursor-not-allowed"
                        }
                      `}
                    >
                      {mode === "explore" ? (
                        <MessagesSquare size={13} className="flex-shrink-0" />
                      ) : (
                        <Video size={13} className="flex-shrink-0" />
                      )}
                      <span className="truncate flex-1">
                        {c.title.trim() || "—"}
                      </span>
                      {!convReady && (
                        <span className="text-[11px] text-ghost-text-muted flex-shrink-0">
                          {mode === "explore"
                            ? t("broadcastTargetNotReadyExplore")
                            : t("broadcastTargetNotReadySearch")}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {pendingTarget && (
          <div className="flex items-center mb-2">
            <span className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full border border-ghost-border-subtle bg-ghost-surface/60 text-[12px] text-ghost-text-secondary">
              <span className="text-[11px] text-ghost-text-muted flex-shrink-0">
                {t("broadcastDirectedTo")}
              </span>
              <span className="truncate">{targetLabel.trim() || "—"}</span>
              <button
                type="button"
                onClick={clearTarget}
                aria-label={t("broadcastClearTarget")}
                title={t("broadcastClearTarget")}
                className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-ghost-text-muted hover:text-ghost-text-primary transition-colors duration-[100ms]"
              >
                <X size={11} />
              </button>
            </span>
          </div>
        )}

        <div
          className={`
            flex items-end gap-2 rounded-3xl
            bg-ghost-surface px-4 py-3
            transition-shadow duration-[160ms]
            ${isStreaming ? "opacity-70" : ""}
          `}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setPickerDismissed(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isStreaming || blocked}
            rows={MIN_ROWS}
            dir={uiDir}
            className="
              flex-1 bg-transparent text-[16px] text-ghost-text-primary
              placeholder:text-ghost-text-muted resize-none
              focus:outline-none disabled:cursor-not-allowed
              text-start
            "
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`
              flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              transition-colors duration-[100ms]
              ${
                canSend
                  ? "bg-ghost-accent hover:bg-ghost-accent-hover text-ghost-bg"
                  : "bg-ghost-surface-hover text-ghost-text-muted cursor-not-allowed"
              }
            `}
            aria-label={t("broadcastSend")}
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <div className="mt-2 text-center text-[12px] text-ghost-text-muted">
          {footer}
        </div>
      </div>
    </div>
  );
}
