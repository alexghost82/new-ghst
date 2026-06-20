import type { Locale } from "../../stores/languageStore";

// ── Operator Training — bilingual page copy ──
// Tactical mono labels (the "Ghost Academy · …" kicker pill, "Syllabus // …"
// section labels, the classification footer) are brand-signature English and
// stay hardcoded in the component; everything a visitor *reads* lives here,
// per locale. English is the original copy, byte-for-byte. Icons and module
// numbers stay structural in the component and are zipped positionally.

export interface TrainingModuleCopy {
  num: string;
  title: string;
  // Pre-rendered "<n> lessons" label (mono strip on the card).
  lessonsLabel: string;
  summary: string;
  outcomes: string[];
}

export interface TrainingFactCopy {
  v: string;
  // Primary readable label + one-line clarifier shown on the hero fact card.
  l: string;
  sub: string;
  // In-page anchor of the spine station this fact heads (cards are links).
  anchor: string;
}

export interface TrainingPointCopy {
  title: string;
  desc: string;
}

export interface TrainingDrillCopy {
  title: string;
  // Booklet part the drill belongs to ("02".."09") — rendered as mono chrome.
  part: string;
}

export interface TrainingCapstoneCopy {
  title: string;
  meta: string;
  desc: string;
}

export interface TrainingHighlightCopy {
  title: string;
  desc: string;
}

export interface TrainingCopy {
  accessLabel: string;
  heroTitle: string;
  heroTitleSub: string;
  heroBody: string;
  joinWaitlist: string;
  viewSyllabus: string;
  heroNote: string;
  facts: TrainingFactCopy[];
  syllabusTitle: string;
  syllabusBody: string;
  syllabus: TrainingModuleCopy[];
  lessonsTitle: string;
  lessonsBody: string;
  lessonsPoints: TrainingPointCopy[];
  drillsTitle: string;
  drillsBody: string;
  drills: TrainingDrillCopy[];
  examTitle: string;
  examBody: string;
  capstones: TrainingCapstoneCopy[];
  examFootnote: string;
  outcomesTitle: string;
  highlights: TrainingHighlightCopy[];
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  ctaFootnote: string;
}

