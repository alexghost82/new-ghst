import type { Locale } from "../stores/languageStore";

// One key per embedded demo rendered on the "What Ghost can do" page. Keep in
// sync with the `DemoFor` switch in WhatGhostCanDoPage.tsx.
export type DemoKey =
  | "chat"
  | "history"
  | "broadcast"
  | "siteScan"
  | "cameras"
  | "organize"
  | "systemPrompt"
  | "memory"
  | "alerts";

interface CapabilityCopy {
  kicker: string;
  title: string;
  simple: string;
  steps: string[];
}

export interface Capability {
  id: string;
  demo: DemoKey;
  copy: Record<Locale, CapabilityCopy>;
}

// A short two-line heading used above the highlights / quotes / changelog
// sections.
export interface SectionHeading {
  kicker: string;
  title: string;
}

export interface FinalCtaCopy {
  kicker: string;
  title: string;
  subtitle: string;
  note: string;
}

export interface PageChrome {
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  heroNote: string;
  demoTag: string;
  downloadGuide: string;
  requestAccess: string;
  learnMore: string;
  showLess: string;
  highlights: SectionHeading;
  trustedBy: SectionHeading;
  changelog: SectionHeading;
  finalCta: FinalCtaCopy;
  footer: string;
}

// Static page chrome (hero, section headings, footer). Both locales are
// provided so the bilingual marketing page stays complete.
export const PAGE_CHROME: Record<Locale, PageChrome> = {
  en: {
    heroKicker: "Capabilities · Field Guide",
    heroTitle: "Everything you can ask your cameras to do.",
    heroSubtitle:
      "Ghost turns the cameras you already own into an operator you can talk to. Ask in plain words, get an answer, and let it watch for the exceptions on its own.",
    heroNote: "Nine capabilities · written in plain language · no new hardware",
    demoTag: "Live demo",
    downloadGuide: "Download field guide",
    requestAccess: "Request access",
    learnMore: "Learn more",
    showLess: "Show less",
    highlights: {
      kicker: "Recent highlights",
      title: "What operators reach for first.",
    },
    trustedBy: {
      kicker: "From the field",
      title: "How teams put Ghost to work.",
    },
    changelog: {
      kicker: "Changelog",
      title: "What shipped recently.",
    },
    finalCta: {
      kicker: "Ready when you are",
      title: "Bring Ghost to your site.",
      subtitle:
        "Keep the cameras you already run. Add an operator that watches every feed, answers in plain words, and only speaks up when it matters.",
      note: "No new hardware · works with the cameras you already run.",
    },
    footer: "Bring Ghost to your site",
  },
  he: {
    heroKicker: "יכולות · מדריך שטח",
    heroTitle: "כל מה שאפשר לבקש מהמצלמות שלך לעשות.",
    heroSubtitle:
      "Ghost הופך את המצלמות שכבר יש לך לקצין מבצעים שאפשר לדבר איתו. שואלים במילים פשוטות, מקבלים תשובה, ונותנים לו לשמור על החריגים בעצמו.",
    heroNote: "תשע יכולות · בשפה חופשית · בלי חומרה חדשה",
    demoTag: "הדגמה חיה",
    downloadGuide: "להורדת מדריך השטח",
    requestAccess: "בקשת גישה",
    learnMore: "פרטים נוספים",
    showLess: "להציג פחות",
    highlights: {
      kicker: "עדכונים אחרונים",
      title: "מה שמפעילים מחפשים קודם.",
    },
    trustedBy: {
      kicker: "מהשטח",
      title: "איך צוותים מפעילים את Ghost.",
    },
    changelog: {
      kicker: "יומן שינויים",
      title: "מה שודרג לאחרונה.",
    },
    finalCta: {
      kicker: "מוכנים כשאתם מוכנים",
      title: "הביאו את Ghost לאתר שלכם.",
      subtitle:
        "משאירים את המצלמות שכבר יש לכם. מוסיפים קצין מבצעים שצופה בכל מקור, עונה בשפה חופשית, ומדבר רק כשזה משנה.",
      note: "בלי חומרה חדשה · עובד עם המצלמות שכבר יש לכם.",
    },
    footer: "הביאו את Ghost לאתר שלכם",
  },
};

