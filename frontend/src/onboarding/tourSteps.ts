import type { Locale } from "../stores/languageStore";

// ---------------------------------------------------------------------------
// Ghost guided onboarding — "תוכנית הלמידה הראשונה".
//
// The course is a sequence of chapters; each chapter is a sequence of spotlight
// steps. A step points at a DOM element via its ``data-tour`` attribute (or is
// a centered modal when ``target`` is null) and optionally declares which app
// ``surface`` (panel/view) must be open for its target to exist. App.tsx reads
// the active step's ``surface`` and opens the matching panel.
//
// Content is bilingual (he/en) and co-located here so the whole curriculum is
// editable in one place.
// ---------------------------------------------------------------------------

export type ChapterId =
  | "welcome"
  | "sidebar"
  | "header"
  | "cameras"
  | "composer"
  | "messages"
  | "memory"
  | "alerts"
  | "settings"
  | "advanced"
  | "graduation";

/** Which app surface must be open for the step's target to be reachable. */
export type Surface =
  | "none"
  | "memory"
  | "alert"
  | "settings"
  | "systemPrompt"
  | "incidents";

export type Placement = "top" | "bottom" | "left" | "right" | "center";

export interface Localized {
  he: string;
  en: string;
}

export interface TourStep {
  id: string;
  /** ``data-tour`` value of the element to highlight, or null for a centered card. */
  target: string | null;
  title: Localized;
  body: Localized;
  placement?: Placement;
  surface?: Surface;
}

export interface TourChapter {
  id: ChapterId;
  /** lucide icon name resolved in the Hub. */
  icon: string;
  title: Localized;
  summary: Localized;
  steps: TourStep[];
}

export function localized(value: Localized, locale: Locale): string {
  return value[locale];
}

