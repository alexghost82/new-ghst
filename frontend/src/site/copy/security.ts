import type { Locale } from "../../stores/languageStore";

// ── Security Architecture — bilingual page copy ──
// Tactical mono labels (the "Confidential · …" kicker, "Briefing // …"
// section labels, the hero badge chips, the NDA line and the classification
// footer) are brand-signature English and stay hardcoded in the component;
// everything a visitor *reads* lives here, per locale. English is the
// original copy, byte-for-byte. Technical terms (RTSP, HDMI, Zero Trust,
// Air-Gap, SOC, SIEM, LLM, NVR…) stay English in both locales.

export interface SecurityItemCopy {
  title: string;
  body: string;
}

export interface SecurityPipelineStepCopy {
  label: string;
  sub: string;
}

export interface SecurityCopy {
  heroTitle: string;
  heroTitleSub: string;
  heroBody: string;
  getPdf: string;
  viewDataFlow: string;
  overviewTitle: string;
  overviewP1: string;
  overviewP2: string;
  pipelineTitle: string;
  pipelineBody: string;
  principlesTitle: string;
  deploymentsTitle: string;
  deploymentsBody: string;
  complianceTitle: string;
  complianceFootnote: string;
  downloadTitle: string;
  downloadBody: string;
  downloadReadyTitle: string;
  downloadReadyBody: string;
  downloadAgain: string;
  emailPlaceholder: string;
  emailAria: string;
  emailInvalid: string;
  downloadCta: string;
}