// ── The nine capabilities ─────────────────────────────────────────────────────
export const CAPABILITIES: Capability[] = [
  {
    id: "chat",
    demo: "chat",
    copy: {
      en: {
        kicker: "Capability 01 // Ask Anything",
        title: "Talk to your cameras in plain language.",
        simple:
          "Type a question the way you'd say it out loud, and Ghost answers from what the cameras actually see — no query language, no rules engine.",
        steps: [
          "Open any camera or your whole site and write a question.",
          "Ghost reads the live frames and answers in seconds.",
          "Follow up naturally — it keeps the context of the conversation.",
        ],
      },
      he: {
        kicker: "יכולת 01 // לשאול הכול",
        title: "מדברים עם המצלמות בשפה חופשית.",
        simple:
          "כותבים שאלה כמו שהיו אומרים אותה בקול, ו-Ghost עונה ממה שהמצלמות באמת רואות — בלי שפת שאילתות ובלי מנוע חוקים.",
        steps: [
          "פותחים מצלמה אחת או את כל האתר וכותבים שאלה.",
          "Ghost קורא את הפריימים החיים ועונה תוך שניות.",
          "ממשיכים לשאול באופן טבעי — הוא זוכר את הקשר השיחה.",
        ],
      },
    },
  },
  {
    id: "cameras",
    demo: "cameras",
    copy: {
      en: {
        kicker: "Capability 02 // Live Feeds",
        title: "Every camera, understood — not just streamed.",
        simple:
          "Bring your existing feeds into one view where each frame is understood in context, so you see what matters instead of staring at a wall of screens.",
        steps: [
          "Connect the cameras you already have over standard streams.",
          "Ghost watches each feed and surfaces the scenes worth your attention.",
          "Jump straight to the moment it flagged, with the frame attached.",
        ],
      },
      he: {
        kicker: "יכולת 02 // שידור חי",
        title: "כל מצלמה — מובנת, לא רק משודרת.",
        simple:
          "מחברים את המצלמות הקיימות לתצוגה אחת שבה כל פריים מובן בהקשר, כך שרואים את מה שחשוב במקום לבהות בקיר מסכים.",
        steps: [
          "מחברים את המצלמות שכבר יש לכם בשידורים סטנדרטיים.",
          "Ghost צופה בכל מקור ומציף את הסצנות שראויות לתשומת לבכם.",
          "קופצים ישר לרגע שסומן, עם הפריים מצורף.",
        ],
      },
    },
  },
  {
    id: "alerts",
    demo: "alerts",
    copy: {
      en: {
        kicker: "Capability 03 // Alerts On Your Terms",
        title: "Get told only when it actually matters.",
        simple:
          "Describe the exception you care about once, and Ghost raises an alert only when that exact situation appears — with the frame that proves it.",
        steps: [
          "Write the condition in plain words, per zone or per camera.",
          "Ghost runs it continuously and stays silent until it's met.",
          "When it fires, you get the alert with the evidence frame attached.",
        ],
      },
      he: {
        kicker: "יכולת 03 // התרעות בתנאים שלך",
        title: "מקבלים עדכון רק כשזה באמת משנה.",
        simple:
          "מתארים פעם אחת את החריג שחשוב לכם, ו-Ghost מעלה התרעה רק כשהמצב הזה בדיוק מופיע — עם הפריים שמוכיח אותו.",
        steps: [
          "כותבים את התנאי במילים פשוטות, לכל אזור או מצלמה.",
          "Ghost מריץ אותו ברצף ושותק עד שהוא מתקיים.",
          "כשהוא נדלק, מקבלים את ההתרעה עם פריים הוכחה מצורף.",
        ],
      },
    },
  },
  {
    id: "history",
    demo: "history",
    copy: {
      en: {
        kicker: "Capability 04 // Search The Past",
        title: "Ask what happened, not which tape to scrub.",
        simple:
          "Instead of scrubbing hours of footage, ask Ghost what happened in a window of time and it answers with the moments that match.",
        steps: [
          "Ask about a camera, a zone or a time range in plain words.",
          "Ghost reviews the recorded frames and returns the matches.",
          "Open any result to see the exact frame and what it found.",
        ],
      },
      he: {
        kicker: "יכולת 04 // לחפש בעבר",
        title: "שואלים מה קרה, לא איזו הקלטה לגלול.",
        simple:
          "במקום לגלול שעות של צילום, שואלים את Ghost מה קרה בחלון זמן והוא עונה עם הרגעים שמתאימים.",
        steps: [
          "שואלים על מצלמה, אזור או טווח זמן במילים פשוטות.",
          "Ghost סוקר את הפריימים המוקלטים ומחזיר את ההתאמות.",
          "פותחים כל תוצאה כדי לראות את הפריים המדויק ומה נמצא.",
        ],
      },
    },
  },
  {
    id: "broadcast",
    demo: "broadcast",
    copy: {
      en: {
        kicker: "Capability 05 // Ask Many At Once",
        title: "One question, every camera answers.",
        simple:
          "Send the same question to a whole group of cameras and get a single, consolidated answer instead of checking each one by hand.",
        steps: [
          "Pick a group of cameras or your entire site.",
          "Ask one question and Ghost runs it across all of them.",
          "Read one summary, then drill into any camera that stood out.",
        ],
      },
      he: {
        kicker: "יכולת 05 // לשאול את כולן בבת אחת",
        title: "שאלה אחת, כל המצלמות עונות.",
        simple:
          "שולחים את אותה שאלה לקבוצה שלמה של מצלמות ומקבלים תשובה אחת מאוחדת במקום לבדוק כל אחת ביד.",
        steps: [
          "בוחרים קבוצת מצלמות או את כל האתר.",
          "שואלים שאלה אחת ו-Ghost מריץ אותה על כולן.",
          "קוראים סיכום אחד, ואז צוללים לכל מצלמה שבלטה.",
        ],
      },
    },
  },
  {
    id: "siteScan",
    demo: "siteScan",
    copy: {
      en: {
        kicker: "Capability 06 // Whole-Site Read",
        title: "A live read of the entire site, on demand.",
        simple:
          "Ask for the state of everything at once and Ghost sweeps every camera to give you a single situational picture of the site right now.",
        steps: [
          "Trigger a site scan from one place.",
          "Ghost reads every connected feed in one pass.",
          "Get a single status picture with anything unusual called out.",
        ],
      },
      he: {
        kicker: "יכולת 06 // תמונת אתר מלאה",
        title: "קריאה חיה של כל האתר, לפי דרישה.",
        simple:
          "מבקשים את מצב הכול בבת אחת ו-Ghost סורק כל מצלמה כדי לתת לכם תמונת מצב אחת של האתר ממש עכשיו.",
        steps: [
          "מפעילים סריקת אתר ממקום אחד.",
          "Ghost קורא כל מקור מחובר במעבר אחד.",
          "מקבלים תמונת מצב אחת עם כל חריג מסומן.",
        ],
      },
    },
  },
  {
    id: "organize",
    demo: "organize",
    copy: {
      en: {
        kicker: "Capability 07 // Organize Your Cameras",
        title: "Group cameras the way your site is built.",
        simple:
          "Arrange cameras into zones, floors or sites so you can ask questions and set alerts for a whole area at once instead of camera by camera.",
        steps: [
          "Group your cameras into zones and sites in a simple tree.",
          "Ask questions or set alerts at the group level.",
          "Reorganize any time — the structure follows how you operate.",
        ],
      },
      he: {
        kicker: "יכולת 07 // לארגן את המצלמות",
        title: "מקבצים מצלמות בדיוק כמו שהאתר בנוי.",
        simple:
          "מסדרים מצלמות לאזורים, קומות או אתרים כדי לשאול שאלות ולהגדיר התרעות לאזור שלם בבת אחת, במקום מצלמה־מצלמה.",
        steps: [
          "מקבצים את המצלמות לאזורים ואתרים בעץ פשוט.",
          "שואלים שאלות או מגדירים התרעות ברמת הקבוצה.",
          "מארגנים מחדש בכל רגע — המבנה הולך לפי איך שאתם עובדים.",
        ],
      },
    },
  },
  {
    id: "systemPrompt",
    demo: "systemPrompt",
    copy: {
      en: {
        kicker: "Capability 08 // Set The Rules Of Engagement",
        title: "Tell Ghost how to think about your site.",
        simple:
          "Give Ghost standing instructions — what to prioritize, what to ignore, how to phrase answers — and it applies them to everything it watches.",
        steps: [
          "Write your site's standing instructions in plain language.",
          "Ghost applies them to every question, scan and alert.",
          "Update the instructions whenever your priorities change.",
        ],
      },
      he: {
        kicker: "יכולת 08 // לקבוע את כללי ההפעלה",
        title: "אומרים ל-Ghost איך לחשוב על האתר שלכם.",
        simple:
          "נותנים ל-Ghost הוראות קבע — מה לתעדף, מה להתעלם ממנו, איך לנסח תשובות — והוא מיישם אותן על כל מה שהוא צופה בו.",
        steps: [
          "כותבים את הוראות הקבע של האתר בשפה חופשית.",
          "Ghost מיישם אותן על כל שאלה, סריקה והתרעה.",
          "מעדכנים את ההוראות בכל פעם שהעדיפויות משתנות.",
        ],
      },
    },
  },
  {
    id: "memory",
    demo: "memory",
    copy: {
      en: {
        kicker: "Capability 09 // It Remembers",
        title: "Ghost keeps what matters about your site.",
        simple:
          "Ghost holds on to the context you give it — recurring people, vehicles and routines — so its answers get sharper the longer it runs.",
        steps: [
          "Tell Ghost the facts and routines that define your site.",
          "It keeps them as memory and uses them in every answer.",
          "Review or edit what it remembers at any time.",
        ],
      },
      he: {
        kicker: "יכולת 09 // הוא זוכר",
        title: "Ghost שומר את מה שחשוב על האתר שלכם.",
        simple:
          "Ghost מחזיק את ההקשר שאתם נותנים לו — דמויות, כלים ושגרות חוזרות — כך שהתשובות שלו מתחדדות ככל שהוא רץ זמן רב יותר.",
        steps: [
          "מספרים ל-Ghost את העובדות והשגרות שמגדירות את האתר.",
          "הוא שומר אותן כזיכרון ומשתמש בהן בכל תשובה.",
          "סוקרים או עורכים את מה שהוא זוכר בכל רגע.",
        ],
      },
    },
  },
];

