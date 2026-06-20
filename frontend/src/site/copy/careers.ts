import type { Locale } from "../../stores/languageStore";

// ── Careers — bilingual page copy ──
// Tactical mono labels (the "Ghost // …" section labels, role meta chips and
// the footer brand line) are brand-signature English and stay hardcoded in
// the component; everything a visitor *reads* lives here, per locale.
// English is the original copy, byte-for-byte.

export interface CareersStatCopy {
  value: string;
  label: string;
}

export interface CareersCultureCopy {
  title: string;
  body: string;
}

// Role meta chips (team / location / type) render as tactical mono tags and
// stay English in both locales — they are kept here so the role stays one
// self-contained record, but the values are identical across locales.
export interface CareersRoleCopy {
  id: string;
  title: string;
  team: string;
  location: string;
  type: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
}

export interface CareersFormCopy {
  successTitle: string;
  successBody: (name: string) => string;
  formTitle: string;
  formBody: string;
  roleLabel: string;
  generalApplication: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  cvLabel: string;
  attachCv: (maxMb: number) => string;
  cvTooBig: (maxMb: number) => string;
  removeFile: string;
  messageLabel: string;
  messagePlaceholder: string;
  validation: string;
  genericError: string;
  submitting: string;
  submit: string;
  footnote: string;
}

export interface CareersCopy {
  heroTitle: string;
  heroBody: string;
  stats: CareersStatCopy[];
  cultureTitle: string;
  cultureBody: string;
  culture: CareersCultureCopy[];
  rolesTitle: string;
  rolesBody: (count: number) => string;
  applyNow: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  nudgeBody: string;
  applyAnyway: string;
  roles: CareersRoleCopy[];
  form: CareersFormCopy;
}

