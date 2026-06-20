import { create } from "zustand";

export type ViewMode = "chat" | "incidents" | "operations";

interface ViewState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggleMode: () => void;
}

export const useViewStore = create<ViewState>((set, get) => ({
  mode: "chat",
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set({ mode: get().mode === "chat" ? "incidents" : "chat" }),
}));
