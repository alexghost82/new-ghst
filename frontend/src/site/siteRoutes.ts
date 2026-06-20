import type { Locale } from "../stores/languageStore";

// ── Marketing-site routing, locale-aware ──
// Every marketing screen owns a real URL in both languages: the English
// version lives at the bare path (e.g. /defense) and the Hebrew version under
// the /he prefix (e.g. /he/defense). The URL is the single source of truth
// for both the visible screen and the active locale; everything else
// (siteLocaleStore, document chrome, hreflang) derives from it.

export type SiteScreen =
  | "security"
  | "defense"
  | "talk"
  | "drone"
  | "usecases"
  | "capabilities"
  | "team"
  | "careers"
  | "partners"
  | "training"
  | "downloads"
  | "login"
  | "create";

export const SCREEN_TO_PATH: Record<SiteScreen, string> = {
  login: "/",
  defense: "/defense",
  talk: "/talk",
  drone: "/drone",
  security: "/security",
  usecases: "/use-cases",
  capabilities: "/capabilities",
  team: "/people",
  careers: "/careers",
  partners: "/partners",
  training: "/training",
  downloads: "/downloads",
  create: "/create",
};

const PATH_TO_SCREEN: Record<string, SiteScreen> = Object.fromEntries(
  Object.entries(SCREEN_TO_PATH).map(([screen, path]) => [path, screen]),
) as Record<string, SiteScreen>;

export const HE_PREFIX = "/he";

// Build the canonical pathname for a screen in a given locale.
// Hebrew login is plain "/he" (no trailing slash).
export function buildSitePath(screen: SiteScreen, locale: Locale): string {
  const base = SCREEN_TO_PATH[screen];
  if (locale !== "he") return base;
  return base === "/" ? HE_PREFIX : HE_PREFIX + base;
}

export interface ParsedSitePath {
  screen: SiteScreen;
  locale: Locale;
  // False when the (locale-stripped) path doesn't match any known screen, so
  // callers can normalize the URL instead of silently serving login at /foo.
  known: boolean;
}

export function parseSitePath(pathname: string): ParsedSitePath {
  let locale: Locale = "en";
  let path = pathname;
  if (path === HE_PREFIX || path === HE_PREFIX + "/") {
    return { screen: "login", locale: "he", known: true };
  }
  if (path.startsWith(HE_PREFIX + "/")) {
    locale = "he";
    path = path.slice(HE_PREFIX.length);
  }
  const screen = PATH_TO_SCREEN[path];
  return { screen: screen ?? "login", locale, known: screen !== undefined };
}