export const CAREERS_COPY: Record<Locale, CareersCopy> = {
  en: {
    heroTitle: "Building the future of video understanding.",
    heroBody:
      "Ghost turns security cameras into AI agents that understand what is happening and respond in real time. We are looking for exceptional people who want to build technology that changes the rules of the game.",
    stats: [
      { value: "2024", label: "Founded" },
      { value: "AI-First", label: "Technology approach" },
      { value: "Global", label: "Target market" },
      { value: "Hybrid", label: "Work model" },
    ],
    cultureTitle: "Why Ghost?",
    cultureBody:
      "Not just another startup. A small team with big ambitions, breakthrough technology, and a culture of excellence.",
    culture: [
      {
        title: "On the technology frontier",
        body: "Work with advanced AI models for video understanding — technology that is reshaping the market.",
      },
      {
        title: "Small team, big impact",
        body: "Everyone here directly shapes the product, the architecture, and the direction of development. No bureaucracy.",
      },
      {
        title: "Real challenges",
        body: "Problems with no ready-made solution — engineers building things that do not exist yet.",
      },
      {
        title: "Flexible work environment",
        body: "Hybrid format, a free schedule, and full trust. What matters is the outcome, not the hours at the desk.",
      },
      {
        title: "A culture of excellence",
        body: "High standards, deep code review, and a shared drive to build a world-class product.",
      },
      {
        title: "Constant learning",
        body: "A personal learning budget, conferences, and the chance to develop rare expertise in AI.",
      },
    ],
    rolesTitle: "Join the team.",
    rolesBody: (count) =>
      `${count} open positions. Found a fit? Send your CV and we will get back to you within 48 hours.`,
    applyNow: "Apply now",
    responsibilities: "Responsibilities",
    requirements: "Requirements",
    niceToHave: "Nice to have",
    nudgeBody:
      "Don't see the right role? We are always glad to meet exceptional people — send a general application.",
    applyAnyway: "Apply anyway",
    roles: [
      {
        id: "software-engineer",
        title: "Software Engineer",
        team: "Engineering",
        location: "Tel Aviv / Hybrid",
        type: "Full-time",
        summary:
          "We are looking for a software engineer to build the infrastructure that lets our AI agent analyze video in real time, hold natural-language conversations, and trigger smart automations — at the scale of thousands of cameras at once.",
        responsibilities: [
          "Build and maintain high-performance backend systems for real-time video processing",
          "Build a video-analysis pipeline based on language models and computer-vision models (VLM)",
          "Work with WebSocket, streaming, and event-driven architecture",
          "Optimize the performance, latency, and throughput of critical systems",
          "Integrate with camera systems (RTSP, ONVIF) and video protocols",
          "Write clean, documented, testable code with full test coverage",
        ],
        requirements: [
          "3+ years of backend development — Python, Node.js, or Go",
          "Experience with distributed and real-time systems",
          "Deep knowledge of Docker, Kubernetes, and cloud infrastructure",
          "Experience with databases (PostgreSQL, Redis, TimescaleDB)",
          "Strong understanding of systems architecture and system design",
          "Ability to work independently, make decisions, and high motivation",
        ],
        niceToHave: [
          "Experience with computer vision or video processing",
          "Familiarity with LLM APIs and prompt engineering",
          "Experience with FFmpeg, GStreamer, or streaming protocols",
          "Contributions to open-source projects",
        ],
      },
      {
        id: "ghost-expert",
        title: "Ghost Expert",
        team: "Growth",
        location: "Tel Aviv / Remote",
        type: "Full-time",
        summary:
          "We are looking for a Ghost Expert to lead the recruitment, onboarding, and ongoing support of Ghost's distributors and brand ambassadors — in Israel and around the world. You will be the bridge between our product and the growing partner network that brings Ghost to the world.",
        responsibilities: [
          "Recruit, onboard, and nurture a global network of Ghost distributors and ambassadors",
          "Build and maintain strong relationships with partners across different markets and cultures",
          "Develop training materials, playbooks, and sales tools for the partner network",
          "Collaborate with product and marketing teams to align partner messaging with the brand strategy",
          "Track partner performance metrics and optimize the distribution funnel",
          "Represent Ghost at professional events, exhibitions, and partner meetings worldwide",
        ],
        requirements: [
          "3+ years in partner management, channel sales, or business development",
          "Exceptional communication skills in English and Hebrew (additional languages — a major plus)",
          "Experience building and scaling partner / distributor networks",
          "Deep understanding of B2B SaaS sales cycles and channel strategies",
          "Independence and the ability to work across different time zones",
          "Passion for technology and AI — especially in security and video analysis",
        ],
        niceToHave: [
          "Background in the security / surveillance industry",
          "Experience with CRM and partner-management platforms (HubSpot, PartnerStack, etc.)",
          "An existing network of integrators, installers, or security professionals",
          "Experience working in a startup environment",
        ],
      },
    ],
    form: {
      successTitle: "Application received.",
      successBody: (name) =>
        `Thanks, ${name || "there"}. We have your CV and details — the team will review and get back to you within 48 hours.`,
      formTitle: "Apply to Ghost.",
      formBody:
        "Leave your phone and attach your CV. Found a specific role? Pick it below — otherwise send a general application.",
      roleLabel: "Role",
      generalApplication: "General application",
      nameLabel: "Full name",
      namePlaceholder: "Your full name",
      phoneLabel: "Phone",
      phonePlaceholder: "Mobile phone",
      emailLabel: "Email (optional)",
      emailPlaceholder: "you@email.com",
      cvLabel: "CV / Resume",
      attachCv: (maxMb) =>
        `Attach your CV — PDF, Word, RTF or text · up to ${maxMb} MB`,
      cvTooBig: (maxMb) => `CV must be ${maxMb} MB or smaller.`,
      removeFile: "Remove file",
      messageLabel: "Message (optional)",
      messagePlaceholder: "Anything you'd like us to know",
      validation:
        "Please enter your name, a valid phone number, and attach a CV.",
      genericError: "Something went wrong. Please try again.",
      submitting: "Submitting…",
      submit: "Submit application",
      footnote: "We'll only use your details to review your application.",
    },
  },
  he: {
    heroTitle: "בונים את העתיד של הבנת וידאו.",
    heroBody:
      "Ghost הופך מצלמות אבטחה לסוכני AI שמבינים מה קורה בסצנה ומגיבים בזמן אמת. אנחנו מחפשים אנשים יוצאי דופן שרוצים לבנות טכנולוגיה שמשנה את כללי המשחק.",
    stats: [
      { value: "2024", label: "שנת הקמה" },
      { value: "AI-First", label: "גישה טכנולוגית" },
      { value: "גלובלי", label: "שוק היעד" },
      { value: "היברידי", label: "מודל העבודה" },
    ],
    cultureTitle: "למה Ghost?",
    cultureBody:
      "לא עוד סטארטאפ. צוות קטן עם שאיפות גדולות, טכנולוגיה פורצת דרך ותרבות של מצוינות.",
    culture: [
      {
        title: "בחזית הטכנולוגיה",
        body: "עבודה עם מודלי AI מתקדמים להבנת וידאו — טכנולוגיה שמעצבת מחדש את השוק.",
      },
      {
        title: "צוות קטן, השפעה גדולה",
        body: "כל אחד כאן מעצב ישירות את המוצר, את הארכיטקטורה ואת כיוון הפיתוח. בלי בירוקרטיה.",
      },
      {
        title: "אתגרים אמיתיים",
        body: "בעיות בלי פתרון מדף — מהנדסים שבונים דברים שעוד לא קיימים.",
      },
      {
        title: "סביבת עבודה גמישה",
        body: "פורמט היברידי, לוח זמנים חופשי ואמון מלא. מה שקובע הוא התוצאה, לא השעות מול השולחן.",
      },
      {
        title: "תרבות של מצוינות",
        body: "סטנדרטים גבוהים, code review מעמיק ורצון משותף לבנות מוצר ברמה עולמית.",
      },
      {
        title: "למידה מתמדת",
        body: "תקציב למידה אישי, כנסים והזדמנות לפתח מומחיות נדירה ב-AI.",
      },
    ],
    rolesTitle: "הצטרפו לצוות.",
    rolesBody: (count) =>
      `${count} משרות פתוחות. מצאתם התאמה? שלחו קורות חיים ונחזור אליכם בתוך 48 שעות.`,
    applyNow: "הגשת מועמדות",
    responsibilities: "תחומי אחריות",
    requirements: "דרישות",
    niceToHave: "יתרון",
    nudgeBody:
      "לא מצאתם את התפקיד המתאים? אנחנו תמיד שמחים להכיר אנשים יוצאי דופן — שלחו מועמדות כללית.",
    applyAnyway: "הגישו מועמדות בכל מקרה",
    roles: [
      {
        id: "software-engineer",
        title: "מהנדס/ת תוכנה",
        team: "Engineering",
        location: "Tel Aviv / Hybrid",
        type: "Full-time",
        summary:
          "אנחנו מחפשים מהנדס/ת תוכנה לבניית התשתית שמאפשרת לסוכן ה-AI שלנו לנתח וידאו בזמן אמת, לנהל שיחות בשפה טבעית ולהפעיל אוטומציות חכמות — בקנה מידה של אלפי מצלמות במקביל.",
        responsibilities: [
          "בנייה ותחזוקה של מערכות backend בביצועים גבוהים לעיבוד וידאו בזמן אמת",
          "בניית pipeline להבנת וידאו על בסיס מודלי שפה ומודלים ויזואליים-לשוניים (VLM)",
          "עבודה עם WebSocket, streaming וארכיטקטורת event-driven",
          "אופטימיזציה של ביצועים, latency ו-throughput במערכות קריטיות",
          "אינטגרציה עם מערכות מצלמות (RTSP, ONVIF) ופרוטוקולי וידאו",
          "כתיבת קוד נקי, מתועד וניתן לבדיקה עם כיסוי טסטים מלא",
        ],
        requirements: [
          "ניסיון של 3+ שנים בפיתוח backend — Python, Node.js או Go",
          "ניסיון עם מערכות מבוזרות ומערכות זמן אמת",
          "ידע מעמיק ב-Docker, Kubernetes ותשתיות ענן",
          "ניסיון עם בסיסי נתונים (PostgreSQL, Redis, TimescaleDB)",
          "הבנה חזקה בארכיטקטורת מערכות וב-system design",
          "יכולת עבודה עצמאית, קבלת החלטות ומוטיבציה גבוהה",
        ],
        niceToHave: [
          "ניסיון בעיבוד וידאו או במודלים ויזואליים-לשוניים",
          "היכרות עם LLM APIs ועם prompt engineering",
          "ניסיון עם FFmpeg, GStreamer או פרוטוקולי streaming",
          "תרומה לפרויקטי קוד פתוח",
        ],
      },
      {
        id: "ghost-expert",
        title: "מומחה/ית Ghost",
        team: "Growth",
        location: "Tel Aviv / Remote",
        type: "Full-time",
        summary:
          "אנחנו מחפשים מומחה/ית Ghost שיובילו את הגיוס, הקליטה והליווי השוטף של המפיצים ושגרירי המותג של Ghost — בישראל וברחבי העולם. אתם תהיו הגשר בין המוצר שלנו לרשת השותפים הצומחת שמביאה את Ghost לעולם.",
        responsibilities: [
          "גיוס, קליטה וטיפוח של רשת גלובלית של מפיצים ושגרירים של Ghost",
          "בנייה ותחזוקה של קשרים חזקים עם שותפים בשווקים ובתרבויות שונים",
          "פיתוח חומרי הדרכה, playbooks וכלי מכירה לרשת השותפים",
          "עבודה משותפת עם צוותי המוצר והשיווק ליישור המסרים לשותפים עם אסטרטגיית המותג",
          "מעקב אחר מדדי ביצוע של שותפים ואופטימיזציה של משפך ההפצה",
          "ייצוג Ghost באירועים מקצועיים, בתערוכות ובמפגשי שותפים ברחבי העולם",
        ],
        requirements: [
          "ניסיון של 3+ שנים בניהול שותפים, channel sales או פיתוח עסקי",
          "יכולות תקשורת יוצאות דופן באנגלית ובעברית (שפות נוספות — יתרון משמעותי)",
          "ניסיון בבנייה ובהרחבה של רשתות שותפים ומפיצים",
          "הבנה עמוקה של מחזורי מכירה B2B SaaS ואסטרטגיות ערוצים",
          "עצמאות ויכולת עבודה מול אזורי זמן שונים",
          "תשוקה לטכנולוגיה ול-AI — בעיקר בעולמות הביטחון והבנת הווידאו",
        ],
        niceToHave: [
          "רקע בתעשיית הביטחון או מערכות המצלמות",
          "ניסיון עם CRM ופלטפורמות לניהול שותפים (HubSpot, PartnerStack וכדומה)",
          "רשת קיימת של אינטגרטורים, מתקינים או אנשי מקצוע בתחום האבטחה",
          "ניסיון בעבודה בסביבת סטארטאפ",
        ],
      },
    ],
    form: {
      successTitle: "המועמדות התקבלה.",
      successBody: (name) =>
        `תודה${name ? `, ${name}` : ""}. קורות החיים והפרטים אצלנו — הצוות יעבור עליהם ויחזור אליכם בתוך 48 שעות.`,
      formTitle: "הגשת מועמדות ל-Ghost.",
      formBody:
        "השאירו טלפון וצרפו קורות חיים. מצאתם תפקיד ספציפי? בחרו אותו למטה — אחרת שלחו מועמדות כללית.",
      roleLabel: "תפקיד",
      generalApplication: "מועמדות כללית",
      nameLabel: "שם מלא",
      namePlaceholder: "השם המלא שלכם",
      phoneLabel: "טלפון",
      phonePlaceholder: "טלפון נייד",
      emailLabel: "אימייל (לא חובה)",
      emailPlaceholder: "you@email.com",
      cvLabel: "קורות חיים",
      attachCv: (maxMb) =>
        `צירוף קורות חיים — PDF, Word, RTF או טקסט · עד ${maxMb} MB`,
      cvTooBig: (maxMb) => `קובץ קורות החיים חייב להיות עד ${maxMb} MB.`,
      removeFile: "הסרת קובץ",
      messageLabel: "הודעה (לא חובה)",
      messagePlaceholder: "כל מה שתרצו שנדע",
      validation: "הזינו שם, מספר טלפון תקין וצרפו קורות חיים.",
      genericError: "משהו השתבש. נסו שוב.",
      submitting: "שולח…",
      submit: "שליחת מועמדות",
      footnote: "נשתמש בפרטים רק לבחינת המועמדות שלכם.",
    },
  },
};