export const TOUR_CHAPTERS: TourChapter[] = [
  {
    id: "welcome",
    icon: "Compass",
    title: { he: "ברוכים הבאים", en: "Welcome" },
    summary: {
      he: "סקירה כללית של המסך והפריסה.",
      en: "A quick tour of the screen and layout.",
    },
    steps: [
      {
        id: "welcome-intro",
        target: null,
        placement: "center",
        surface: "none",
        title: { he: "ברוכים הבאים ל-Ghost", en: "Welcome to Ghost" },
        body: {
          he: "זוהי תוכנית הלמידה הראשונה. נעבור יחד על כל יכולת וכל כפתור במסך. אפשר לעצור בכל רגע ולהמשיך בדיוק מהמקום שבו עצרת — או להתחיל מחדש מתי שתרצה.",
          en: "This is your first learning program. We'll walk through every capability and button on the screen. You can stop anytime and continue exactly where you left off — or restart whenever you like.",
        },
      },
      {
        id: "welcome-sidebar",
        target: "sidebar-conversations",
        placement: "right",
        surface: "none",
        title: { he: "תפריט השיחות", en: "Conversation menu" },
        body: {
          he: "כאן מנוהלות כל השיחות שלך. כל שיחה מייצגת מצלמה, אזור או חקירה. בהמשך נראה איך לארגן אותן לקבוצות ואזורים.",
          en: "All your conversations live here. Each one represents a camera, an area, or an investigation. We'll see how to organize them into groups and areas.",
        },
      },
      {
        id: "welcome-chat",
        target: "message-list",
        placement: "left",
        surface: "none",
        title: { he: "אזור השיחה", en: "The conversation" },
        body: {
          he: "במרכז מתנהל הדיאלוג עם Ghost — שאלות, תשובות, פריימים מהמצלמה והתראות. כאן מתרכזת כל האינטליגנציה.",
          en: "The center is your dialogue with Ghost — questions, answers, camera frames and alerts. This is where all the intelligence comes together.",
        },
      },
      {
        id: "welcome-composer",
        target: "composer-bar",
        placement: "top",
        surface: "none",
        title: { he: "שורת הכתיבה", en: "The composer" },
        body: {
          he: "מכאן שולחים הודעות ל-Ghost, מפעילים מצלמה חיה ומדברים בקול. נצלול לכל אחד מהם בהמשך.",
          en: "From here you message Ghost, turn on a live camera and talk by voice. We'll dive into each of these soon.",
        },
      },
    ],
  },
  {
    id: "sidebar",
    icon: "PanelLeft",
    title: { he: "תפריט הצד", en: "Sidebar" },
    summary: {
      he: "שיחות, אזורים, קבוצות, משתמשים והגדרות.",
      en: "Conversations, areas, groups, users and settings.",
    },
    steps: [
      {
        id: "sidebar-tabs",
        target: "sidebar-tabs",
        placement: "right",
        surface: "none",
        title: { he: "צ'אט ואירועים", en: "Chat & Incidents" },
        body: {
          he: "שתי הלשוניות מחליפות בין מצב הצ'אט לבין לוח ניהול האירועים. כשנפתח אירוע התראה חדש, יופיע כאן מונה.",
          en: "These two tabs switch between chat mode and the incident management board. A counter appears here when a new alert incident opens.",
        },
      },
      {
        id: "sidebar-new-chat",
        target: "sidebar-new-chat",
        placement: "bottom",
        surface: "none",
        title: { he: "שיחה חדשה", en: "New conversation" },
        body: {
          he: "פותח שיחה חדשה ונקייה. כל שיחה יכולה לקבל מצלמות, כללי התראה וזיכרון משלה.",
          en: "Opens a fresh conversation. Each conversation can have its own cameras, alert rules and memory.",
        },
      },
      {
        id: "sidebar-tree",
        target: "sidebar-conversations",
        placement: "right",
        surface: "none",
        title: { he: "ארגון לאזורים וקבוצות", en: "Areas & groups" },
        body: {
          he: "אפשר לגרור שיחות לקבוצות ואזורים, לשנות שם, למחוק, ולשדר הודעה אחת לכל המצלמות באזור או בקבוצה בלחיצה על שמם.",
          en: "Drag conversations into groups and areas, rename, delete, and broadcast one message to every camera in an area or group by clicking its name.",
        },
      },
      {
        id: "sidebar-user",
        target: "sidebar-user",
        placement: "top",
        surface: "none",
        title: { he: "בחירת משתמש", en: "User picker" },
        body: {
          he: "מחליף בין המשתמשים המוגדרים. לכל משתמש סט שיחות, מצלמות והגדרות נפרד.",
          en: "Switch between configured users. Each user has its own set of conversations, cameras and settings.",
        },
      },
      {
        id: "sidebar-settings",
        target: "sidebar-settings",
        placement: "top",
        surface: "none",
        title: { he: "הגדרות", en: "Settings" },
        body: {
          he: "פותח את חלון ההגדרות — ניהול משתמשים, לינק כניסה מהירה ופקודת קול. נחזור לזה בפרק ההגדרות.",
          en: "Opens the settings window — user management, quick login link and voice command. We'll return to it in the Settings chapter.",
        },
      },
      {
        id: "sidebar-logout",
        target: "sidebar-logout",
        placement: "top",
        surface: "none",
        title: { he: "התנתקות", en: "Log out" },
        body: {
          he: "מסיים את ה-session ומחזיר לאתר הציבורי. ב-session הדגמה הזמן מוגבל וגם פג אוטומטית.",
          en: "Ends the session and returns to the public site. In a demo session the time is limited and also expires automatically.",
        },
      },
    ],
  },
  {
    id: "header",
    icon: "PanelTop",
    title: { he: "כותרת השיחה", en: "Chat header" },
    summary: {
      he: "שפה, ערכת נושא וכלי האינטליגנציה.",
      en: "Language, theme and the intelligence tools.",
    },
    steps: [
      {
        id: "header-language",
        target: "header-language",
        placement: "bottom",
        surface: "none",
        title: { he: "שפת הממשק", en: "Interface language" },
        body: {
          he: "מחליף בין עברית לאנגלית. הכיווניות (RTL/LTR) מתעדכנת אוטומטית בכל הממשק.",
          en: "Switches between Hebrew and English. Text direction (RTL/LTR) updates automatically across the interface.",
        },
      },
      {
        id: "header-theme",
        target: "header-theme",
        placement: "bottom",
        surface: "none",
        title: { he: "מצב כהה / בהיר", en: "Dark / light mode" },
        body: {
          he: "מחליף בין ערכת נושא כהה לבהירה, לפי תנאי התאורה והעדפתך.",
          en: "Toggles between dark and light themes to match your lighting and preference.",
        },
      },
      {
        id: "header-site-intel",
        target: "header-site-intel",
        placement: "bottom",
        surface: "none",
        title: { he: "Sitelligence℠", en: "Sitelligence℠" },
        body: {
          he: "מצלם פריים חי מהמצלמה ושולח ל-Ghost לניתוח סביבה מלא — מי ומה נמצאים בזירה ברגע זה.",
          en: "Captures a live frame from the camera and sends it to Ghost for a full scene analysis — who and what is on site right now.",
        },
      },
      {
        id: "header-memory-btn",
        target: "header-memory",
        placement: "bottom",
        surface: "none",
        title: { he: "פאנל הזיכרון", en: "Memory panel" },
        body: {
          he: "פותח את פאנל הזיכרון — מעקב, תצפיות ועובדות שנצברו על הזירה. נעבור עליו לעומק בפרק הזיכרון.",
          en: "Opens the memory panel — tracking, observations and facts accumulated about the site. We'll explore it in the Memory chapter.",
        },
      },
      {
        id: "header-alert-btn",
        target: "header-alert",
        placement: "bottom",
        surface: "none",
        title: { he: "מצב התראה", en: "Alert mode" },
        body: {
          he: "פותח את פאנל ההתראות. הנקודה הקטנה על האייקון מציינת אם מצב ההתראה פעיל ותקין. נרחיב בפרק ההתראות.",
          en: "Opens the alerts panel. The small dot on the icon shows whether alert mode is active and healthy. More in the Alerts chapter.",
        },
      },
      {
        id: "header-system-prompt",
        target: "header-system-prompt",
        placement: "bottom",
        surface: "none",
        title: { he: "הנחיית מערכת", en: "System prompt" },
        body: {
          he: "עורך את הנחיית המערכת של Ghost לשיחה זו — כך מכווננים את אופי התשובות וההתנהגות.",
          en: "Edits Ghost's system prompt for this conversation — this is how you tune its behavior and the tone of its answers.",
        },
      },
    ],
  },
  {
    id: "cameras",
    icon: "Cctv",
    title: { he: "מצלמות ושידור חי", en: "Cameras & live" },
    summary: {
      he: "חיבור מצלמה והפעלת לייב.",
      en: "Connect a camera and turn on live.",
    },
    steps: [
      {
        id: "cameras-add",
        target: "header-add-camera",
        placement: "bottom",
        surface: "none",
        title: { he: "הוספת מצלמה", en: "Add a camera" },
        body: {
          he: "מקשר מצלמות לשיחה. אפשר לבחור כמה מצלמות, לשמור Setup קבוע ולנהל אותן מכאן. המצלמות המקושרות מוצגות כתגיות בכותרת.",
          en: "Links cameras to the conversation. Pick several cameras, save a permanent setup and manage them here. Linked cameras appear as tags in the header.",
        },
      },
      {
        id: "cameras-live",
        target: "composer-live",
        placement: "top",
        surface: "none",
        title: { he: "מצלמה חיה", en: "Live camera" },
        body: {
          he: "מפעיל ומכבה שידור חי. כשהוא דולק, כל הודעה ששולחים תלכוד אוטומטית פריים מהמצלמה כדי ש-Ghost יראה בדיוק את מה שאתה רואה. תצוגת הלייב ניתנת להרחבה ולשינוי גודל.",
          en: "Turns the live feed on and off. When it's on, every message you send auto-captures a camera frame so Ghost sees exactly what you see. The live preview can be expanded and resized.",
        },
      },
    ],
  },
  {
    id: "composer",
    icon: "MessageSquarePlus",
    title: { he: "כתיבה ושליחה", en: "Compose & send" },
    summary: {
      he: "טקסט, קול ושליחה.",
      en: "Text, voice and sending.",
    },
    steps: [
      {
        id: "composer-text",
        target: "composer-bar",
        placement: "top",
        surface: "none",
        title: { he: "כתיבת הודעה", en: "Type a message" },
        body: {
          he: "כתוב כאן כל שאלה. Enter שולח, Shift+Enter פותח שורה חדשה. השדה מתרחב אוטומטית עם הטקסט.",
          en: "Type any question here. Enter sends, Shift+Enter adds a new line. The field grows automatically with your text.",
        },
      },
      {
        id: "composer-voice",
        target: "composer-mic",
        placement: "top",
        surface: "none",
        title: { he: "פקודה קולית", en: "Voice command" },
        body: {
          he: "מאפשר להכתיב הודעה בקול. אמירת מילת המפתח שהגדרת (למשל \"go ghost\") שולחת אוטומטית — בלי ידיים. את המילה מגדירים בהגדרות.",
          en: "Lets you dictate a message by voice. Saying your configured keyword (e.g. \"go ghost\") sends it automatically — hands-free. Set the word in Settings.",
        },
      },
      {
        id: "composer-send",
        target: "composer-send",
        placement: "top",
        surface: "none",
        title: { he: "שליחה", en: "Send" },
        body: {
          he: "שולח את ההודעה ל-Ghost. אם הלייב פעיל, פריים מהמצלמה יישלח יחד עם הטקסט.",
          en: "Sends the message to Ghost. If live is on, a camera frame is sent along with your text.",
        },
      },
    ],
  },
  {
    id: "messages",
    icon: "MessagesSquare",
    title: { he: "קריאת תשובות", en: "Reading replies" },
    summary: {
      he: "בועות, פריימים והעתקה.",
      en: "Bubbles, frames and copy.",
    },
    steps: [
      {
        id: "messages-overview",
        target: "message-list",
        placement: "left",
        surface: "none",
        title: { he: "תשובות Ghost", en: "Ghost's replies" },
        body: {
          he: "כל תשובה מופיעה כבועה. לחיצה על פריים שנדגם פותחת אותו במסך מלא, אפשר להעתיק בלוקי קוד, ולחיצה על \"קפוץ להודעה האחרונה\" מחזירה לתחתית כשגוללים למעלה.",
          en: "Each reply appears as a bubble. Click a captured frame to open it full-screen, copy code blocks, and use \"Jump to latest\" to return to the bottom after scrolling up.",
        },
      },
    ],
  },
  {
    id: "memory",
    icon: "Brain",
    title: { he: "זיכרון", en: "Memory" },
    summary: {
      he: "מעקב, תצפיות ועובדות.",
      en: "Tracking, observations and facts.",
    },
    steps: [
      {
        id: "memory-intro",
        target: "memory-panel",
        placement: "left",
        surface: "memory",
        title: { he: "פאנל הזיכרון", en: "Memory panel" },
        body: {
          he: "כאן Ghost צובר ידע על הזירה לאורך זמן — מי נצפה, אילו רכבים עברו ומה חריג. הכול נשלף אוטומטית מהשיחות ומהמצלמות.",
          en: "Here Ghost accumulates knowledge about the site over time — who was seen, which vehicles passed and what's anomalous. It's all extracted automatically from conversations and cameras.",
        },
      },
      {
        id: "memory-tabs",
        target: "memory-tabs",
        placement: "bottom",
        surface: "memory",
        title: { he: "שלוש הלשוניות", en: "Three tabs" },
        body: {
          he: "מעקב (Tracking) — סריקה רציפה של זיהויים; תצפיות (Observations) — סיכומים פר תשובה; עובדות (Facts) — ידע מתמשך שאפשר גם למחוק.",
          en: "Tracking — continuous detection scanning; Observations — per-reply summaries; Facts — long-term knowledge you can also delete.",
        },
      },
      {
        id: "memory-tracking",
        target: "memory-panel",
        placement: "left",
        surface: "memory",
        title: { he: "מעקב ו-Batch", en: "Tracking & batching" },
        body: {
          he: "מתג המעקב מפעיל סריקת רקע של כל המצלמות בשיחה. אפשר לקבוע גודל Batch (כמה קרופים לאסוף לפני שליחה ל-Ghost Vision) ולשלוח ידנית בכל רגע.",
          en: "The tracking toggle starts a background scan of every camera in the conversation. Set a batch size (how many crops to collect before sending to Ghost Vision) and flush manually anytime.",
        },
      },
    ],
  },
  {
    id: "alerts",
    icon: "ShieldAlert",
    title: { he: "התראות", en: "Alerts" },
    summary: {
      he: "כללים, הפעלה ובדיקת חיבור.",
      en: "Rules, arming and connection test.",
    },
    steps: [
      {
        id: "alerts-intro",
        target: "alert-panel",
        placement: "left",
        surface: "alert",
        title: { he: "מצב התראה", en: "Alert mode" },
        body: {
          he: "Ghost סורק את המצלמה ברצף ומתריע כשמתקיים אחד הכללים שהגדרת — אדם אוחז נשק, שרפה, אלימות וכו'.",
          en: "Ghost continuously scans the camera and raises an alert when one of your rules is met — a person holding a weapon, fire, violence, and so on.",
        },
      },
      {
        id: "alerts-rules",
        target: "alert-rules",
        placement: "left",
        surface: "alert",
        title: { he: "כללי התראה", en: "Alert rules" },
        body: {
          he: "הוסף שורות חופשיות שמתארות מצבים שיש להתריע עליהם. כל כלל ניתן להפעלה, כיבוי או מחיקה בנפרד.",
          en: "Add free-form lines describing situations worth alerting on. Each rule can be toggled on, off, or deleted independently.",
        },
      },
      {
        id: "alerts-toggle",
        target: "alert-toggle",
        placement: "left",
        surface: "alert",
        title: { he: "הפעלת מצב התראה", en: "Arm alert mode" },
        body: {
          he: "המתג הראשי מדליק את מצב ההתראה (דורש מצלמה וכלל פעיל אחד לפחות). כשמופעל, מוצג סטטוס המערכת וכפתור בדיקת חיבור. כשמתגלה אירוע — קופץ חיווי מסך מלא לאישור.",
          en: "The master switch arms alert mode (requires a camera and at least one active rule). When armed, you'll see system status and a connection test. When an event is detected, a full-screen alert pops up for acknowledgement.",
        },
      },
    ],
  },
  {
    id: "settings",
    icon: "Settings",
    title: { he: "הגדרות", en: "Settings" },
    summary: {
      he: "משתמשים, לינק כניסה וקול.",
      en: "Users, quick login and voice.",
    },
    steps: [
      {
        id: "settings-users",
        target: "settings-users",
        placement: "right",
        surface: "settings",
        title: { he: "משתמשים", en: "Users" },
        body: {
          he: "רשימת המשתמשים המוגדרים. הנקודה הירוקה מסמנת את המשתמש הפעיל כעת.",
          en: "The list of configured users. The green dot marks the currently active user.",
        },
      },
      {
        id: "settings-add-user",
        target: "settings-add-user",
        placement: "left",
        surface: "settings",
        title: { he: "הוספת משתמש", en: "Add a user" },
        body: {
          he: "יוצר משתמש חדש עם כינוי ומפתח Ghost API. אייקון העין מציג או מסתיר את המפתח בזמן ההקלדה.",
          en: "Creates a new user with a nickname and a Ghost API key. The eye icon shows or hides the key as you type.",
        },
      },
      {
        id: "settings-quick-login",
        target: "settings-quick-login",
        placement: "left",
        surface: "settings",
        title: { he: "לינק כניסה מהירה", en: "Quick login link" },
        body: {
          he: "מייצר לינק חד-פעמי שמחבר אותך מחדש בלי להקליד מפתח API. אפשר להעתיק, לפתוח בלשונית חדשה או לייצר לינק חדש.",
          en: "Generates a single-use link that signs you back in without typing your API key. Copy it, open in a new tab, or regenerate.",
        },
      },
      {
        id: "settings-voice",
        target: "settings-voice",
        placement: "left",
        surface: "settings",
        title: { he: "פקודה קולית", en: "Voice command" },
        body: {
          he: "מפעיל את ההאזנה למיקרופון ומגדיר את מילת השליחה (עד 2 מילים). זו המילה שמפעילה שליחה אוטומטית בשורת הכתיבה.",
          en: "Enables microphone listening and sets your send phrase (up to 2 words). This is the phrase that auto-sends from the composer.",
        },
      },
    ],
  },
  {
    id: "advanced",
    icon: "LayoutGrid",
    title: { he: "תצוגות מתקדמות", en: "Advanced views" },
    summary: {
      he: "ניהול אירועים ושידור.",
      en: "Incident board and broadcast.",
    },
    steps: [
      {
        id: "advanced-incidents",
        target: null,
        placement: "center",
        surface: "incidents",
        title: { he: "לוח ניהול אירועים", en: "Incident board" },
        body: {
          he: "כל התראה פותחת אירוע אוטומטית. בלוח הזה גוררים אירועים בין עמודות (חדש, בטיפול, בבירור, סגור), מקצים מטפל, מוסיפים הערות ופותחים חקירה ייעודית עם Ghost.",
          en: "Every alert auto-opens an incident. On this board you drag incidents between columns (new, handling, investigation, closed), assign an owner, add notes and open a dedicated investigation with Ghost.",
        },
      },
      {
        id: "advanced-broadcast",
        target: "sidebar-conversations",
        placement: "right",
        surface: "none",
        title: { he: "שידור לכל המצלמות", en: "Broadcast to all cameras" },
        body: {
          he: "לחיצה על שם אזור או קבוצה בתפריט פותחת שיחת שידור: הודעה אחת נשלחת לכל המצלמות באזור, וכל אחת עונה בשמה.",
          en: "Clicking an area or group name in the menu opens a broadcast chat: one message goes to every camera in the scope, and each replies in its own name.",
        },
      },
    ],
  },
  {
    id: "graduation",
    icon: "GraduationCap",
    title: { he: "סיום", en: "Graduation" },
    summary: {
      he: "סיימת את תוכנית הלמידה.",
      en: "You finished the learning program.",
    },
    steps: [
      {
        id: "graduation-done",
        target: null,
        placement: "center",
        surface: "none",
        title: { he: "כל הכבוד — סיימת!", en: "Well done — you're set!" },
        body: {
          he: "עכשיו אתה מכיר כל כפתור וכל יכולת ב-Ghost: ניהול שיחות ואזורים, מצלמות ושידור חי, זיכרון, התראות, אירועים והגדרות. תמיד אפשר לפתוח שוב את מרכז הלמידה מהכפתור הצף, להמשיך מהיכן שעצרת או להתחיל מחדש.",
          en: "You now know every button and capability in Ghost: conversations and areas, cameras and live, memory, alerts, incidents and settings. You can always reopen the learning center from the floating button, continue where you left off, or restart.",
        },
      },
    ],
  },
];

export const TOTAL_CHAPTERS = TOUR_CHAPTERS.length;

export function chapterIndexOf(id: ChapterId | null): number {
  if (!id) return -1;
  return TOUR_CHAPTERS.findIndex((c) => c.id === id);
}

export function getChapter(id: ChapterId | null): TourChapter | null {
  const idx = chapterIndexOf(id);
  return idx >= 0 ? TOUR_CHAPTERS[idx] : null;
}

export function stepAt(
  chapterId: ChapterId | null,
  stepIndex: number,
): TourStep | null {
  const chapter = getChapter(chapterId);
  if (!chapter) return null;
  return chapter.steps[stepIndex] ?? null;
}