// ── Chapters ──────────────────────────────────────────────────────────────────
// The nine capabilities are grouped into three thematic chapters. Each chapter
// references capabilities by id (see CAPABILITIES above); the order here drives
// the on-page sequence.
export interface CapabilityChapter {
  id: string;
  capabilityIds: string[];
  copy: Record<Locale, { kicker: string; title: string; intro: string }>;
}

export const CHAPTERS: CapabilityChapter[] = [
  {
    id: "ask",
    capabilityIds: ["chat", "cameras", "history"],
    copy: {
      en: {
        kicker: "Chapter 01 // Ask & Understand",
        title: "Talk to your cameras like you'd talk to an operator.",
        intro:
          "Ask in plain words and Ghost answers from what the cameras actually see — live or from the past — across one camera or the whole site.",
      },
      he: {
        kicker: "פרק 01 // לשאול ולהבין",
        title: "מדברים עם המצלמות כמו עם קצין מבצעים.",
        intro:
          "שואלים במילים פשוטות ו-Ghost עונה ממה שהמצלמות באמת רואות — בזמן אמת או מהעבר — על מצלמה אחת או על כל האתר.",
      },
    },
  },
  {
    id: "watch",
    capabilityIds: ["alerts", "broadcast", "siteScan"],
    copy: {
      en: {
        kicker: "Chapter 02 // Watch & Alert",
        title: "Let Ghost keep watch and speak up only when it matters.",
        intro:
          "Describe the exceptions you care about and Ghost watches every feed continuously, raises alerts with proof, and reads the whole site on demand.",
      },
      he: {
        kicker: "פרק 02 // לצפות ולהתריע",
        title: "נותנים ל-Ghost לשמור ולהתריע רק כשזה משנה.",
        intro:
          "מתארים את החריגים שחשובים לכם ו-Ghost צופה בכל מקור ברצף, מעלה התרעות עם הוכחה, וקורא את כל האתר לפי דרישה.",
      },
    },
  },
  {
    id: "shape",
    capabilityIds: ["organize", "systemPrompt", "memory"],
    copy: {
      en: {
        kicker: "Chapter 03 // Shape & Remember",
        title: "Tune Ghost to your site and let it learn over time.",
        intro:
          "Group cameras the way your site is built, give Ghost standing instructions, and let it keep the context that makes every answer sharper.",
      },
      he: {
        kicker: "פרק 03 // לעצב ולזכור",
        title: "מכווננים את Ghost לאתר שלכם ונותנים לו ללמוד עם הזמן.",
        intro:
          "מקבצים מצלמות כמו שהאתר בנוי, נותנים ל-Ghost הוראות קבע, ונותנים לו לשמור את ההקשר שמחדד כל תשובה.",
      },
    },
  },
];

