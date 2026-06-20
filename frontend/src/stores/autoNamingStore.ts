import { create } from "zustand";

// Auto-naming preferences. The global ``enabled`` flag is the operator's
// default for every conversation; ``overrides`` lets a single conversation opt
// in/out explicitly (missing entry == inherit the global). ``lastNamedCount``
// tracks the message count at which each conversation was last auto-named, so
// the orchestrator can re-summarise "every 4 new messages".
//
// All of this is a browser-local preference (like capture quality) — it never
// touches the server. The server-side ``title_source`` column is the source of
// truth for the "manual rename = never auto-name" lock.

const ENABLED_KEY = "ghost-auto-naming-enabled";
const OVERRIDES_KEY = "ghost-auto-naming-overrides";
const LAST_COUNT_KEY = "ghost-auto-naming-last-count";

function readEnabled(): boolean {
  const raw = localStorage.getItem(ENABLED_KEY);
  // Default ON when unset.
  return raw === null ? true : raw === "true";
}

function readJsonRecord<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeJsonRecord(key: string, value: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / serialization errors — auto-naming is best-effort */
  }
}

interface AutoNamingState {
  enabled: boolean;
  overrides: Record<string, boolean>;
  lastNamedCount: Record<string, number>;

  setEnabled: (enabled: boolean) => void;
  setOverride: (conversationId: string, enabled: boolean | null) => void;
  setLastNamedCount: (conversationId: string, count: number) => void;

  /** Effective on/off for a conversation: explicit override wins, else global. */
  isEffectiveEnabled: (conversationId: string) => boolean;
}

export const useAutoNamingStore = create<AutoNamingState>((set, get) => ({
  enabled: readEnabled(),
  overrides: readJsonRecord<boolean>(OVERRIDES_KEY),
  lastNamedCount: readJsonRecord<number>(LAST_COUNT_KEY),

  setEnabled: (enabled) => {
    localStorage.setItem(ENABLED_KEY, String(enabled));
    set({ enabled });
  },

  setOverride: (conversationId, enabled) => {
    set((s) => {
      const next = { ...s.overrides };
      if (enabled === null) {
        delete next[conversationId];
      } else {
        next[conversationId] = enabled;
      }
      writeJsonRecord(OVERRIDES_KEY, next);
      return { overrides: next };
    });
  },

  setLastNamedCount: (conversationId, count) => {
    set((s) => {
      const next = { ...s.lastNamedCount, [conversationId]: count };
      writeJsonRecord(LAST_COUNT_KEY, next);
      return { lastNamedCount: next };
    });
  },

  isEffectiveEnabled: (conversationId) => {
    const s = get();
    const override = s.overrides[conversationId];
    return override === undefined ? s.enabled : override;
  },
}));
