import { useEffect } from "react";
import type { Locale } from "../stores/languageStore";
import { buildSitePath, type SiteScreen } from "./siteRoutes";

// ── Per-page SEO chrome for the bilingual marketing site ──
// Keeps document.title, hreflang alternates, og:locale, and the canonical
// link in step with the visible screen + active locale. Tags are injected
// dynamically (SPA) and marked with data-ghost-seo so re-renders replace
// rather than accumulate them.

const SCREEN_TITLE: Record<Locale, Record<SiteScreen, string>> = {
  en: {
    login: "Ghost",
    defense: "Ghost — Defense & National Security Brief",
    talk: "Ghost — Talk to Ghost",
    drone: "Ghost — Drone Detection",
    security: "Ghost — Security Architecture",
    usecases: "Ghost — Use Cases",
    capabilities: "Ghost — What Ghost Can Do",
    team: "Ghost — People",
    careers: "Ghost — Careers",
    partners: "Ghost — Partners",
    training: "Ghost — Operator Training",
    downloads: "Ghost — Downloads",
    create: "Ghost — Create Access",
  },
  he: {
    login: "Ghost",
    defense: "Ghost — תדריך הגנה וביטחון לאומי",
    talk: "Ghost — דברו עם Ghost",
    drone: "Ghost — גילוי רחפנים",
    security: "Ghost — ארכיטקטורת אבטחת מידע",
    usecases: "Ghost — תרחישי שימוש",
    capabilities: "Ghost — מה Ghost יודע לעשות",
    team: "Ghost — הצוות",
    careers: "Ghost — קריירה",
    partners: "Ghost — שותפים",
    training: "Ghost — הכשרת מפעילים",
    downloads: "Ghost — Downloads",
    create: "Ghost — יצירת גישה",
  },
};

const OG_LOCALE: Record<Locale, string> = { en: "en_US", he: "he_IL" };

const SEO_ATTR = "data-ghost-seo";

function upsertLink(rel: string, href: string, hreflang?: string): void {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"][${SEO_ATTR}]`
    : `link[rel="${rel}"][${SEO_ATTR}]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (hreflang) el.hreflang = hreflang;
    el.setAttribute(SEO_ATTR, "");
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertMeta(property: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"][${SEO_ATTR}]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    el.setAttribute(SEO_ATTR, "");
    document.head.appendChild(el);
  }
  el.content = content;
}

export function useSiteSeo(screen: SiteScreen, locale: Locale): void {
  useEffect(() => {
    document.title = SCREEN_TITLE[locale][screen];

    const origin = window.location.origin;
    const enUrl = origin + buildSitePath(screen, "en");
    const heUrl = origin + buildSitePath(screen, "he");

    upsertLink("canonical", locale === "he" ? heUrl : enUrl);
    upsertLink("alternate", enUrl, "en");
    upsertLink("alternate", heUrl, "he");
    upsertLink("alternate", enUrl, "x-default");
    upsertMeta("og:locale", OG_LOCALE[locale]);
    upsertMeta(
      "og:locale:alternate",
      OG_LOCALE[locale === "he" ? "en" : "he"],
    );
  }, [screen, locale]);
}
