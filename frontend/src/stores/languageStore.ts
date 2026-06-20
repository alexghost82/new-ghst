import { create } from "zustand";

export type Locale = "he" | "en";
export type Dir = "rtl" | "ltr";

interface LanguageState {
  locale: Locale;
  dir: Dir;
  toggle: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: "he",
  dir: "rtl",
  toggle: () =>
    set((s) => {
      const next: Locale = s.locale === "he" ? "en" : "he";
      const dir: Dir = next === "he" ? "rtl" : "ltr";
      document.documentElement.lang = next;
      document.documentElement.dir = dir;
      return { locale: next, dir };
    }),
}));
