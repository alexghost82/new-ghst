import { create } from "zustand";
import type { TrialAccount, User } from "../types/api";
import { api, setApiActiveUser } from "../api/client";
import { TRIAL_SESSION_DURATION_MS } from "../config/demoAccess";

// Session persists for 20 minutes from the moment of login (or user creation).
// Survives page refreshes via localStorage; auto-expires server-id only — the
// API key itself is never persisted client-side.
const SESSION_DURATION_MS = 20 * 60 * 1000;
const SESSION_STORAGE_KEY = "ghost.session.v1";

// How a session was established:
//   - "trial":      public 8-minute guided experience; every trial creates a
//                   brand-new account named after the visitor (shared demo
//                   API key), so each visitor starts completely clean.
//   - "demo_admin": the hidden 8+0 chord; picks one of the trial accounts and
//                   enters it with full access (impersonation).
//   - "standard":   a normal nickname + API-key (or magic-link) login.
export type SessionType = "standard" | "trial" | "demo_admin";

// Contact details collected by the trial gate; stamped on the new account.
export interface TrialLead {
  name: string;
  email: string;
  phone: string;
}

interface PersistedSession {
  userId: string;
  user: User;
  expiresAt: number;
  sessionType?: SessionType;
  // True while a fresh trial account still needs the guided first-setup
  // wizard (area -> group -> conversation -> camera) in the app.
  trialSetupPending?: boolean;
}

function loadPersistedSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (
      !parsed ||
      typeof parsed.userId !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !parsed.user ||
      typeof parsed.user.id !== "string"
    ) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return {
      ...(parsed as PersistedSession),
      sessionType: parsed.sessionType ?? "standard",
    };
  } catch {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

function savePersistedSession(session: PersistedSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be unavailable (private mode / quota) — fall back silently
  }
}

function clearPersistedSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const initialSession = loadPersistedSession();
// Restore the API client's active user on boot so a refreshed session keeps
// stamping ownership-guarded mutations correctly.
setApiActiveUser(initialSession?.userId ?? null);

interface UserState {
  users: User[];
  activeUserId: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  sessionType: SessionType;
  trialSetupPending: boolean;

  fetchUsers: () => Promise<void>;
  createUser: (
    nickname: string,
    apiKey: string,
    sessionType?: SessionType,
  ) => Promise<User | null>;
  loginUser: (
    nickname: string,
    apiKey: string,
    sessionType?: SessionType,
  ) => Promise<User | null>;
  // The connected operator updates their OWN Ghost API key from settings.
  // Patches the active account, refreshes the local list and the persisted
  // session user. Returns true on success.
  updateOwnApiKey: (apiKey: string) => Promise<boolean>;
  loginWithMagicToken: (token: string) => Promise<User | null>;
  // Public 8-minute guided trial: creates a brand-new account named after
  // the visitor (shared demo API key) so every trial starts completely
  // clean, then flags the guided first-setup wizard.
  startTrialSession: (lead: TrialLead) => Promise<User | null>;
  // Demo admin (8+0): enter one of the trial accounts with full access.
  loginAsDemoUser: (account: TrialAccount) => void;
  // Enter the shared legacy demo account from a server-authenticated user
  // (the key stays server-side; this only establishes the local session).
  enterDemoAdmin: (user: User) => void;
  // Called by the app once the guided first-setup wizard finishes.
  completeTrialSetup: () => void;
  setActiveUser: (id: string) => void;
  logout: () => void;
  clearExpiredSession: () => void;
}

function sessionDuration(sessionType: SessionType): number {
  return sessionType === "trial" ? TRIAL_SESSION_DURATION_MS : SESSION_DURATION_MS;
}