export const SECURITY_COPY: Record<Locale, SecurityCopy> = {
  en: {
    heroTitle: "Information Security Architecture.",
    heroTitleSub: "Agentless. Zero trust. Yours.",
    heroBody:
      "How Ghost connects to your cameras — and why it stays secure. An agentless, zero-trust pipeline that turns live video into operational intelligence without exposing your raw footage.",
    getPdf: "Get the architecture PDF",
    viewDataFlow: "View the data flow",
    overviewTitle:
      "Enterprise-grade visual intelligence — live video, turned into operational awareness.",
    overviewP1:
      "Ghost is an enterprise-grade visual intelligence platform designed to transform live video streams into operational awareness in real time. The platform combines advanced Vision AI and Large Language Models (LLM) to provide deep contextual understanding of complex environments, allowing operators to interact with cameras using natural language.",
    overviewP2:
      "The system enables organizations to manage cameras as conversational entities — similar to modern messaging platforms — while maintaining strict enterprise security standards, deployment flexibility, and a privacy-focused architecture.",
    pipelineTitle: "Four stages. One direction. No agents on your cameras.",
    pipelineBody:
      "Ghost receives streams from your existing security infrastructure over RTSP, HDMI capture, or isolated local integrations. Frames are analyzed in real time by Vision AI and LLM models that generate structured narratives, alerts, and contextual insight — then surfaced to operators as plain-language conversations.",
    principlesTitle: "Five principles, enforced everywhere.",
    deploymentsTitle: "From air-gapped facilities to enterprise SOC.",
    deploymentsBody:
      "Ghost supports multiple deployment configurations to comply with enterprise cybersecurity, compliance, and operational requirements — from fully air-gapped facilities to SOC and SIEM integrations.",
    complianceTitle: "Built for organizations under strict compliance.",
    complianceFootnote:
      "Suitable for organizations under strict compliance requirements — healthcare institutions, industrial facilities, financial organizations, logistics operators, critical infrastructure, and large-scale security operations centers.",
    downloadTitle: "Download the full architecture.",
    downloadBody:
      "Enter your email to receive the complete Enterprise Architecture document — deployment models, security framework, and the full data-flow specification.",
    downloadReadyTitle: "Your download is ready",
    downloadReadyBody:
      "The PDF should be downloading now. If it didn't start, use the button below.",
    downloadAgain: "Download again",
    emailPlaceholder: "you@company.com",
    emailAria: "Work email",
    emailInvalid: "Enter a valid email address.",
    downloadCta: "Download",
  },
  he: {
    heroTitle: "ארכיטקטורת אבטחת מידע.",
    heroTitleSub: "Agentless. Zero Trust. בשליטתכם.",
    heroBody:
      "איך Ghost מתחבר למצלמות שלכם — ולמה זה נשאר מאובטח. צינור Agentless בארכיטקטורת Zero Trust שהופך וידאו חי למודיעין מבצעי, בלי לחשוף את חומר הגלם שלכם.",
    getPdf: "להורדת מסמך הארכיטקטורה",
    viewDataFlow: "צפייה בזרימת הנתונים",
    overviewTitle:
      "מודיעין חזותי ברמה ארגונית — וידאו חי שהופך למודעות מבצעית.",
    overviewP1:
      "Ghost היא פלטפורמת מודיעין חזותי ברמה ארגונית, שנועדה להפוך שידורי וידאו חיים למודעות מבצעית בזמן אמת. הפלטפורמה משלבת Vision AI מתקדם עם מודלי שפה גדולים (LLM) כדי לספק הבנה הקשרית עמוקה של סביבות מורכבות, ומאפשרת למפעילים לתחקר מצלמות בשפה טבעית.",
    overviewP2:
      "המערכת מאפשרת לארגונים לנהל מצלמות כישויות שיחה — בדומה לפלטפורמות מסרים מודרניות — תוך שמירה על תקני אבטחה ארגוניים מחמירים, גמישות בפריסה וארכיטקטורה ממוקדת פרטיות.",
    pipelineTitle: "ארבעה שלבים. כיוון אחד. בלי agents על המצלמות שלכם.",
    pipelineBody:
      "Ghost מקבל שידורים מתשתית האבטחה הקיימת שלכם דרך RTSP, לכידת HDMI או אינטגרציות מקומיות מבודדות. פריימים מנותחים בזמן אמת על-ידי מודלי Vision AI ו-LLM שמייצרים נרטיבים מובנים, התראות ותובנות הקשריות — ומוצגים למפעילים כשיחות בשפה טבעית.",
    principlesTitle: "חמישה עקרונות, נאכפים בכל מקום.",
    deploymentsTitle: "ממתקנים מנותקים לחלוטין ועד SOC ארגוני.",
    deploymentsBody:
      "Ghost תומך במגוון תצורות פריסה כדי לעמוד בדרישות סייבר, רגולציה ותפעול ארגוניות — ממתקני Air-Gap מנותקים לחלוטין ועד אינטגרציות SOC ו-SIEM.",
    complianceTitle: "נבנה לארגונים תחת רגולציה מחמירה.",
    complianceFootnote:
      "מתאים לארגונים תחת דרישות רגולציה מחמירות — מוסדות בריאות, מתקנים תעשייתיים, ארגונים פיננסיים, מפעילי לוגיסטיקה, תשתיות קריטיות ומרכזי אבטחה (SOC) בקנה מידה גדול.",
    downloadTitle: "הורידו את הארכיטקטורה המלאה.",
    downloadBody:
      "הזינו אימייל לקבלת מסמך ה-Enterprise Architecture המלא — מודלי פריסה, מסגרת אבטחה ומפרט זרימת הנתונים המלא.",
    downloadReadyTitle: "ההורדה שלכם מוכנה",
    downloadReadyBody:
      "ה-PDF אמור לרדת כעת. אם ההורדה לא התחילה, השתמשו בכפתור למטה.",
    downloadAgain: "הורדה חוזרת",
    emailPlaceholder: "you@company.com",
    emailAria: "אימייל עבודה",
    emailInvalid: "הזינו כתובת אימייל תקינה.",
    downloadCta: "הורדה",
  },
};

// Enterprise design principles — zipped positionally with the icon list in
// the component. Standard/industry terms (Zero Trust, Privacy by Design,
// NVR, hybrid-cloud, SOC) stay English in both locales.
export const SECURITY_PRINCIPLES: Record<Locale, SecurityItemCopy[]> = {
  en: [
    {
      title: "Zero Trust Architecture",
      body: "Segregated access control, role-based permissions, and continuously monitored data flow.",
    },
    {
      title: "Privacy by Design",
      body: "Minimized exposure of raw video and fully configurable retention policies.",
    },
    {
      title: "Agentless Integration",
      body: "No software agents required on cameras or NVR devices.",
    },
    {
      title: "Operational Intelligence",
      body: "Real-time contextual understanding instead of basic object detection.",
    },
    {
      title: "Flexible Deployment",
      body: "Supports local, isolated, hybrid-cloud, and enterprise SOC environments.",
    },
  ],
  he: [
    {
      title: "ארכיטקטורת Zero Trust",
      body: "בקרת גישה מופרדת, הרשאות מבוססות-תפקיד וזרימת נתונים תחת ניטור רציף.",
    },
    {
      title: "Privacy by Design",
      body: "חשיפה ממוזערת של וידאו גולמי ומדיניות שמירה ניתנת להגדרה מלאה.",
    },
    {
      title: "אינטגרציה ללא Agents",
      body: "לא נדרשת התקנת תוכנה על מצלמות או התקני NVR.",
    },
    {
      title: "מודיעין מבצעי",
      body: "הבנה הקשרית בזמן אמת — לא זיהוי אובייקטים בסיסי.",
    },
    {
      title: "פריסה גמישה",
      body: "תמיכה בסביבות מקומיות, מבודדות, hybrid-cloud ו-SOC ארגוני.",
    },
  ],
};

