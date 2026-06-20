import { useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  Check,
  ArrowRight,
  CalendarClock,
  Clock,
  Search,
  FileText,
  Volume2,
  VolumeX,
  Video,
} from "lucide-react";
import { useAlertStore } from "../../stores/alertStore";
import { useUserStore } from "../../stores/userStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useConversationActivityStore } from "../../stores/conversationActivityStore";
import { useMessageStore } from "../../stores/messageStore";
import { useT } from "../../utils/i18n";

/* ------------------------------------------------------------------------
 * Two-tone emergency siren.
 *
 * The previous alarm was a single 880Hz beep — clearly audible but easy to
 * tune out. We now alternate between a higher (~960Hz) and lower (~620Hz)
 * sine+square mix on every beep, which the auditory cortex registers as an
 * "emergency response" pattern (think police / ambulance). Each beep is
 * shorter (160ms) with a tight 80ms gap so the alarm feels urgent rather
 * than nagging.
 * ----------------------------------------------------------------------*/
const HIGH_TONE_HZ = 960;
const LOW_TONE_HZ = 620;
const BEEP_MS = 180;
const GAP_MS = 90;
const GAIN_PEAK = 0.22;

function useAlarmSound(active: boolean, muted: boolean): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active || muted) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    let cancelled = false;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isHigh = true;

    const playBeep = () => {
      if (cancelled) return;
      const freq = isHigh ? HIGH_TONE_HZ : LOW_TONE_HZ;
      isHigh = !isHigh;

      // Layer a sine + square so the tone has both warmth and bite.
      const sine = ctx.createOscillator();
      sine.type = "sine";
      sine.frequency.value = freq;

      const square = ctx.createOscillator();
      square.type = "square";
      square.frequency.value = freq;

      const squareGain = ctx.createGain();
      squareGain.gain.value = 0.35;
      square.connect(squareGain);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(
        GAIN_PEAK,
        ctx.currentTime + 0.012,
      );
      master.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + BEEP_MS / 1000,
      );

      sine.connect(master);
      squareGain.connect(master);
      master.connect(ctx.destination);

      sine.start();
      square.start();
      const stopAt = ctx.currentTime + BEEP_MS / 1000 + 0.04;
      sine.stop(stopAt);
      square.stop(stopAt);

      timeoutId = setTimeout(() => {
        if (!cancelled) playBeep();
      }, BEEP_MS + GAP_MS);
    };

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
        // ignore: autoplay policy may block; alarm just stays silent
      });
    }
    playBeep();

    stopRef.current = () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      ctx.close().catch(() => {
        // ignore: may already be closed
      });
    };

    return () => {
      stopRef.current?.();
      stopRef.current = null;
      ctxRef.current = null;
    };
  }, [active, muted]);
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function AlertOverlay() {
  const event = useAlertStore((s) => s.activeAlert);
  const conversationTitle = useAlertStore(
    (s) => s.activeAlertConversationTitle,
  );
  const acknowledgeAlert = useAlertStore((s) => s.acknowledgeAlert);
  const dismissAlert = useAlertStore((s) => s.dismissAlert);
  const { activeUserId } = useUserStore();
  const { setActive } = useConversationStore();
  const { fetchMessages, clearMessages } = useMessageStore();
  const t = useT();

  const [muted, setMuted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [imgErrored, setImgErrored] = useState(false);

  useAlarmSound(!!event, muted);

  // Reset per-event UI state when a new alert lands.
  useEffect(() => {
    setImgErrored(false);
    setMuted(false);
    setElapsedSec(0);
  }, [event?.id]);

  // Tick the "active for N seconds" counter while the overlay is up.
  useEffect(() => {
    if (!event) return;
    const start = new Date(event.created_at).getTime();
    const tick = () => {
      const now = Date.now();
      const sec = Math.max(0, Math.floor((now - start) / 1000));
      setElapsedSec(sec);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [event]);

  // ESC closes the alert (acknowledge). Keyboard ack is essential for power
  // operators who don't want to mouse over every event.
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        void handleAck();
      }
      if (e.key.toLowerCase() === "m") {
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  if (!event) return null;

  const handleAck = async () => {
    if (!activeUserId) {
      dismissAlert();
      return;
    }
    const convId = event.conversation_id;
    await acknowledgeAlert(activeUserId);
    const activeConvId =
      useConversationStore.getState().activeConversationId;
    if (activeConvId === convId) {
      fetchMessages(convId, activeUserId);
    }
  };

  const handleGoTo = async () => {
    if (!activeUserId) {
      dismissAlert();
      return;
    }
    setActive(event.conversation_id);
    useConversationActivityStore.getState().markRead(event.conversation_id);
    clearMessages();
    fetchMessages(event.conversation_id, activeUserId);
    await acknowledgeAlert(activeUserId);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label={t("alertDetected")}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 ghost-alert-overlay-bg"
    >
      <style>{`
        /* Backdrop pulse — red wash that breathes over the dimmed scene so
           the operator's peripheral vision picks it up even if their gaze is
           elsewhere on screen. */
        .ghost-alert-overlay-bg {
          background:
            radial-gradient(ellipse at center, rgba(200, 60, 50, 0.18) 0%, transparent 60%),
            rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(6px);
          animation:
            ghostOverlayFadeIn 200ms ease-out,
            ghostOverlayStrobe 1.2s ease-in-out infinite 200ms;
        }
        @keyframes ghostOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ghostOverlayStrobe {
          0%, 100% {
            background:
              radial-gradient(ellipse at center, rgba(200, 60, 50, 0.10) 0%, transparent 60%),
              rgba(0, 0, 0, 0.62);
          }
          50% {
            background:
              radial-gradient(ellipse at center, rgba(220, 70, 60, 0.34) 0%, transparent 65%),
              rgba(40, 0, 0, 0.72);
          }
        }

        /* Edge frame — bright red border around the viewport that flashes
           independently of the dialog, so the alarm visual is unmistakable. */
        .ghost-alert-edge-frame {
          position: fixed;
          inset: 0;
          pointer-events: none;
          border: 3px solid rgba(220, 60, 50, 0.0);
          box-shadow: inset 0 0 80px rgba(220, 60, 50, 0.0);
          animation: ghostEdgeStrobe 1s steps(2, jump-none) infinite;
          z-index: 99;
        }
        @keyframes ghostEdgeStrobe {
          0%, 100% {
            border-color: rgba(220, 60, 50, 0.85);
            box-shadow: inset 0 0 80px rgba(220, 60, 50, 0.45);
          }
          50% {
            border-color: rgba(220, 60, 50, 0.15);
            box-shadow: inset 0 0 40px rgba(220, 60, 50, 0.10);
          }
        }

        .ghost-alert-dialog {
          animation:
            ghostDialogReveal 280ms cubic-bezier(0.16, 1, 0.3, 1),
            ghostDialogPulse 1.2s ease-in-out infinite 280ms;
          box-shadow:
            0 0 0 2px rgba(220, 60, 50, 0.55),
            0 0 60px 0 rgba(220, 60, 50, 0.35),
            0 25px 50px -12px rgba(0, 0, 0, 0.6);
        }
        @keyframes ghostDialogReveal {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(14px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes ghostDialogPulse {
          0%, 100% {
            box-shadow:
              0 0 0 2px rgba(220, 60, 50, 0.55),
              0 0 60px 0 rgba(220, 60, 50, 0.35),
              0 25px 50px -12px rgba(0, 0, 0, 0.6);
          }
          50% {
            box-shadow:
              0 0 0 3px rgba(255, 90, 80, 0.85),
              0 0 110px 0 rgba(220, 60, 50, 0.55),
              0 25px 50px -12px rgba(0, 0, 0, 0.7);
          }
        }
        .ghost-alert-dialog::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 90, 80, 0.95),
            rgba(255, 255, 255, 0.6),
            rgba(255, 90, 80, 0.95),
            transparent
          );
          animation: ghostAlertTopBar 0.9s ease-in-out infinite;
        }
        @keyframes ghostAlertTopBar {
          0%, 100% { opacity: 0.5; transform: scaleX(0.9); }
          50% { opacity: 1; transform: scaleX(1); }
        }
        .ghost-alert-icon-ring {
          animation: ghostIconRing 1s ease-in-out infinite;
        }
        @keyframes ghostIconRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 60, 50, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(220, 60, 50, 0); }
        }
        .ghost-alert-title-flash {
          animation: ghostTitleFlash 0.7s ease-in-out infinite alternate;
        }
        @keyframes ghostTitleFlash {
          from { color: rgba(220, 60, 50, 1); text-shadow: 0 0 12px rgba(220, 60, 50, 0.55); }
          to { color: rgba(255, 255, 255, 1); text-shadow: 0 0 4px rgba(220, 60, 50, 0.25); }
        }
        .ghost-alert-frame-wrapper {
          position: relative;
          overflow: hidden;
        }
        .ghost-alert-frame-wrapper::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(ellipse at center, transparent 38%, rgba(0, 0, 0, 0.55) 100%),
            linear-gradient(180deg, transparent 0%, transparent 92%, rgba(220, 60, 50, 0.12) 100%);
          pointer-events: none;
        }
        .ghost-alert-rec-dot {
          animation: ghostRecBlink 0.8s steps(2, jump-none) infinite;
        }
        @keyframes ghostRecBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .ghost-alert-ack-button {
          animation: ghostAckPulse 1.4s ease-in-out infinite;
        }
        @keyframes ghostAckPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 60, 50, 0.55); }
          50% { box-shadow: 0 0 0 8px rgba(220, 60, 50, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ghost-alert-overlay-bg,
          .ghost-alert-edge-frame,
          .ghost-alert-dialog,
          .ghost-alert-dialog::before,
          .ghost-alert-icon-ring,
          .ghost-alert-title-flash,
          .ghost-alert-rec-dot,
          .ghost-alert-ack-button {
            animation: none !important;
          }
        }
      `}</style>

      <div className="ghost-alert-edge-frame" aria-hidden="true" />

      <div
        className="ghost-alert-dialog relative w-full max-w-lg rounded-2xl overflow-hidden bg-ghost-bg-secondary border border-ghost-error/40"
        dir="auto"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="ghost-alert-icon-ring flex-shrink-0 w-11 h-11 rounded-full bg-ghost-error/20 flex items-center justify-center">
            <ShieldAlert size={20} className="text-ghost-error" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="ghost-alert-title-flash text-base font-bold tracking-tight">
              {t("alertDetected")}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="ghost-alert-rec-dot inline-block w-1.5 h-1.5 rounded-full bg-ghost-error"
                aria-hidden="true"
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ghost-error">
                {t("alertCardRec")}
              </span>
              <span className="text-ghost-text-muted text-xs">·</span>
              <span className="text-xs text-ghost-text-muted">
                {t("alertActiveFor")} {formatElapsed(elapsedSec)}
              </span>
            </div>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label={muted ? t("alertUnmuteSound") : t("alertMuteSound")}
            title={muted ? t("alertUnmuteSound") : t("alertMuteSound")}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>

        {/* Meta row — confidence + timestamp + conversation */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ghost-error/15 border border-ghost-error/30 text-[10px] font-bold uppercase tracking-widest text-ghost-error">
            {t("alertConfidenceHigh")}
          </span>
          {event.source === "task" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ghost-surface border border-ghost-border-subtle text-[10px] font-bold uppercase tracking-widest text-ghost-text-secondary">
              <CalendarClock size={10} />
              {t("taskAlertTag")}
            </span>
          )}
          {conversationTitle && (
            <span className="text-xs text-ghost-text-muted truncate min-w-0">
              {conversationTitle}
            </span>
          )}
          <span className="text-ghost-text-muted text-xs ms-auto inline-flex items-center gap-1 flex-shrink-0">
            <Clock size={11} />
            <span className="tabular-nums">
              {formatTimestamp(event.created_at)}
            </span>
          </span>
        </div>

        {/* Frame image */}
        {event.frame_path && !imgErrored && (
          <div className="px-5 pb-1">
            <div className="ghost-alert-frame-wrapper rounded-xl overflow-hidden border border-ghost-error/30">
              <img
                src={event.frame_path}
                alt={event.ai_description || "alert frame"}
                onError={() => setImgErrored(true)}
                className="w-full h-auto block"
                style={{ filter: "grayscale(0.7) contrast(1.12) brightness(0.94)" }}
                draggable={false}
              />
              <div className="absolute top-2 start-2 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/55 backdrop-blur-sm border border-white/10">
                <Video size={9} className="text-white/80" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/90">
                  {t("alertCardCameraTag")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Search size={13} className="text-ghost-error/80 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-ghost-text-muted font-medium mb-0.5">
                {t("alertMatchedRule")}
              </p>
              <p className="text-sm text-ghost-text-primary leading-relaxed font-medium">
                {event.matched_description}
              </p>
            </div>
          </div>

          {event.ai_description &&
            event.ai_description !== event.matched_description && (
              <div className="flex items-start gap-2.5">
                <FileText size={13} className="text-ghost-text-muted flex-shrink-0 mt-1" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-ghost-text-muted font-medium mb-0.5">
                    {t("alertAiDescription")}
                  </p>
                  <p className="text-sm text-ghost-text-secondary leading-relaxed">
                    {event.ai_description}
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-ghost-border-subtle">
          <button
            onClick={handleAck}
            className="ghost-alert-ack-button flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-ghost-error text-white text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all duration-[120ms]"
          >
            <Check size={15} />
            {t("acknowledge")}
          </button>
          <button
            onClick={handleGoTo}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-ghost-surface text-ghost-text-primary text-sm font-semibold border border-ghost-border-subtle hover:bg-ghost-surface-hover active:scale-[0.98] transition-all duration-[120ms]"
          >
            {t("goToConversation")}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
