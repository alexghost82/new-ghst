import { useEffect } from "react";
import { useLanguageStore } from "../stores/languageStore";
import { useThemeStore } from "../stores/themeStore";

// Keeps the document's language/direction and theme attributes in sync with
// the global stores. Shared by both front-end entry points (the public
// marketing site and the operational system) so the two separate builds set
// `dir`, `lang`, and `data-theme` identically.
export function useDocumentChrome(): void {
  const { dir, locale } = useLanguageStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [dir, locale]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
}
