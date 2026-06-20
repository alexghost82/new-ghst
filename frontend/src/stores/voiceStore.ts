import { create } from "zustand";

export const DEFAULT_SEND_PHRASE = "go ghost";
const STORAGE_KEY = "ghost-voice-send-phrase";
const ENABLED_STORAGE_KEY = "ghost-voice-enabled";

// Hebrew + English letters only, 1-2 words.
const WORD_PATTERN = /^[A-Za-z\u0590-\u05FF]+$/;

/**
 * Validates a candidate voice send phrase: must be 1-2 words, each word
 * containing only Hebrew or English letters. Returns the normalized phrase
 * (collapsed whitespace, trimmed) when valid, or null when invalid.
 */
export function validateSendPhrase(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const words = trimmed.split(" ");
  if (words.length < 1 || words.length > 2) return null;
  if (!words.every((w) => WORD_PATTERN.test(w))) return null;
  return trimmed;
}

function loadStored(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && validateSendPhrase(stored)) return stored;
  } catch {
    // localStorage unavailable — fall back to default
  }
  return DEFAULT_SEND_PHRASE;
}

function loadEnabled(): boolean {
  try {
    const stored = localStorage.getItem(ENABLED_STORAGE_KEY);
    // Default to disabled when no preference has been persisted yet.
    if (stored === null) return false;
    return stored === "true";
  } catch {
    // localStorage unavailable — fall back to disabled
    return false;
  }
}

interface VoiceState {
  enabled: boolean;
  sendPhrase: string;
  setEnabled: (enabled: boolean) => void;
  setSendPhrase: (phrase: string) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  enabled: loadEnabled(),
  sendPhrase: loadStored(),
  setEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
    } catch {
      // Persisting failed — keep the in-memory value anyway
    }
    set({ enabled });
  },
  setSendPhrase: (phrase: string) => {
    const valid = validateSendPhrase(phrase);
    if (!valid) return;
    try {
      localStorage.setItem(STORAGE_KEY, valid);
    } catch {
      // Persisting failed — keep the in-memory value anyway
    }
    set({ sendPhrase: valid });
  },
}));