export const SECURITY_DEPLOYMENTS: Record<Locale, SecurityItemCopy[]> = {
  en: [
    {
      title: "Local RTSP",
      body: "Processing within isolated enterprise networks.",
    },
    {
      title: "Air-Gapped",
      body: "For highly sensitive, fully disconnected facilities.",
    },
    {
      title: "HDMI Capture",
      body: "Isolated capture architecture with no network coupling.",
    },
    {
      title: "Hybrid Cloud",
      body: "Hybrid-cloud intelligence environments.",
    },
    {
      title: "Enterprise SOC",
      body: "Integration with SOC teams and enterprise SIEM platforms.",
    },
  ],
  he: [
    {
      title: "RTSP מקומי",
      body: "עיבוד בתוך רשתות ארגוניות מבודדות.",
    },
    {
      title: "Air-Gapped",
      body: "למתקנים רגישים במיוחד, מנותקים לחלוטין.",
    },
    {
      title: "לכידת HDMI",
      body: "ארכיטקטורת לכידה מבודדת ללא צימוד רשתי.",
    },
    {
      title: "Hybrid Cloud",
      body: "סביבות מודיעין בתצורת hybrid-cloud.",
    },
    {
      title: "SOC ארגוני",
      body: "אינטגרציה עם צוותי SOC ופלטפורמות SIEM ארגוניות.",
    },
  ],
};

export const SECURITY_COMPLIANCE: Record<Locale, SecurityItemCopy[]> = {
  en: [
    {
      title: "Zero Trust Architecture",
      body: "Every request authenticated; no implicit trust between components.",
    },
    {
      title: "Access Control & Audit Logs",
      body: "Role-based access with configurable, exportable audit trails.",
    },
    {
      title: "Encrypted Data Channels",
      body: "All communication moves over encrypted channels, end to end.",
    },
    {
      title: "Minimal Data Retention",
      body: "Raw video is minimized; structured AI memory layers persist instead.",
    },
  ],
  he: [
    {
      title: "ארכיטקטורת Zero Trust",
      body: "כל בקשה מאומתת; אין אמון מובנה בין רכיבים.",
    },
    {
      title: "בקרת גישה ויומני ביקורת",
      body: "גישה מבוססת-תפקיד עם יומני ביקורת ניתנים להגדרה ולייצוא.",
    },
    {
      title: "ערוצי נתונים מוצפנים",
      body: "כל התקשורת עוברת בערוצים מוצפנים, מקצה לקצה.",
    },
    {
      title: "שמירת נתונים מינימלית",
      body: "וידאו גולמי ממוזער; במקומו נשמרות שכבות זיכרון AI מובנות.",
    },
  ],
};

// The connection chain, top → bottom of the funnel — zipped positionally
// with the icon list in the component. "Ghost Vision AI" and the protocol
// names (RTSP / HDMI) are product/technical terms and stay English.
export const SECURITY_PIPELINE: Record<Locale, SecurityPipelineStepCopy[]> = {
  en: [
    { label: "Security Cameras", sub: "Your existing fleet" },
    { label: "RTSP / HDMI", sub: "Agentless capture" },
    { label: "Ghost Vision AI", sub: "LLM + Vision processing" },
    { label: "Operator Interface", sub: "Chat with every camera" },
  ],
  he: [
    { label: "מצלמות האבטחה", sub: "המערך הקיים שלכם" },
    { label: "RTSP / HDMI", sub: "לכידה ללא agents" },
    { label: "Ghost Vision AI", sub: "עיבוד LLM + Vision" },
    { label: "ממשק המפעיל", sub: "שיחה עם כל מצלמה" },
  ],
};
