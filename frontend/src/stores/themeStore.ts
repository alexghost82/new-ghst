import { create } from "zustand";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const stored = localStorage.getItem("ghost-theme") as Theme | null;
const initial: Theme = stored === "light" ? "light" : "dark";

document.documentElement.setAttribute("data-theme", initial);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  toggle: () =>
    set((s) => {
      const next: Theme = s.theme === "dark" ? "light" : "dark";
      localStorage.setItem("ghost-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return { theme: next };
    }),
}));
