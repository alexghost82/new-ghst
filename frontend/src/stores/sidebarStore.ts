import { create } from "zustand";

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 520;
export const SIDEBAR_DEFAULT_WIDTH = 260;

interface SidebarState {
  isOpen: boolean;
  width: number;
  isResizing: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setOpenTransient: (value: boolean) => void;
  setWidth: (width: number) => void;
  setResizing: (value: boolean) => void;
  resetWidth: () => void;
}

const STORAGE_KEY_OPEN = "ghost-sidebar-open";
const STORAGE_KEY_WIDTH = "ghost-sidebar-width";

const storedOpen = localStorage.getItem(STORAGE_KEY_OPEN);
const initialOpen = storedOpen === null ? true : storedOpen === "true";

function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

function readStoredWidth(): number {
  const raw = localStorage.getItem(STORAGE_KEY_WIDTH);
  if (raw === null) return SIDEBAR_DEFAULT_WIDTH;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return SIDEBAR_DEFAULT_WIDTH;
  return clampWidth(parsed);
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: initialOpen,
  width: readStoredWidth(),
  isResizing: false,
  toggle: () =>
    set((s) => {
      const next = !s.isOpen;
      localStorage.setItem(STORAGE_KEY_OPEN, String(next));
      return { isOpen: next };
    }),
  open: () => {
    localStorage.setItem(STORAGE_KEY_OPEN, "true");
    set({ isOpen: true });
  },
  close: () => {
    localStorage.setItem(STORAGE_KEY_OPEN, "false");
    set({ isOpen: false });
  },
  // Toggle the on-screen open state WITHOUT touching the persisted preference.
  // Used for automatic collapse/restore when a context panel opens, so the
  // operator's saved sidebar choice survives a reload.
  setOpenTransient: (value) => set({ isOpen: value }),
  setWidth: (width) => {
    const clamped = clampWidth(width);
    localStorage.setItem(STORAGE_KEY_WIDTH, String(clamped));
    set({ width: clamped });
  },
  setResizing: (value) => set({ isResizing: value }),
  resetWidth: () => {
    localStorage.setItem(STORAGE_KEY_WIDTH, String(SIDEBAR_DEFAULT_WIDTH));
    set({ width: SIDEBAR_DEFAULT_WIDTH });
  },
}));