// ── Recent highlights ─────────────────────────────────────────────────────────
// Optional `capabilityId` links a card to a capability section anchor on click.
export interface Highlight {
  capabilityId?: string;
  copy: Record<Locale, { tag: string; title: string; body: string }>;
}

export const HIGHLIGHTS: Highlight[] = [
  {
    capabilityId: "alerts",
    copy: {
      en: {
        tag: "Alerts",
        title: "Plain-language alerts",
        body: "Describe an exception once and Ghost raises it only when that exact situation appears — with the frame that proves it.",
      },
      he: {
        tag: "התרעות",
        title: "התרעות בשפה חופשית",
        body: "מתארים חריג פעם אחת ו-Ghost מעלה אותו רק כשהמצב הזה בדיוק מופיע — עם הפריים שמוכיח אותו.",
      },
    },
  },
  {
    capabilityId: "siteScan",
    copy: {
      en: {
        tag: "Whole-site read",
        title: "One-pass site scan",
        body: "Sweep every camera at once and get a single situational picture of the entire site right now.",
      },
      he: {
        tag: "תמונת אתר",
        title: "סריקת אתר במעבר אחד",
        body: "סורקים כל מצלמה בבת אחת ומקבלים תמונת מצב אחת של כל האתר ממש עכשיו.",
      },
    },
  },
  {
    capabilityId: "memory",
    copy: {
      en: {
        tag: "Memory",
        title: "It remembers your site",
        body: "Ghost holds on to recurring people, vehicles and routines so its answers get sharper the longer it runs.",
      },
      he: {
        tag: "זיכרון",
        title: "הוא זוכר את האתר שלכם",
        body: "Ghost מחזיק דמויות, כלים ושגרות חוזרות כך שהתשובות שלו מתחדדות ככל שהוא רץ זמן רב יותר.",
      },
    },
  },
];