export const TRAINING_COPY: Record<Locale, TrainingCopy> = {
  en: {
    accessLabel: "Request access",
    heroTitle: "Your cameras see everything.",
    heroTitleSub: "Learn to question them.",
    heroBody:
      "The Operator Training Program takes you from your first question to running an entire site: ten parts, fifty lessons, fourteen hands-on field drills, and a practical certification exam — every control in the Ghost console, taught the way operators actually work.",
    joinWaitlist: "Join the next cohort waitlist",
    viewSyllabus: "View the syllabus",
    heroNote:
      "Leave your details — the full 50-page booklet downloads immediately.",
    facts: [
      {
        v: "10",
        l: "Course parts",
        sub: "What you learn, in order",
        anchor: "syllabus",
      },
      {
        v: "50",
        l: "Lessons, one per page",
        sub: "Performed on a live console",
        anchor: "lessons",
      },
      {
        v: "14",
        l: "Hands-on field drills",
        sub: "Each with a pass condition",
        anchor: "drills",
      },
      {
        v: "90 min",
        l: "Practical certification exam",
        sub: "Ghost Certified Operator",
        anchor: "exam",
      },
    ],
    syllabusTitle: "From your first question to running an entire site.",
    syllabusBody:
      "Lessons build on each other — conversation before cameras, cameras before structure, structure before the watch. Each lesson is performed on a live console, and each drill has a pass condition.",
    syllabus: [
      {
        num: "01",
        title: "Welcome & Orientation",
        lessonsLabel: "3 lessons",
        summary:
          "How the program works, how you are evaluated, and the full map of the road from first question to certification.",
        outcomes: ["Program structure & drills", "Certification requirements"],
      },
      {
        num: "02",
        title: "Doctrine & First Entry",
        lessonsLabel: "4 lessons",
        summary:
          "What Ghost is — understanding, not detection — the operator's role, the 3CLICKS principle, and signing in to the console.",
        outcomes: [
          "Past / present / future doctrine",
          "Secure Access & quick-login links",
        ],
      },
      {
        num: "03",
        title: "The Conversation Core",
        lessonsLabel: "7 lessons",
        summary:
          "Your first conversation, the craft of asking operational questions, the composer, the thread's evidence layers, standing instructions, and per-conversation tuning.",
        outcomes: [
          "Question phrasing doctrine",
          "System prompts & response tuning",
        ],
      },
      {
        num: "04",
        title: "Cameras & the Live Stage",
        lessonsLabel: "7 lessons",
        summary:
          "Attaching cameras, saved setups versus live sessions, the live stage, enhanced views with zoom and pan, recording, audio, and how frames are sampled.",
        outcomes: [
          "Camera binding discipline",
          "Evidence capture: clips & frames",
        ],
      },
      {
        num: "05",
        title: "Organizing a Site at Scale",
        lessonsLabel: "5 lessons",
        summary:
          "Areas, camera groups, drag-and-drop order, zone-wide broadcast questions, and the sweep rhythm of a well-run shift.",
        outcomes: [
          "Site tree that mirrors the ground",
          "One question across a whole zone",
        ],
      },
      {
        num: "06",
        title: "Standing Alerts",
        lessonsLabel: "6 lessons",
        summary:
          "Plain-language watch rules, arming and connection tests, watch health, the full-screen alarm procedure, and the permanent alert record.",
        outcomes: [
          "Rules that fire on deviations, not noise",
          "Mute → verify → acknowledge",
        ],
      },
      {
        num: "07",
        title: "Incident Management",
        lessonsLabel: "4 lessons",
        summary:
          "The incident board, the case workspace — timeline, evidence, notes, assignment — AI investigation drafts, and disciplined closure.",
        outcomes: [
          "Casework that survives an audit",
          "AI-drafted, operator-signed summaries",
        ],
      },
      {
        num: "08",
        title: "Memory & Site Intelligence",
        lessonsLabel: "5 lessons",
        summary:
          "Tracking, observations and facts, one-press Site Intelligence reports, questioning the past, the knowledge base, and memory hygiene.",
        outcomes: [
          "History you can interrogate",
          "Answers that cite your own SOPs",
        ],
      },
      {
        num: "09",
        title: "Settings & Daily Operations",
        lessonsLabel: "4 lessons",
        summary:
          "Operator accounts and attribution, quick-login links instead of shared keys, hands-free voice command, language, theme and the learning center.",
        outcomes: ["Shared-console discipline", "Hands-free operation"],
      },
      {
        num: "10",
        title: "The Operator's Craft & Certification",
        lessonsLabel: "5 lessons",
        summary:
          "The professional shift routine, the troubleshooting field guide, security and privacy non-negotiables, four capstone exercises, and the practical exam.",
        outcomes: ["Full-shift capstones", "Ghost Certified Operator exam"],
      },
    ],
    lessonsTitle: "One page. One capability. Performed, not read.",
    lessonsBody:
      "Every lesson is framed the way you will actually work — a question to Ghost, and Ghost's answer. You read it, perform it on a live console, and repeat until it is muscle memory.",
    lessonsPoints: [
      {
        title: "One capability per lesson",
        desc: "What it does, where it lives on screen, and when a professional reaches for it.",
      },
      {
        title: "Performed on a live console",
        desc: "Every lesson is designed to be performed with a real camera, not just read.",
      },
      {
        title: "Built in strict order",
        desc: "Conversation before cameras, cameras before structure, structure before the watch. No skipping ahead.",
      },
      {
        title: "Doctrine notes throughout",
        desc: "The reasoning behind the interface — knowing why makes you faster when something unexpected happens.",
      },
    ],
    drillsTitle: "Fourteen drills. Fourteen pass conditions.",
    drillsBody:
      "Marked exercises performed on a live console with a real camera. Each drill has a pass condition — you do not move on until you meet it. Together they cover everything an operator does on shift.",
    drills: [
      { title: "Write your site's three questions", part: "02" },
      { title: "Three conversations in three minutes", part: "03" },
      { title: "Same question, two modes", part: "03" },
      { title: "Naming sweep", part: "03" },
      { title: "Write one standing order, prove it holds", part: "03" },
      { title: "Attach, ask, verify", part: "04" },
      { title: "The evidence sandwich", part: "04" },
      { title: "Build your site tree", part: "05" },
      { title: "The five-minute sweep", part: "05" },
      { title: "First armed watch", part: "06" },
      { title: "Narrate an alert end-to-end", part: "06" },
      { title: "Case work, end to end", part: "07" },
      { title: "Reconstruct an hour", part: "08" },
      { title: "Console personalization pass", part: "09" },
    ],
    examTitle: "Four capstones, then ninety minutes that count.",
    examBody:
      "Part X closes the program: four full-shift capstone exercises run under a supervising operator, then a timed, scenario-based practical exam on a live site. Pass it and you are a Ghost Certified Operator.",
    capstones: [
      {
        title: "Cold start",
        meta: "20 min",
        desc: "A fresh console: build a two-area tree, attach and save cameras, write standing instructions for two posts.",
      },
      {
        title: "The watch",
        meta: "20 min",
        desc: "Arm two posts, trigger one rule legitimately on camera, work the full alarm procedure, close the incident with a signed summary.",
      },
      {
        title: "The investigation",
        meta: "15 min",
        desc: "Reconstruct the last two hours of a busy conversation using questions only — no scrolling.",
      },
      {
        title: "The sweep under pressure",
        meta: "10 min",
        desc: "A complete multi-area broadcast sweep and a written handover — while handling any alarm that fires mid-sweep.",
      },
    ],
    examFootnote: "All four capstones are required before you sit the exam.",
    outcomesTitle: "A certified operator runs the room, not the mouse.",
    highlights: [
      {
        title: "Question any camera like a colleague",
        desc: "Operational phrasing that turns feeds into decisions — \u201cIs the fire lane at dock 3 clear?\u201d, not object lists.",
      },
      {
        title: "Run standing watches that hold",
        desc: "Plain-language rules, armed and verified, that interrupt only on real deviations — and a calm alarm procedure when they do.",
      },
      {
        title: "Produce evidence, not impressions",
        desc: "Threads, frames, clips and incident timelines that read as one continuous, attributable record.",
      },
      {
        title: "Command an entire site",
        desc: "Area trees, zone-wide broadcast sweeps, and a handover your relief can absorb in five minutes.",
      },
    ],
    ctaTitle: "Reserve your seat.",
    ctaBody:
      "Join the waitlist for the next operator certification cohort and get the complete training booklet — all ten parts, fifty lessons and fourteen drills — as a PDF, immediately.",
    ctaButton: "Join the waitlist & download the syllabus",
    ctaFootnote: "We'll only use your details to coordinate the next cohort",
  },
  he: {
    accessLabel: "בקשת גישה",
    heroTitle: "המצלמות שלכם רואות הכל.",
    heroTitleSub: "למדו לתשאל אותן.",
    heroBody:
      "תוכנית הכשרת המפעילים לוקחת אתכם מהשאלה הראשונה ועד תפעול אתר שלם: עשרה חלקים, חמישים שיעורים, ארבעה-עשר תרגילי שטח מעשיים ומבחן הסמכה מעשי — כל פקד בקונסול של Ghost, נלמד כפי שמפעילים באמת עובדים.",
    joinWaitlist: "הצטרפות לרשימת ההמתנה למחזור הבא",
    viewSyllabus: "צפייה בסילבוס",
    heroNote: "השאירו פרטים — חוברת ההכשרה המלאה בת 50 העמודים יורדת מיד.",
    facts: [
      {
        v: "10",
        l: "חלקי הקורס",
        sub: "מה לומדים, לפי הסדר",
        anchor: "syllabus",
      },
      {
        v: "50",
        l: "שיעורים, אחד לעמוד",
        sub: "מבוצעים על קונסול חי",
        anchor: "lessons",
      },
      {
        v: "14",
        l: "תרגילי שטח מעשיים",
        sub: "לכל תרגיל תנאי מעבר",
        anchor: "drills",
      },
      {
        v: "90 דק'",
        l: "מבחן הסמכה מעשי",
        sub: "Ghost Certified Operator",
        anchor: "exam",
      },
    ],
    syllabusTitle: "מהשאלה הראשונה ועד תפעול אתר שלם.",
    syllabusBody:
      "השיעורים נבנים זה על גבי זה — שיחה לפני מצלמות, מצלמות לפני מבנה, מבנה לפני משימת הצפייה. כל שיעור מתבצע על קונסול חי, ולכל תרגיל תנאי מעבר.",
    syllabus: [
      {
        num: "01",
        title: "פתיחה והתמצאות",
        lessonsLabel: "3 שיעורים",
        summary:
          "איך התוכנית עובדת, איך אתם מוערכים, ומפת הדרך המלאה מהשאלה הראשונה ועד ההסמכה.",
        outcomes: ["מבנה התוכנית והתרגילים", "דרישות ההסמכה"],
      },
      {
        num: "02",
        title: "דוקטרינה וכניסה ראשונה",
        lessonsLabel: "4 שיעורים",
        summary:
          "מה זה Ghost — הבנה, לא זיהוי — תפקיד המפעיל, עקרון 3CLICKS, והכניסה לקונסול.",
        outcomes: [
          "דוקטרינת עבר / הווה / עתיד",
          "Secure Access וקישורי כניסה מהירה",
        ],
      },
      {
        num: "03",
        title: "ליבת השיחה",
        lessonsLabel: "7 שיעורים",
        summary:
          "השיחה הראשונה שלכם, מלאכת ניסוח שאלות מבצעיות, שורת הכתיבה, שכבות הראיות של השרשור, הנחיות קבועות וכוונון לכל שיחה.",
        outcomes: ["דוקטרינת ניסוח שאלות", "הנחיות מערכת וכוונון תגובות"],
      },
      {
        num: "04",
        title: "מצלמות והבמה החיה",
        lessonsLabel: "7 שיעורים",
        summary:
          "חיבור מצלמות, תצורות שמורות מול סשנים חיים, הבמה החיה, תצוגות משופרות עם זום וסריקה, הקלטה, שמע, ואיך פריימים נדגמים.",
        outcomes: ["משמעת קישור מצלמות", "איסוף ראיות: קליפים ופריימים"],
      },
      {
        num: "05",
        title: "ארגון אתר בקנה מידה מלא",
        lessonsLabel: "5 שיעורים",
        summary:
          "אזורים, קבוצות מצלמות, סדר בגרירה, שאלות שידור לאזור שלם, וקצב הסריקה של משמרת מנוהלת היטב.",
        outcomes: ["עץ אתר שמשקף את השטח", "שאלה אחת על פני אזור שלם"],
      },
      {
        num: "06",
        title: "התראות קבועות",
        lessonsLabel: "6 שיעורים",
        summary:
          "חוקי צפייה בשפה חופשית, דריכה ובדיקות חיבור, תקינות משימת הצפייה, נוהל האזעקה במסך מלא, ותיעוד ההתראות הקבוע.",
        outcomes: ["חוקים שנדרכים על חריגות, לא על רעש", "השתקה ← אימות ← אישור"],
      },
      {
        num: "07",
        title: "ניהול אירועים",
        lessonsLabel: "4 שיעורים",
        summary:
          "לוח האירועים, סביבת העבודה של התיק — ציר זמן, ראיות, הערות, שיוך — טיוטות תחקיר של AI, וסגירה ממושמעת.",
        outcomes: ["ניהול תיקים שעומד בביקורת", "סיכומים שה-AI מנסח והמפעיל חותם"],
      },
      {
        num: "08",
        title: "זיכרון ומודיעין אתר",
        lessonsLabel: "5 שיעורים",
        summary:
          "מעקב, תצפיות ועובדות, דוחות מודיעין אתר בלחיצה אחת, תשאול העבר, מאגר הידע, והיגיינת זיכרון.",
        outcomes: ["היסטוריה שאפשר לתחקר", "תשובות שמצטטות את הנהלים שלכם"],
      },
      {
        num: "09",
        title: "הגדרות ותפעול יומי",
        lessonsLabel: "4 שיעורים",
        summary:
          "חשבונות מפעילים ושיוך פעולות, קישורי כניסה מהירה במקום מפתחות משותפים, פיקוד קולי ללא ידיים, שפה, ערכת נושא ומרכז הלמידה.",
        outcomes: ["משמעת קונסול משותף", "תפעול ללא ידיים"],
      },
      {
        num: "10",
        title: "מקצועיות המפעיל וההסמכה",
        lessonsLabel: "5 שיעורים",
        summary:
          "שגרת המשמרת המקצועית, מדריך השטח לפתרון תקלות, קווים אדומים של אבטחה ופרטיות, ארבעה תרגילי גמר, והמבחן המעשי.",
        outcomes: ["תרגילי גמר של משמרת מלאה", "מבחן Ghost Certified Operator"],
      },
    ],
    lessonsTitle: "עמוד אחד. יכולת אחת. מבוצע, לא רק נקרא.",
    lessonsBody:
      "כל שיעור מנוסח כפי שתעבדו באמת — שאלה ל-Ghost, והתשובה של Ghost. קוראים אותו, מבצעים אותו על קונסול חי, וחוזרים עליו עד שהוא הופך לזיכרון שריר.",
    lessonsPoints: [
      {
        title: "יכולת אחת בכל שיעור",
        desc: "מה היא עושה, איפה היא יושבת על המסך, ומתי מפעיל מקצועי שולח אליה יד.",
      },
      {
        title: "מבוצע על קונסול חי",
        desc: "כל שיעור בנוי כך שמבצעים אותו עם מצלמה אמיתית — לא רק קוראים.",
      },
      {
        title: "נבנים בסדר קפדני",
        desc: "שיחה לפני מצלמות, מצלמות לפני מבנה, מבנה לפני משימת הצפייה. בלי לדלג קדימה.",
      },
      {
        title: "הערות דוקטרינה לאורך הדרך",
        desc: "ההיגיון שמאחורי הממשק — מי שיודע למה, מגיב מהר יותר כשמשהו לא צפוי קורה.",
      },
    ],
    drillsTitle: "ארבעה-עשר תרגילים. ארבעה-עשר תנאי מעבר.",
    drillsBody:
      "תרגילים מסומנים שמבוצעים על קונסול חי עם מצלמה אמיתית. לכל תרגיל תנאי מעבר — לא ממשיכים הלאה בלי לעמוד בו. יחד הם מכסים את כל מה שמפעיל עושה במשמרת.",
    drills: [
      { title: "כתבו את שלוש השאלות של האתר שלכם", part: "02" },
      { title: "שלוש שיחות בשלוש דקות", part: "03" },
      { title: "אותה שאלה, שני מצבים", part: "03" },
      { title: "סבב שמות", part: "03" },
      { title: "הוראת קבע אחת, והוכחה שהיא מחזיקה", part: "03" },
      { title: "חברו, שאלו, אמתו", part: "04" },
      { title: "כריך הראיות", part: "04" },
      { title: "בנו את עץ האתר שלכם", part: "05" },
      { title: "סריקת חמש הדקות", part: "05" },
      { title: "משימת הצפייה הדרוכה הראשונה", part: "06" },
      { title: "תיעוד התראה מקצה לקצה", part: "06" },
      { title: "ניהול תיק, מקצה לקצה", part: "07" },
      { title: "שחזור שעה", part: "08" },
      { title: "סבב התאמה אישית של הקונסול", part: "09" },
    ],
    examTitle: "ארבעה תרגילי גמר, ואז תשעים דקות שקובעות.",
    examBody:
      "חלק X סוגר את התוכנית: ארבעה תרגילי גמר של משמרת מלאה בהשגחת מפעיל מנוסה, ואז מבחן מעשי מתוזמן, מבוסס-תרחישים, על אתר חי. עוברים אותו — ואתם Ghost Certified Operator.",
    capstones: [
      {
        title: "התנעה קרה",
        meta: "20 דק'",
        desc: "קונסול נקי: בניית עץ של שני אזורים, חיבור ושמירת מצלמות, וכתיבת הנחיות קבועות לשתי עמדות.",
      },
      {
        title: "משימת הצפייה",
        meta: "20 דק'",
        desc: "דריכת שתי עמדות, הפעלה אמיתית של חוק אחד מול המצלמה, ביצוע נוהל האזעקה המלא וסגירת האירוע בסיכום חתום.",
      },
      {
        title: "התחקיר",
        meta: "15 דק'",
        desc: "שחזור השעתיים האחרונות של שיחה עמוסה באמצעות שאלות בלבד — בלי גלילה.",
      },
      {
        title: "סריקה תחת לחץ",
        meta: "10 דק'",
        desc: "סריקת שידור מלאה על פני כמה אזורים והעברת משמרת כתובה — תוך טיפול נכון בכל אזעקה שנופלת באמצע.",
      },
    ],
    examFootnote: "כל ארבעת תרגילי הגמר נדרשים לפני הגישה למבחן.",
    outcomesTitle: "מפעיל מוסמך מנהל את החדר, לא את העכבר.",
    highlights: [
      {
        title: "לתשאל כל מצלמה כמו עמית",
        desc: "ניסוח מבצעי שהופך פידים להחלטות — \"האם נתיב הכיבוי ברציף 3 פנוי?\", לא רשימות אובייקטים.",
      },
      {
        title: "להריץ משימות צפייה קבועות שמחזיקות",
        desc: "חוקים בשפה חופשית, דרוכים ומאומתים, שקוטעים רק על חריגות אמיתיות — ונוהל אזעקה רגוע כשזה קורה.",
      },
      {
        title: "להפיק ראיות, לא התרשמויות",
        desc: "שרשורים, פריימים, קליפים וצירי זמן של אירועים שנקראים כתיעוד אחד רציף וניתן לשיוך.",
      },
      {
        title: "לפקד על אתר שלם",
        desc: "עצי אזורים, סריקות שידור לאזורים שלמים, והעברת משמרת שהמחליף שלכם קולט בחמש דקות.",
      },
    ],
    ctaTitle: "שריינו את המקום שלכם.",
    ctaBody:
      "הצטרפו לרשימת ההמתנה למחזור ההסמכה הבא של המפעילים וקבלו את חוברת ההכשרה המלאה — כל עשרת החלקים, חמישים השיעורים וארבעה-עשר התרגילים — כ-PDF, מיד.",
    ctaButton: "הצטרפות לרשימת ההמתנה והורדת הסילבוס",
    ctaFootnote: "נשתמש בפרטים שלכם רק לתיאום המחזור הבא",
  },
};
