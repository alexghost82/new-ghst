import { create } from "zustand";

// ---------------------------------------------------------------------------
// Centralised UX feedback: transient toasts + a single branded confirm dialog.
//
// Both are usable imperatively (outside React) so stores and async flows can
// trigger them, e.g. `toast.success(...)` or `await confirmDialog({...})`.
// ---------------------------------------------------------------------------

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" renders a destructive (red) confirm button. */
  tone?: "danger" | "default";
}

interface ConfirmState extends ConfirmRequest {
  open: boolean;
  resolve: ((ok: boolean) => void) | null;
}

interface FeedbackState {
  toasts: Toast[];
  confirm: ConfirmState;
  pushToast: (kind: ToastKind, message: string, ttlMs?: number) => void;
  dismissToast: (id: string) => void;
  requestConfirm: (req: ConfirmRequest) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
}

const DEFAULT_TTL_MS = 4000;

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  toasts: [],
  confirm: { open: false, title: "", resolve: null },

  pushToast: (kind, message, ttlMs = DEFAULT_TTL_MS) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => get().dismissToast(id), ttlMs);
    }
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  requestConfirm: (req) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { ...req, open: true, resolve } });
    }),

  resolveConfirm: (ok) => {
    const { confirm } = get();
    confirm.resolve?.(ok);
    set({ confirm: { open: false, title: "", resolve: null } });
  },
}));

// Imperative helpers usable from anywhere (stores, services, components).
export const toast = {
  success: (message: string) =>
    useFeedbackStore.getState().pushToast("success", message),
  error: (message: string) =>
    useFeedbackStore.getState().pushToast("error", message),
  info: (message: string) =>
    useFeedbackStore.getState().pushToast("info", message),
};

export function confirmDialog(req: ConfirmRequest): Promise<boolean> {
  return useFeedbackStore.getState().requestConfirm(req);
}
