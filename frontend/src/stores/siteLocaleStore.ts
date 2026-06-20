import { create } from "zustand";
import { useLanguageStore, type Dir, type Locale } from "./languageStore";
import { buildSitePath, parseSitePath } from "../site/siteRoutes";

// ── Marketing-site locale store ──
// The URL is the source of truth (/he/* ⇒ Hebrew); this store only reflects
// it and fans the value out to consumers: the shared language store (which
// the embedded demos read directly) and, via useDocumentChrome, the document
// <html lang dir>. It is intentionally separate from the operational app's
// languageStore defaults — the site defaults to English while the console
// defaults to Hebrew — and persists the visitor's explicit choice under its
// own key so the two areas never fight over a preference.

const STORAGE_KEY = "ghost-site-locale";

export function readStoredSiteLocale(): Locale | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "he" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

function persistSiteLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage unavailable (private mode etc.) — the URL still carries the locale.
  }
}

function dirFor(locale: Locale): Dir {
  return locale === "he" ? "rtl" : "ltr";
}

interface SiteLocaleState {
  locale: Locale;
  dir: Dir;
  // Reflect a locale already encoded in the URL (initial load / popstate /
  // programmatic navigation). Does NOT touch the URL.
  applyLocale: (next: Locale) => void;
  // Explicit visitor action (the sidebar language button): rewrite the
  // current URL to the same screen in the other language, remember the
  // choice, and apply it.
  switchLocale: () => void;
}

const initialLocale: Locale =
  typeof window === "undefined"
    ? "en"
    : parseSitePath(window.location.pathname).locale;

// Sync the shared language store at module load (before first render) so the
// document chrome and demos never flash the wrong language/direction. The
// operational app never imports this module, so its he-default is untouched.
if (useLanguageStore.getState().locale !== initialLocale) {
  useLanguageStore.setState({
    locale: initialLocale,
    dir: dirFor(initialLocale),
  });
}

export const useSiteLocaleStore = create<SiteLocaleState>((set, get) => ({
  locale: initialLocale,
  dir: dirFor(initialLocale),

  applyLocale: (next) => {
    const dir = dirFor(next);
    set({ locale: next, dir });
    // Mirror into the shared language store so the embedded demos (which read
    // it directly) and useDocumentChrome (<html lang dir>) follow the site.
    // This build is separate from /app.html, so the console is unaffected.
    if (useLanguageStore.getState().locale !== next) {
      useLanguageStore.setState({ locale: next, dir });
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
      document.documentElement.dir = dir;
    }
  },

  switchLocale: () => {
    const next: Locale = get().locale === "he" ? "en" : "he";
    if (typeof window !== "undefined") {
      const { screen } = parseSitePath(window.location.pathname);
      const path = buildSitePath(screen, next);
      const { search, hash } = window.location;
      if (window.location.pathname !== path) {
        window.history.pushState({}, "", path + search + hash);
      }
    }
    persistSiteLocale(next);
    get().applyLocale(next);
  },
}));
