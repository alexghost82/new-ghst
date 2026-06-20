import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguageStore } from "../stores/languageStore";

// The Web Speech API is not part of the standard TS DOM lib across all
// versions, so we declare the minimal surface we rely on here.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Normalizes recognized speech for comparison/command matching: lowercase,
 * strips punctuation, collapses whitespace. Hebrew letters are preserved.
 */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{Letter}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface VoiceHandlers {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseVoiceComposerResult {
  isSupported: boolean;
  isListening: boolean;
  start: () => void;
  stop: () => void;
}

export function useVoiceComposer(handlers: VoiceHandlers): UseVoiceComposerResult {
  const locale = useLanguageStore((s) => s.locale);
  const [isSupported] = useState(() => getRecognitionCtor() !== null);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Tracks the desired listening state so onend can decide whether to restart
  // (continuous recognition still terminates after silence on some engines).
  const shouldListenRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const lang = locale === "he" ? "he-IL" : "en-US";
  const langRef = useRef(lang);
  langRef.current = lang;

  const ensureRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalText = transcript.trim();
          if (finalText) handlersRef.current.onFinal?.(finalText);
        } else {
          interim += transcript;
        }
      }
      if (interim.trim()) handlersRef.current.onInterim?.(interim.trim());
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are transient — let onend handle restart.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldListenRef.current = false;
        setIsListening(false);
      }
      handlersRef.current.onError?.(event.error);
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Engine stopped on its own (silence/timeout) but we still want to
        // listen — restart it.
        try {
          recognition.lang = langRef.current;
          recognition.start();
          return;
        } catch {
          // Already starting or transient — fall through to idle state.
        }
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const start = useCallback(() => {
    const recognition = ensureRecognition();
    if (!recognition) return;
    shouldListenRef.current = true;
    recognition.lang = langRef.current;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // start() throws if already running — that's fine, we're listening.
      setIsListening(true);
    }
  }, [ensureRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Not running — ignore.
    }
  }, []);

  // Keep the recognition language in sync with the UI locale.
  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = lang;
  }, [lang]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { isSupported, isListening, start, stop };
}