export const useUserStore = create<UserState>((set, get) => {
  // Centralised session establishment so every entry path (login, create,
  // magic-link, trial) persists and exposes state identically.
  const applySession = (
    user: User,
    sessionType: SessionType,
    trialSetupPending = false,
  ) => {
    const expiresAt = Date.now() + sessionDuration(sessionType);
    savePersistedSession({
      userId: user.id,
      user,
      expiresAt,
      sessionType,
      trialSetupPending,
    });
    // Keep the API client's active user in sync so ownership-guarded
    // mutations carry the correct user_id.
    setApiActiveUser(user.id);
    set({
      activeUserId: user.id,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      expiresAt,
      sessionType,
      trialSetupPending,
    });
  };

  const refreshUsers = async () => {
    const listRes = await api.listUsers();
    if (listRes.ok && listRes.data) {
      set({ users: listRes.data });
    }
  };

  return {
    users: initialSession ? [initialSession.user] : [],
    activeUserId: initialSession?.userId ?? null,
    isLoading: false,
    error: null,
    isAuthenticated: !!initialSession,
    expiresAt: initialSession?.expiresAt ?? null,
    sessionType: initialSession?.sessionType ?? "standard",
    trialSetupPending: initialSession?.trialSetupPending ?? false,

    fetchUsers: async () => {
      set({ isLoading: true, error: null });
      const res = await api.listUsers();
      if (res.ok && res.data) {
        set({ users: res.data, isLoading: false });
      } else {
        set({ isLoading: false, error: res.error?.message ?? "Failed to fetch users" });
      }
    },

    createUser: async (nickname, apiKey, sessionType = "standard") => {
      set({ isLoading: true, error: null });
      const res = await api.createUser(nickname, apiKey);
      if (res.ok && res.data) {
        const user = res.data;
        applySession(user, sessionType);
        set((s) => ({ users: [...s.users, user] }));
        return user;
      }
      set({ isLoading: false, error: res.error?.message ?? "Failed to create user" });
      return null;
    },

    loginUser: async (nickname, apiKey, sessionType = "standard") => {
      set({ isLoading: true, error: null });
      const res = await api.loginUser(nickname, apiKey);
      if (res.ok && res.data) {
        const user = res.data;
        applySession(user, sessionType);
        await refreshUsers();
        return user;
      }
      set({
        isLoading: false,
        error: res.error?.message ?? "Invalid credentials",
      });
      return null;
    },

    updateOwnApiKey: async (apiKey) => {
      const activeUserId = get().activeUserId;
      if (!activeUserId) {
        set({ error: "No active user" });
        return false;
      }
      set({ error: null });
      const res = await api.updateUser(activeUserId, { api_key: apiKey });
      if (res.ok && res.data) {
        const updated = res.data;
        set((s) => ({
          users: s.users.map((u) => (u.id === updated.id ? updated : u)),
        }));
        // Keep the persisted session envelope in sync so a refresh shows the
        // updated account. The API key itself is never stored client-side.
        const persisted = loadPersistedSession();
        if (persisted && persisted.userId === updated.id) {
          savePersistedSession({ ...persisted, user: updated });
        }
        return true;
      }
      set({ error: res.error?.message ?? "Failed to update key" });
      return false;
    },

    loginWithMagicToken: async (token) => {
      set({ isLoading: true, error: null });
      const res = await api.loginWithMagicToken(token);
      if (res.ok && res.data) {
        const user = res.data;
        applySession(user, "standard");
        await refreshUsers();
        return user;
      }
      set({
        isLoading: false,
        error: res.error?.message ?? "Magic login failed",
      });
      return null;
    },

    startTrialSession: async (lead) => {
      // Every trial opens a brand-new, completely clean account named after
      // the visitor. The API key is the shared demo key — unchanged for
      // everyone — and the contact details are stamped on the account so
      // the demo admin (8+0) can see who opened each demo.
      set({ isLoading: true, error: null });
      const res = await api.createTrialUser(lead);
      if (res.ok && res.data) {
        const user = res.data;
        // trialSetupPending drives the guided first-setup wizard in the app.
        applySession(user, "trial", true);
        set((s) => ({ users: [...s.users, user] }));
        return user;
      }
      set({
        isLoading: false,
        error: res.error?.message ?? "Failed to start trial",
      });
      return null;
    },

    loginAsDemoUser: (account) => {
      // The demo admin picked a trial account from the 8+0 screen. There is
      // no credential exchange — the backend has no session middleware and
      // the admin already proved access via the hidden chord; we simply
      // establish a full demo_admin session on the chosen account.
      applySession(
        {
          id: account.id,
          nickname: account.nickname,
          created_at: account.created_at,
          origin: "trial",
        },
        "demo_admin",
      );
    },

    enterDemoAdmin: (user) => {
      applySession(user, "demo_admin");
    },

    completeTrialSetup: () => {
      const persisted = loadPersistedSession();
      if (persisted) {
        savePersistedSession({ ...persisted, trialSetupPending: false });
      }
      set({ trialSetupPending: false });
    },

    setActiveUser: (id) => set({ activeUserId: id }),

    logout: () => {
      clearPersistedSession();
      setApiActiveUser(null);
      set({
        activeUserId: null,
        isAuthenticated: false,
        expiresAt: null,
        sessionType: "standard",
      });
    },

    clearExpiredSession: () => {
      clearPersistedSession();
      setApiActiveUser(null);
      set({
        activeUserId: null,
        isAuthenticated: false,
        expiresAt: null,
        sessionType: "standard",
      });
    },
  };
});
