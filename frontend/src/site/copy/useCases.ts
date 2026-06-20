import type { Locale } from "../../stores/languageStore";

// ── Use Cases — bilingual page copy ──
// Tactical mono labels (section labels like "Use Cases // By Sector", the
// CHECK_KINDS mono subs, camera chrome, status lines, and the footer strip)
// are brand-signature English and stay hardcoded in the component; everything
// a visitor *reads* lives here, per locale. English is the original copy,
// byte-for-byte. Sector content itself (names, blurbs, demos, checks) lives
// in `data/useCases.ts` and is resolved through `localizeSector`.

export interface UseCasesCheckLabels {
  periodic: string;
  critical: string;
  scheduled: string;
}

export interface UseCasesCopy {
  breadcrumb: string;
  // Flagship "Primary Sectors" band shown above the regular grid.
  primaryTitle: string;
  primaryIntro: string;
  // Reader-facing label inside each flagship card (the mono "PRIMARY SECTOR"
  // kicker stays English in the component).
  primaryCardLabel: string;
  gridTitle: string;
  gridIntro: string;
  // Count suffixes — rendered as `${n} ${suffix}`.
  monitoringZones: string;
  definedChecks: string;
  // Third cell of the sector data strip (value is the literal "24/7").
  continuousCoverage: string;
  checkLabels: UseCasesCheckLabels;
  escalated: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
}

export const USE_CASES_COPY: Record<Locale, UseCasesCopy> = {
  en: {
    breadcrumb: "Use Cases",
    primaryTitle: "The environments Ghost was built to hold.",
    primaryIntro:
      "Four operational worlds where a missed frame is measured in lives, not inventory — each mapped zone by zone, from the perimeter to the control room. This is Ghost at full depth.",
    primaryCardLabel: "Primary sector",
    gridTitle: "What can you do with Ghost on your site?",
    gridIntro:
      "For every sector we mapped the critical zones and the kinds of checks you can phrase in your own words — periodic monitoring, continuous critical alerts, and scheduled checks. Pick a sector to see what it looks like in practice.",
    monitoringZones: "monitoring zones",
    definedChecks: "defined checks",
    continuousCoverage: "continuous coverage",
    checkLabels: {
      periodic: "Periodic check",
      critical: "Critical alert",
      scheduled: "Scheduled check",
    },
    escalated: "Escalated to operations — top priority",
    ctaTitle: "Every check here was written in plain words.",
    ctaBody:
      "With Ghost you describe what to watch for in free language, and the system runs exactly what you defined and alerts only on the exceptions — it executes your intent, it doesn't decide for you.",
    ctaButton: "Request operational access",
  },
  he: {
    breadcrumb: "תרחישי שימוש",
    primaryTitle: "הסביבות ש-Ghost נבנה כדי להחזיק.",
    primaryIntro:
      "ארבעה עולמות תפעוליים שבהם פריים שמתפספס נמדד בחיי אדם, לא במלאי — כל אחד ממופה אזור-אזור, מהגדר ההיקפית ועד חדר הבקרה. זהו Ghost בעומק מלא.",
    primaryCardLabel: "סקטור מרכזי",
    gridTitle: "מה אפשר לעשות עם Ghost באתר שלכם?",
    gridIntro:
      "לכל ענף מיפינו את האזורים הקריטיים ואת סוגי הבדיקות שאתם מנסחים במילים שלכם — בדיקות מחזוריות, התראות קריטיות רציפות ובדיקות מתוזמנות. בחרו ענף כדי לראות איך זה נראה בפועל.",
    monitoringZones: "אזורי ניטור",
    definedChecks: "בדיקות מוגדרות",
    continuousCoverage: "כיסוי רציף",
    checkLabels: {
      periodic: "בדיקה מחזורית",
      critical: "התראה קריטית",
      scheduled: "בדיקה מתוזמנת",
    },
    escalated: "הוסלם לתפעול — עדיפות עליונה",
    ctaTitle: "כל בדיקה כאן נכתבה במילים פשוטות.",
    ctaBody:
      "עם Ghost אתם מתארים בשפה חופשית מה לבדוק, והמערכת מריצה בדיוק את מה שהגדרתם ומתריעה רק על החריגים — היא מבצעת את הכוונה שלכם, לא מחליטה במקומכם.",
    ctaButton: "בקשת גישה מבצעית",
  },
};
