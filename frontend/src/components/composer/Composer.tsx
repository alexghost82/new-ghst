import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Video, Plus, Mic, Square, Bell, CalendarClock, X } from "lucide-react";
import { useMessageStore } from "../../stores/messageStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useUserStore } from "../../stores/userStore";
import { useLiveStore } from "../../stores/liveStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useVoiceStore } from "../../stores/voiceStore";
import { useAutomationStore } from "../../stores/automationStore";
import { useExpertStore } from "../../stores/expertStore";
import { useVoiceComposer, normalizeSpeech } from "../../hooks/useVoiceComposer";
import { useT } from "../../utils/i18n";
import { captureMultiFrame } from "../../utils/cameraCapture";
import type { CameraFramePayload, AutomationKind } from "../../types/api";

const MIN_ROWS = 1;
const MAX_ROWS = 6;
const LINE_HEIGHT = 24;

// Verbal consent matcher for Ghost Expert: when Ghost is awaiting permission
// to pull a live frame, an affirmative reply triggers the capture + generate.
const _AFFIRMATIVE_RE =
  /^(?:כן|כֵּן|אישור|אשר|אשרר|בצע|בצעו|קדימה|מאשר|אוקיי|אוקי|בסדר|yes|y|ok|okay|sure|confirm|go|approve|do it|proceed)\b/i;

function isAffirmative(text: string): boolean {
  return _AFFIRMATIVE_RE.test(text.trim());
}

function appendSpeech(existing: string, addition: string): string {
  const add = addition.trim();
  if (!add) return existing;
  if (!existing.trim()) return add;
  return `${existing.replace(/\s+$/, "")} ${add}`;
}

/**
 * If the spoken text ends with the configured send phrase, returns the text
 * with that phrase removed plus matched=true. Comparison is normalized
 * (case/punctuation-insensitive) but the returned remainder keeps original
 * casing so dictated content is preserved verbatim.
 */
function stripTrailingPhrase(
  rawText: string,
  phrase: string,
): { remainder: string; matched: boolean } {
  const normPhrase = normalizeSpeech(phrase);
  if (!normPhrase) return { remainder: rawText, matched: false };
  const phraseWordCount = normPhrase.split(" ").length;
  const rawWords = rawText.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length < phraseWordCount) return { remainder: rawText, matched: false };
  const tail = normalizeSpeech(rawWords.slice(-phraseWordCount).join(" "));
  if (tail !== normPhrase) return { remainder: rawText, matched: false };
  const remainder = rawWords.slice(0, rawWords.length - phraseWordCount).join(" ");
  return { remainder, matched: true };
}

