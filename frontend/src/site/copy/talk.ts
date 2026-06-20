import type { Locale } from "../../stores/languageStore";

// ── Talk to Ghost — bilingual page copy ──
// Tactical mono labels (kicker pills, "Ghost // …" section labels, status
// lines) are brand-signature English and stay hardcoded in the components;
// everything a visitor *reads* lives here, per locale. English is the
// original copy, byte-for-byte.

export interface TalkStepCopy {
  step: string;
  title: string;
  body: string;
  example: string;
}

export interface TrialGateCopy {
  ariaLabel: string;
  close: string;
  userBubble: string;
  title: string;
  titleSub: string;
  body: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  submit: string;
  busy: string;
  validation: string;
  footnote: string;
}

export interface TalkCopy {
  accessLabel: string;
  heroTitle: string;
  heroTitleSub: string;
  heroBody: string;
  startTrial: string;
  starting: string;
  requestFullAccess: string;
  privacyNote: string;
  ctaTitle: string;
  ctaBody: string;
  gate: TrialGateCopy;
}

export const TALK_COPY: Record<Locale, TalkCopy> = {
  en: {
    accessLabel: "Request access",
    heroTitle: "Talk to Ghost.",
    heroTitleSub: "On your own camera. Right now.",
    heroBody:
      "No install, no sign-up. Point Ghost at a camera connected to this device and get eight minutes of the real thing — ask what's happening in plain language, and set a watch that alerts you the moment it matters.",
    startTrial: "Start live trial",
    starting: "Starting your session…",
    requestFullAccess: "Request full access",
    privacyNote:
      "Your video never leaves the frame Ghost reads. Faces are blurred before analysis.",
    ctaTitle: "Eight minutes. One camera. Your questions.",
    ctaBody:
      "The trial runs on a live demo agent. When the clock runs out, your session ends automatically — request access to keep going.",
    gate: {
      ariaLabel: "Start the Ghost live trial",
      close: "Close",
      userBubble: "Let me try Ghost on my own camera.",
      title: "One step before you start.",
      titleSub: "Tell us who's testing.",
      body: "Your eight minutes run on a live agent. Leave your details and we'll open the session right away.",
      namePlaceholder: "Full name",
      emailPlaceholder: "Work email",
      phonePlaceholder: "Mobile phone",
      submit: "Start live trial",
      busy: "Opening your session…",
      validation:
        "Enter your full name, a valid work email and a mobile phone.",
      footnote: "We'll only use this to follow up about your trial.",
    },
  },
  he: {
    accessLabel: "בקשת גישה",
    heroTitle: "דברו עם Ghost.",
    heroTitleSub: "על המצלמה שלכם. עכשיו.",
    heroBody:
      "בלי התקנה, בלי הרשמה. מכוונים את Ghost למצלמה שמחוברת למכשיר הזה ומקבלים שמונה דקות של הדבר האמיתי — שואלים מה קורה בשפה חופשית, ומגדירים משימת צפייה שמתריעה ברגע שזה משנה.",
    startTrial: "התחלת התנסות חיה",
    starting: "פותח את הסשן…",
    requestFullAccess: "בקשת גישה מלאה",
    privacyNote:
      "הווידאו שלכם לא עוזב את הפריים ש-Ghost קורא. פנים מטושטשות לפני הניתוח.",
    ctaTitle: "שמונה דקות. מצלמה אחת. השאלות שלכם.",
    ctaBody:
      "ההתנסות רצה על סוכן דמו חי. כשהשעון נגמר, הסשן נסגר אוטומטית — בקשו גישה כדי להמשיך.",
    gate: {
      ariaLabel: "התחלת התנסות חיה ב-Ghost",
      close: "סגירה",
      userBubble: "תנו לי לנסות את Ghost על מצלמה משלי.",
      title: "צעד אחד לפני שמתחילים.",
      titleSub: "ספרו לנו מי בודק.",
      body: "שמונה הדקות שלכם רצות על סוכן חי. השאירו פרטים ונפתח את הסשן מיד.",
      namePlaceholder: "שם מלא",
      emailPlaceholder: "אימייל עבודה",
      phonePlaceholder: "טלפון נייד",
      submit: "התחלת התנסות חיה",
      busy: "פותח את הסשן…",
      validation: "הזינו שם מלא, אימייל עבודה תקין וטלפון נייד.",
      footnote: "נשתמש בפרטים רק כדי לחזור אליכם לגבי ההתנסות.",
    },
  },
};

// One guided step, mirrored 1:1 by the in-app wizard. Copy follows the Ghost
// voice — we describe understanding a single frame, never generic "detection".
// Status-style mono lines (step 01 example) stay English in both locales.
export const TALK_STEPS: Record<Locale, TalkStepCopy[]> = {
  en: [
    {
      step: "01",
      title: "Pick a camera, confirm it's live",
      body: "Point Ghost at any camera connected to this device. We pull a single frame and confirm the feed is clear before you start.",
      example: "Feed locked · front entrance · 1080p · clear line of sight",
    },
    {
      step: "02",
      title: "Ask in plain language",
      body: "Type like you'd message a colleague. Ghost reads the live frame and answers in seconds — no menus, no rules to configure.",
      example:
        '"Is the loading bay gate open right now?" — Ghost: "The roll-up gate is raised, no vehicle in the bay."',
    },
    {
      step: "03",
      title: "Set a watch, get alerted",
      body: "Describe what matters in one sentence. Ghost watches the frame and surfaces the moment it sees it — in real time.",
      example: '"Tell me if a person without a hi-vis vest enters the yard."',
    },
  ],
  he: [
    {
      step: "01",
      title: "בוחרים מצלמה, מאשרים שהיא חיה",
      body: "מכוונים את Ghost לכל מצלמה שמחוברת למכשיר הזה. אנחנו מושכים פריים בודד ומאשרים שהפיד נקי לפני שמתחילים.",
      example: "Feed locked · front entrance · 1080p · clear line of sight",
    },
    {
      step: "02",
      title: "שואלים בשפה חופשית",
      body: "כותבים כמו הודעה לעמית. Ghost קורא את הפריים החי ועונה בתוך שניות — בלי תפריטים, בלי חוקים להגדיר.",
      example:
        '"שער רציף ההעמסה פתוח עכשיו?" — Ghost: "תריס הגלילה מורם, אין רכב ברציף."',
    },
    {
      step: "03",
      title: "מגדירים משימת צפייה, מקבלים התראה",
      body: "מתארים במשפט אחד מה חשוב. Ghost צופה בפריים ומציף ברגע שהוא רואה את זה — בזמן אמת.",
      example: '"עדכן אותי אם עובד בלי אפוד זוהר נכנס לחצר התפעולית."',
    },
  ],
};
