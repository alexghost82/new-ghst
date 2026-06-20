import { create } from "zustand";

import {
  adminApi,
  clearSession,
  getStoredSession,
  setSession,
  type AdminProfile,
  type LoginResult,
} from "./api";

export type AuthStage = "loading" | "login" | "mfa" | "mfa_setup" | "authed";

interface MfaContext {
  mfaToken: string;
  totpSecret?: string;
  otpauthUri?: string;
}

interface AdminState {
  stage: AuthStage;
  admin: AdminProfile | null;
  mfa: MfaContext | null;
  busy: boolean;
  error: string | null;

  init: () => Promise<void>;
  submitPassword: (email: string, password: string) => Promise<void>;
  submitMfa: (code: string) => Promise<void>;
  logout: (all?: boolean) => Promise<void>;
  clearError: () => void;
  can: (permission: string) => boolean;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stage: "loading",
  admin: null,
  mfa: null,
  busy: false,
  error: null,

  init: async () => {
    const session = getStoredSession();
    if (!session?.access_token) {
      set({ stage: "login", admin: null });
      return;
    }
    const res = await adminApi.me();
    if (res.ok && res.data) {
      set({ stage: "authed", admin: res.data });
    } else {
      clearSession();
      set({ stage: "login", admin: null });
    }
  },

  submitPassword: async (email, password) => {
    set({ busy: true, error: null });
    const res = await adminApi.login(email.trim(), password);
    if (!res.ok || !res.data) {
      set({
        busy: false,
        error:
          res.status === 423
            ? "Account temporarily locked after failed attempts. Try again later."
            : "Invalid credentials.",
      });
      return;
    }
    const d: LoginResult = res.data;
    set({
      busy: false,
      stage: d.stage === "mfa_setup" ? "mfa_setup" : "mfa",
      mfa: {
        mfaToken: d.mfa_token,
        totpSecret: d.totp_secret,
        otpauthUri: d.otpauth_uri,
      },
    });
  },

  submitMfa: async (code) => {
    const mfa = get().mfa;
    if (!mfa) {
      set({ stage: "login", error: "Session expired, please sign in again." });
      return;
    }
    set({ busy: true, error: null });
    const res = await adminApi.verifyMfa(mfa.mfaToken, code.trim());
    if (!res.ok || !res.data) {
      set({ busy: false, error: "Invalid or expired verification code." });
      return;
    }
    setSession(res.data);
    set({ busy: false, stage: "authed", admin: res.data.admin, mfa: null });
  },

  logout: async (all = false) => {
    try {
      await adminApi.logout(all);
    } catch {
      /* best effort */
    }
    clearSession();
    set({ stage: "login", admin: null, mfa: null, error: null });
  },

  clearError: () => set({ error: null }),

  can: (permission) => {
    const admin = get().admin;
    return !!admin && admin.permissions.includes(permission);
  },
}));