export default function Composer() {
  const [value, setValue] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [listenEnabled, setListenEnabled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const prevHadTextRef = useRef(false);
  // Committed text = whatever the user typed plus finalized speech. Interim
  // speech is rendered live on top of it without mutating the committed base,
  // so each interim event recomputes value = committed + interim instead of
  // appending repeatedly.
  const committedRef = useRef("");
  // Guards against a trailing final result re-triggering after we already
  // fired a send off an interim match.
  const sendingRef = useRef(false);
  const { sendMessage, isStreaming } = useMessageStore();
  const cancelStream = useMessageStore((s) => s.cancelStream);
  const { activeConversationId } = useConversationStore();
  const { activeUserId } = useUserStore();
  const {
    isLive,
    getActiveCameras,
    disableLive,
    enableLive,
    openCameraSelector,
    savedCameras,
  } = useLiveStore();
  const uiDir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);
  const sendPhrase = useVoiceStore((s) => s.sendPhrase);
  const voiceEnabled = useVoiceStore((s) => s.enabled);
  const parseAutomation = useAutomationStore((s) => s.parse);
  const automationParsing = useAutomationStore((s) => s.parsing);
  const automationError = useAutomationStore((s) => s.error);
  const clearAutomationError = useAutomationStore((s) => s.clearError);
  const expertActive = useExpertStore((s) => s.active);
  const expertPhase = useExpertStore((s) => s.phase);
  const t = useT();

  // Conversational automation builder ("+") state.
  const [automationKind, setAutomationKind] = useState<AutomationKind | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Auto-focus the input whenever a conversation is opened/switched so the
  // text caret lands in the box immediately — no mouse click required.
  useEffect(() => {
    if (!activeConversationId || isStreaming) return;
    const el = textareaRef.current;
    if (!el) return;
    // Defer to the next frame so focus wins after the conversation's content
    // (and any disabled→enabled transition on the textarea) has rendered.
    const raf = requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node || node.disabled) return;
      node.focus();
      const end = node.value.length;
      node.setSelectionRange(end, end);
    });
    return () => cancelAnimationFrame(raf);
  }, [activeConversationId, isStreaming]);

  const canSend =
    value.trim().length > 0 &&
    !isStreaming &&
    !capturing &&
    !automationParsing &&
    !!activeConversationId &&
    !!activeUserId;

  // Ghost Expert turn: interrogation answers stream with mode="expert"; an
  // affirmative reply while Ghost awaits consent triggers the frame pull +
  // recommendation generation. Never auto-captures a frame on a chat turn.
  const sendExpert = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (!text || isStreaming || !activeConversationId || !activeUserId) {
        return;
      }
      setValue("");
      committedRef.current = "";
      const store = useExpertStore.getState();
      if (store.phase === "awaiting-consent" && isAffirmative(text)) {
        void store.confirmAndGenerate();
        return;
      }
      sendMessage(
        activeConversationId,
        activeUserId,
        text,
        undefined,
        undefined,
        "expert",
      );
    },
    [isStreaming, activeConversationId, activeUserId, sendMessage],
  );

  const sendCore = useCallback(
    async (rawText: string) => {
      if (useExpertStore.getState().active) {
        sendExpert(rawText);
        return;
      }
      const text = rawText.trim();
      if (
        !text ||
        isStreaming ||
        capturing ||
        !activeConversationId ||
        !activeUserId
      ) {
        return;
      }
      setValue("");
      committedRef.current = "";

      let imageBase64: string | undefined;
      let cameraFrames: CameraFramePayload[] | undefined;

      if (activeConversationId && isLive(activeConversationId)) {
        const cameras = getActiveCameras(activeConversationId);
        if (cameras.length === 1) {
          try {
            setCapturing(true);
            imageBase64 = await captureMultiFrame(cameras[0].device_id);
          } catch {
            // If capture fails, send without image
          } finally {
            setCapturing(false);
          }
        } else if (cameras.length > 1) {
          setCapturing(true);
          const frames: CameraFramePayload[] = [];
          for (const cam of cameras) {
            try {
              const b64 = await captureMultiFrame(cam.device_id);
              frames.push({
                device_id: cam.device_id,
                label: cam.label,
                image_base64: b64,
              });
            } catch {
              // Skip cameras that fail to capture; keep going.
            }
          }
          setCapturing(false);
          if (frames.length > 0) cameraFrames = frames;
        }
      }

      sendMessage(
        activeConversationId,
        activeUserId,
        text,
        imageBase64,
        cameraFrames,
      );
    },
    [
      isStreaming,
      capturing,
      activeConversationId,
      activeUserId,
      isLive,
      getActiveCameras,
      sendMessage,
      sendExpert,
    ],
  );

  const exitAutomation = useCallback(() => {
    setAutomationKind(null);
    setMenuOpen(false);
    clearAutomationError();
  }, [clearAutomationError]);

  const selectAutomationKind = useCallback((kind: AutomationKind) => {
    setAutomationKind(kind);
    setMenuOpen(false);
    setValue("");
    committedRef.current = "";
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleAutomationSend = useCallback(async () => {
    const text = value.trim();
    if (
      !text ||
      !automationKind ||
      !activeConversationId ||
      !activeUserId ||
      isStreaming ||
      automationParsing
    ) {
      return;
    }
    const kind = automationKind;
    setValue("");
    committedRef.current = "";
    setAutomationKind(null);
    let ok = false;
    try {
      const draft = await parseAutomation(
        activeConversationId,
        activeUserId,
        kind,
        text,
        locale,
      );
      ok = !!draft;
    } catch {
      // Surfaced below via the restored composer + automation error.
    }
    if (!ok) {
      // Parse failed — never silently lose the operator's request: restore
      // the text and the defining mode so the surfaced error makes sense.
      setAutomationKind(kind);
      setValue(text);
      committedRef.current = text;
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [
    value,
    automationKind,
    activeConversationId,
    activeUserId,
    isStreaming,
    automationParsing,
    parseAutomation,
    locale,
  ]);

  const handleSend = () => {
    if (automationKind) {
      void handleAutomationSend();
      return;
    }
    void sendCore(value);
  };

  // --- Voice input (Web Speech API) ---------------------------------------
  // Fire the message the instant the send phrase is heard. Returns true when
  // a send was triggered so callers can stop processing the rest of the chunk.
  const trySendOnPhrase = useCallback(
    (combined: string): boolean => {
      const { remainder, matched } = stripTrailingPhrase(combined, sendPhrase);
      if (!matched) return false;
      const toSend = remainder.trim();
      if (!toSend) {
        // Phrase spoken with nothing to send yet — just drop the phrase
        // from the live preview and keep listening.
        setValue(committedRef.current);
        return true;
      }
      sendingRef.current = true;
      committedRef.current = "";
      setValue(toSend);
      void sendCore(toSend);
      return true;
    },
    [sendPhrase, sendCore],
  );

  // Interim results arrive continuously (no pause needed), so this is the
  // fast path: live-render into the box AND detect the send phrase here.
  const handleVoiceInterim = useCallback(
    (text: string) => {
      if (sendingRef.current) return;
      const combined = appendSpeech(committedRef.current, text);
      if (trySendOnPhrase(combined)) return;
      setValue(combined);
    },
    [trySendOnPhrase],
  );

  const handleVoiceFinal = useCallback(
    (text: string) => {
      if (sendingRef.current) return;
      const committed = appendSpeech(committedRef.current, text);
      committedRef.current = committed;
      if (trySendOnPhrase(committed)) return;
      setValue(committed);
    },
    [trySendOnPhrase],
  );

  const { isSupported: voiceSupported, isListening, start, stop } =
    useVoiceComposer({
      onFinal: handleVoiceFinal,
      onInterim: handleVoiceInterim,
    });

  // Auto-enable listening the moment text appears in the box, and disable it
  // once the box empties (after sending/clearing). The mic button can still
  // override this in between.
  useEffect(() => {
    const hasText = value.trim().length > 0;
    if (hasText && !prevHadTextRef.current) setListenEnabled(true);
    else if (!hasText && prevHadTextRef.current) setListenEnabled(false);
    prevHadTextRef.current = hasText;
  }, [value]);

  const shouldListen =
    voiceEnabled &&
    listenEnabled &&
    voiceSupported &&
    !isStreaming &&
    !automationKind &&
    !menuOpen &&
    !!activeConversationId;

  useEffect(() => {
    if (shouldListen) {
      // Sync the committed base with whatever is in the box (typed text) and
      // arm a fresh session.
      committedRef.current = valueRef.current;
      sendingRef.current = false;
      start();
    } else {
      stop();
    }
  }, [shouldListen, start, stop]);

  // Leaving / switching the conversation drops any in-progress Expert session
  // so its overlay and composer mode can't bleed into another conversation.
  useEffect(() => {
    return () => {
      if (useExpertStore.getState().active) {
        useExpertStore.getState().deactivate();
      }
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const handleMicToggle = () => {
    if (!voiceEnabled || !voiceSupported || !activeConversationId || isStreaming)
      return;
    setListenEnabled((v) => !v);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (menuOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setMenuIndex((i) => (i === 0 ? 1 : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectAutomationKind(menuIndex === 0 ? "alert" : "task");
        return;
      }
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        setMenuOpen(false);
        setValue("");
        committedRef.current = "";
        return;
      }
      return;
    }
    if (e.key === "Escape" && automationKind) {
      e.preventDefault();
      exitAutomation();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (automationError) clearAutomationError();
    // Typing "+" into an empty composer (outside automation mode) opens the
    // alert/task picker instead of inserting the character.
    if (!automationKind && !menuOpen && value === "" && next === "+") {
      setMenuOpen(true);
      setMenuIndex(0);
      return;
    }
    // Typing the word "expert" into an empty composer engages Ghost Expert mode
    // (the dramatic smoked-glass overlay) instead of sending it as a message.
    if (
      !automationKind &&
      !menuOpen &&
      !expertActive &&
      !!activeConversationId &&
      next.trim().toLowerCase() === "expert"
    ) {
      setValue("");
      committedRef.current = "";
      useExpertStore.getState().activate();
      return;
    }
    committedRef.current = next;
    setValue(next);
  };

  const liveEnabled = activeConversationId
    ? isLive(activeConversationId)
    : false;
  const activeCams = activeConversationId
    ? getActiveCameras(activeConversationId)
    : [];
  const persistedCams = activeConversationId
    ? (savedCameras[activeConversationId] ?? [])
    : [];

  const handleLiveToggle = () => {
    if (!activeConversationId || isStreaming) return;
    if (liveEnabled) {
      disableLive(activeConversationId);
      return;
    }
    if (persistedCams.length > 0) {
      enableLive(
        activeConversationId,
        persistedCams.map((c) => ({ device_id: c.device_id, label: c.label })),
      );
    } else {
      openCameraSelector();
    }
  };

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2">
      <div className="max-w-chat mx-auto relative" ref={containerRef}>
        {menuOpen && (
          <div
            className="absolute bottom-full mb-2 z-30 w-72 rounded-2xl border border-ghost-border-subtle bg-ghost-bg/95 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.18)] overflow-hidden"
            style={uiDir === "rtl" ? { right: 0 } : { left: 0 }}
            dir={uiDir}
          >
            {(["alert", "task"] as AutomationKind[]).map((kind, i) => {
              const active = menuIndex === i;
              const Icon = kind === "alert" ? Bell : CalendarClock;
              return (
                <button
                  key={kind}
                  type="button"
                  onMouseEnter={() => setMenuIndex(i)}
                  onClick={() => selectAutomationKind(kind)}
                  className={`w-full flex items-start gap-3 px-3.5 py-3 text-start transition-colors duration-[100ms] ${
                    active ? "bg-ghost-surface-hover" : "hover:bg-ghost-surface-hover"
                  }`}
                >
                  <span className="mt-0.5 flex-shrink-0 text-ghost-text-secondary">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ghost-text-primary">
                      {kind === "alert"
                        ? t("automationMenuAlert")
                        : t("automationMenuTask")}
                    </span>
                    <span className="block text-[11px] text-ghost-text-muted truncate">
                      {kind === "alert"
                        ? t("automationMenuAlertHint")
                        : t("automationMenuTaskHint")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {automationKind && (
          <div className="flex items-center gap-2 mb-2 px-1 flex-wrap" dir={uiDir}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  automationParsing
                    ? "bg-ghost-text-primary animate-pulse"
                    : "bg-ghost-text-secondary"
                }`}
              />
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-secondary">
                {automationParsing
                  ? t("automationParsingKicker")
                  : automationKind === "alert"
                    ? t("automationModeAlertKicker")
                    : t("automationModeTaskKicker")}
              </span>
            </span>
            {!automationParsing && (
              <button
                type="button"
                onClick={exitAutomation}
                aria-label={t("automationModeExit")}
                title={t("automationModeExit")}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
        {expertActive && (
          <div className="flex items-center gap-2 mb-2 px-1 flex-wrap" dir={uiDir}>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ghost-text-primary animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-secondary">
                {t("expertComposerKicker")}
              </span>
            </span>
            <button
              type="button"
              onClick={() => useExpertStore.getState().deactivate()}
              aria-label={t("expertComposerExit")}
              title={t("expertComposerExit")}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            >
              <X size={12} />
            </button>
          </div>
        )}
        {automationError && (
          <div
            className="flex items-center gap-1.5 mb-2 px-1"
            dir={uiDir}
            role="alert"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-ghost-error flex-shrink-0" />
            <span className="text-[12px] text-ghost-error">
              {automationError}
            </span>
          </div>
        )}
        {liveEnabled && (
          <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ghost-text-primary animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-secondary">
                {activeCams.length > 1
                  ? t("liveCamerasActive").replace(
                      "{count}",
                      String(activeCams.length),
                    )
                  : t("liveCameraActive")}
              </span>
            </span>
            {activeCams.map((cam) => (
              <span
                key={cam.device_id}
                className="inline-flex items-center gap-1 text-[12px] text-ghost-text-secondary bg-ghost-surface border border-ghost-border-subtle rounded-full px-2.5 py-0.5 max-w-[140px] truncate"
                title={cam.label}
              >
                <Video size={11} />
                <span className="truncate">{cam.label}</span>
              </span>
            ))}
          </div>
        )}
        {isListening && (
          <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ghost-error animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-secondary">
                {t("composerListening")}
              </span>
            </span>
            <span className="text-xs text-ghost-text-muted">
              {t("composerVoiceSendHint").replace("{phrase}", sendPhrase)}
            </span>
          </div>
        )}
        <div
          data-tour="composer-bar"
          className={`
            flex items-center gap-2 rounded-full
            bg-ghost-bg/80 backdrop-blur-md border border-ghost-border-subtle
            px-2.5 py-2.5
            shadow-[0_1px_3px_rgba(0,0,0,0.06)]
            transition-shadow duration-[160ms]
            focus-within:shadow-[0_2px_10px_rgba(0,0,0,0.08)]
            ${liveEnabled ? "ring-1 ring-ghost-text-secondary/40" : ""}
            ${automationKind || automationParsing ? "ghost-automation-active" : ""}
            ${isStreaming ? "opacity-70" : ""}
          `}
        >
          <button
            data-tour="composer-live"
            type="button"
            onClick={handleLiveToggle}
            disabled={isStreaming || !activeConversationId}
            className={`
              flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              transition-colors duration-[100ms]
              ${
                liveEnabled
                  ? "text-ghost-text-primary bg-ghost-surface-hover ring-1 ring-ghost-text-secondary/30 hover:bg-ghost-surface-hover"
                  : "text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover"
              }
              ${isStreaming || !activeConversationId ? "opacity-60 cursor-not-allowed" : ""}
            `}
            aria-label={t("composerLiveToggle")}
            title={liveEnabled ? t("composerLiveOn") : t("composerLiveOff")}
          >
            {liveEnabled ? <Video size={18} /> : <Plus size={20} strokeWidth={2} />}
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? t("waitingForReply")
                : expertActive
                  ? expertPhase === "awaiting-consent"
                    ? t("expertConsentHint")
                    : t("expertComposerPlaceholder")
                  : automationParsing
                    ? t("automationParsingKicker")
                    : automationKind === "alert"
                      ? t("automationAlertPlaceholder")
                      : automationKind === "task"
                        ? t("automationTaskPlaceholder")
                        : t("sendPlaceholder")
            }
            disabled={isStreaming || !activeConversationId || automationParsing}
            rows={MIN_ROWS}
            dir={uiDir}
            className="
              flex-1 bg-transparent text-[16px] text-ghost-text-primary
              placeholder:text-ghost-text-muted resize-none
              focus:outline-none disabled:cursor-not-allowed
              text-start self-center py-0
            "
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          />

          <div className="flex-shrink-0 flex items-center gap-1">
            {voiceEnabled && (
              <button
                data-tour="composer-mic"
                type="button"
                tabIndex={-1}
                onClick={handleMicToggle}
                disabled={!voiceSupported || !activeConversationId || isStreaming}
                className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                transition-colors duration-[100ms]
                ${
                  isListening
                    ? "text-ghost-error bg-ghost-surface-hover ring-1 ring-ghost-error/40 animate-pulse"
                    : "text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover"
                }
                ${!voiceSupported || !activeConversationId || isStreaming ? "opacity-50 cursor-not-allowed" : ""}
              `}
                aria-label={
                  !voiceSupported
                    ? t("composerMicUnsupported")
                    : isListening
                      ? t("composerMicStop")
                      : t("composerMicStart")
                }
                title={
                  !voiceSupported
                    ? t("composerMicUnsupported")
                    : isListening
                      ? t("composerMicStop")
                      : t("composerMicStart")
                }
              >
                <Mic size={18} />
              </button>
            )}
            {isStreaming ? (
              <button
                type="button"
                onClick={cancelStream}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-[100ms] bg-ghost-surface-hover text-ghost-text-primary ring-1 ring-ghost-border-subtle hover:bg-ghost-surface"
                aria-label={t("composerStop")}
                title={t("composerStop")}
              >
                <Square size={14} className="fill-current" />
              </button>
            ) : (
              <button
                data-tour="composer-send"
                onClick={handleSend}
                disabled={!canSend}
                className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                transition-colors duration-[100ms]
                bg-ghost-accent text-ghost-bg
                ${
                  canSend
                    ? "hover:bg-ghost-accent-hover"
                    : "opacity-90 cursor-not-allowed"
                }
              `}
                aria-label={t("composerSend")}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 text-center font-mono text-[11px] tracking-[0.04em] text-ghost-text-muted">
          {t("composerDisclaimer")}
        </div>
      </div>
    </div>
  );
}