// ── From the field ────────────────────────────────────────────────────────────
export interface OperatorQuote {
  copy: Record<Locale, { quote: string; name: string; role: string }>;
}

export const OPERATOR_QUOTES: OperatorQuote[] = [
  {
    copy: {
      en: {
        quote:
          "We stopped staring at a wall of screens. Ghost tells us where to look and shows the frame that proves it.",
        name: "Operations lead",
        role: "Logistics site",
      },
      he: {
        quote:
          "הפסקנו לבהות בקיר מסכים. Ghost אומר לנו איפה להסתכל ומראה את הפריים שמוכיח את זה.",
        name: "אחראי מבצעים",
        role: "אתר לוגיסטיקה",
      },
    },
  },
  {
    copy: {
      en: {
        quote:
          "Setting an alert is just describing what I care about. No rules engine, no false alarms all night.",
        name: "Security manager",
        role: "Retail chain",
      },
      he: {
        quote:
          "להגדיר התרעה זה פשוט לתאר מה חשוב לי. בלי מנוע חוקים ובלי אזעקות שווא כל הלילה.",
        name: "מנהל ביטחון",
        role: "רשת קמעונאות",
      },
    },
  },
  {
    copy: {
      en: {
        quote:
          "Asking what happened last night takes seconds now instead of scrubbing hours of footage.",
        name: "Shift supervisor",
        role: "Industrial facility",
      },
      he: {
        quote:
          "לשאול מה קרה אתמול בלילה לוקח עכשיו שניות במקום לגלול שעות של צילום.",
        name: "מפקח משמרת",
        role: "מתקן תעשייתי",
      },
    },
  },
];

// ── Changelog ─────────────────────────────────────────────────────────────────
// Newest first — the first entry is badged "Latest" on the page.
export interface ChangelogItem {
  date: string;
  copy: Record<Locale, { title: string; note: string }>;
}

export const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    date: "2025 · Q2",
    copy: {
      en: {
        title: "Whole-site scan",
        note: "Sweep every connected feed in a single pass and get one situational picture of the site.",
      },
      he: {
        title: "סריקת אתר מלאה",
        note: "סורקים כל מקור מחובר במעבר אחד ומקבלים תמונת מצב אחת של האתר.",
      },
    },
  },
  {
    date: "2025 · Q1",
    copy: {
      en: {
        title: "Plain-language alerts",
        note: "Write the condition you care about in words; Ghost runs it continuously and stays silent until it's met.",
      },
      he: {
        title: "התרעות בשפה חופשית",
        note: "כותבים את התנאי שחשוב לכם במילים; Ghost מריץ אותו ברצף ושותק עד שהוא מתקיים.",
      },
    },
  },
  {
    date: "2024 · Q4",
    copy: {
      en: {
        title: "Conversation memory",
        note: "Ghost keeps the recurring context of your site and applies it to every answer.",
      },
      he: {
        title: "זיכרון שיחה",
        note: "Ghost שומר את ההקשר החוזר של האתר ומיישם אותו בכל תשובה.",
      },
    },
  },
];
