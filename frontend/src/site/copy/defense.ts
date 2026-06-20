import type { Locale } from "../../stores/languageStore";

// ── Defense & National Security Brief — bilingual page copy ──
// Tactical mono labels (the CONFIDENTIAL kicker, "Ghost // …" section labels,
// stage numbers, badges, the mock app window chrome, camera ids, timestamps
// and the classification footer) are brand-signature English and stay
// hardcoded in the component; everything a visitor *reads* lives here, per
// locale. English is the original copy, byte-for-byte.

export interface TitledCopy {
  title: string;
  body: string;
}

export interface PipelineStageCopy {
  label: string;
  sub: string;
}

export interface WatchDefineCopy {
  title: string;
  quote: string;
  chipContinuous: string;
  chipCamera: string;
  chipActive: string;
  footnote: string;
}

export interface DemoTurnCopy {
  q: string;
  a: string;
}

export interface DefenseCopy {
  // Hero
  heroTitle: string;
  heroTitleSub: string;
  heroBody: string;
  requestAccess: string;
  viewArchitecture: string;
  // Trust strip — English in both locales (tactical mono chips; Air-gap /
  // Zero-trust are kept as technical terms).
  trust: string[];

  // Live demo window — conversational bubbles only (window chrome stays EN).
  demo: DemoTurnCopy[];

  // Technology — the engine behind Ghost
  engineHeading: string;
  engineBody: string;
  enginePoints: TitledCopy[];

  // The gap
  gapHeading: string;
  gapBody: string;

  // Three operational layers (tags stay EN in the component)
  layers: TitledCopy[];

  // Operational capabilities
  capabilities: TitledCopy[];

  // Watch / Alert
  watchHeading: string;
  watchDefine: WatchDefineCopy;
  alertCheck: string;
  alertSeen: string;
  previewLegend: string[];

  // Data flow / pipeline
  pipelineHeading: string;
  pipelineBody: string;
  pipelineStages: PipelineStageCopy[];

  // Deployment & sovereignty
  deployIntro: string;
  deployments: TitledCopy[];

  // Security & compliance
  compliance: TitledCopy[];
  complianceNote: string;

  // Built for
  verticals: string[];

  // Use cases by sector
  useCasesHeading: string;
  useCasesBody: string;
  exploreAll: (count: number) => string;

  // In practice — talk to your cameras
  prompts: string[];

  // Access request
  accessHeading: string;
  accessBody: string;
}

export const DEFENSE_COPY: Record<Locale, DefenseCopy> = {
  en: {
    heroTitle: "Your cameras see everything.",
    heroTitleSub: "Now question them.",
    heroBody:
      "The first chat interface for your cameras. Every feed — live and recorded — becomes a memory you question in plain language. Built for sovereign, air-gapped environments.",
    requestAccess: "Request access",
    viewArchitecture: "View the architecture",
    trust: ["Agentless", "Air-gap ready", "Zero-trust", "Full audit trail"],

    demo: [
      {
        q: "What do you see at the main gate right now?",
        a: "The vehicle barrier is raised and the guard booth is empty. A figure in a dark hooded jacket is pressed against the booth window on the left, one hand flat on the glass. A dark backpack sits on the ground beside the door.",
      },
      {
        q: "Is anything blocking the gate approach?",
        a: "A white van is stopped across the inbound lane, parked on the painted no-stopping zone in front of the barrier with its driver door open. The lane behind it is clear.",
      },
    ],

    engineHeading:
      "A perception engine that reads video the way an analyst does.",
    engineBody:
      "Ghost runs a multimodal vision-language core directly on your own hardware. Instead of replaying pixels, it continuously interprets every feed — reading context, behaviour and intent across a scene — and distils what it understands into structured, searchable text the moment it happens.",
    enginePoints: [
      {
        title: "On-prem multimodal core",
        body: "The vision-language model runs entirely inside your perimeter — no frame ever leaves the network.",
      },
      {
        title: "Frames become memory",
        body: "Every sequence is distilled into indexed text the instant it occurs, searchable later in plain language.",
      },
      {
        title: "Understanding, not motion alerts",
        body: "Ghost reasons over the meaning of a scene rather than pixel deltas, so you get signal instead of noise.",
      },
      {
        title: "Cross-camera reasoning",
        body: "A single event is correlated across many feeds and timeframes to reconstruct what actually happened.",
      },
    ],

    gapHeading: "The footage already exists. The understanding doesn't.",
    gapBody:
      "Control rooms are saturated with feeds no one can watch in full. Critical moments are buried in hours of recording, scattered across dozens of cameras, recoverable only after the fact. Ghost closes that gap — every camera becomes a conversation, every group of cameras becomes an investigation channel, and every recorded moment becomes textual memory you can search by simply asking.",

    layers: [
      {
        title: "History you can talk to",
        body: "Every sequence is continuously converted into rich, searchable text. Ask what happened at a location and timeframe and get an answer in seconds — no scrubbing, no jumping between cameras.",
      },
      {
        title: "Ask what is happening now",
        body: "Query any camera or sector in real time and receive a plain-language description of the current situation, on demand.",
      },
      {
        title: "Checks you define in natural language",
        body: "Describe a recurring check in your own words. Ghost runs exactly what you defined and flags deviations — it executes your intent, it does not decide on its own.",
      },
    ],

    capabilities: [
      {
        title: "Plain-language investigation",
        body: "Reconstruct an event across multiple cameras by asking, not searching.",
      },
      {
        title: "Shift & sector summaries",
        body: "Generate handover and situation summaries for any timeframe or group of cameras.",
      },
      {
        title: "Real-time situational queries",
        body: "Ask the state of any zone right now and get a contextual answer.",
      },
      {
        title: "Defined recurring checks",
        body: "Stand up natural-language monitoring tasks and receive deviation alerts.",
      },
      {
        title: "Cross-camera investigation channels",
        body: "Group cameras like conversations and investigate a whole sector as one thread.",
      },
      {
        title: "Continuous textual logging",
        body: "A persistent, queryable record of the filmed environment, retained as structured memory.",
      },
    ],

    watchHeading:
      "Describe a check in plain words. Ghost watches, you get only the deviations.",
    watchDefine: {
      title: "Define a check",
      quote:
        "“Watch the loading bay and alert me the moment the emergency exit is blocked.”",
      chipContinuous: "Continuous",
      chipCamera: "Loading bay",
      chipActive: "Active",
      footnote:
        "Ghost runs exactly what you defined and flags only the deviations — it executes your intent, it does not decide on its own.",
    },
    alertCheck: "Emergency exit must stay clear",
    alertSeen:
      "Wet cardboard boxes are stacked against the emergency exit, blocking the push bar. A yellow forklift is parked directly in front of the door.",
    previewLegend: [
      "Reconstruct any past window from textual memory — just ask.",
      "Get a plain-language read of what a camera sees right now.",
      "A natural-language check runs on a schedule and raises the alert.",
    ],

    pipelineHeading: "Four stages. One direction. No agents on your cameras.",
    pipelineBody:
      "Ghost ingests streams from your existing infrastructure over RTSP, isolated HDMI capture, or local integrations. Frames are interpreted to produce structured narratives and context, then surfaced to operators as plain-language conversations — without exposing raw footage beyond your boundary.",
    pipelineStages: [
      { label: "Existing cameras", sub: "Your deployed fleet" },
      { label: "RTSP / HDMI", sub: "Agentless capture" },
      { label: "Ghost interpretation", sub: "Vision + language" },
      { label: "Operator conversation", sub: "Chat with every camera" },
    ],

    deployIntro:
      "Ghost supports multiple deployment configurations to comply with the assurance, sovereignty, and operational requirements of defense and national-security organizations — from fully air-gapped sites to national control-center integrations.",
    deployments: [
      {
        title: "On-prem / Local RTSP",
        body: "Processing within isolated networks you control.",
      },
      {
        title: "Air-gapped",
        body: "Fully disconnected, high-assurance sites.",
      },
      {
        title: "HDMI capture",
        body: "Isolated capture with no network coupling.",
      },
      { title: "Hybrid", body: "Hybrid intelligence environments." },
      {
        title: "National / enterprise control center",
        body: "Integration with existing operations centers.",
      },
    ],

    compliance: [
      {
        title: "Zero-trust architecture",
        body: "Every request authenticated; no implicit trust between components.",
      },
      {
        title: "Access control & audit logs",
        body: "Role-based access with configurable, exportable audit trails and chain of custody.",
      },
      {
        title: "Encrypted channels",
        body: "All communication moves over encrypted channels, end to end.",
      },
      {
        title: "Data minimization",
        body: "Raw video exposure is minimized; structured memory layers persist instead.",
      },
    ],
    complianceNote:
      "Suitable for organizations under strict assurance requirements — critical infrastructure, national security organizations, defense agencies, and high-availability control centers.",

    verticals: [
      "Critical infrastructure",
      "Perimeter & site security",
      "National & enterprise control rooms",
      "Ports, borders & aviation",
      "Energy & utilities",
      "Government & defense facilities",
    ],

    useCasesHeading:
      "The same engine, tuned to the zones that matter in your environment.",
    useCasesBody:
      "For each operational domain we mapped the critical zones and the checks you would actually run — periodic monitoring, continuous critical alerts, and scheduled end-of-shift inspections, all in plain language. Open any sector to see it in practice.",
    exploreAll: (count) => `Explore all ${count} sectors`,

    prompts: [
      "Show me anything along the perimeter fence that looks cut, bent, or pulled open.",
      "Is anyone on the loading dock missing a hard hat or high-visibility vest?",
      "Is anything stopped in the emergency lane or blocking a fire exit right now?",
      "Are there signs of smoke or open flame on any of the sector cameras?",
      "Is anyone lying on the ground or slumped against a wall across the floor cameras?",
    ],

    accessHeading: "Request operational access.",
    accessBody:
      "Ghost is provisioned for vetted defense and national-security organizations. Request access and our team will arrange a secured briefing.",
  },

  he: {
    heroTitle: "המצלמות שלכם רואות הכול.",
    heroTitleSub: "עכשיו תחקרו אותן.",
    heroBody:
      "ממשק הצ'אט הראשון למצלמות שלכם. כל פיד — חי ומוקלט — הופך לזיכרון שאתם מתחקרים בשפה חופשית. בנוי לסביבות ריבוניות ומנותקות (Air-gap).",
    requestAccess: "בקשת גישה",
    viewArchitecture: "צפייה בארכיטקטורה",
    trust: ["Agentless", "Air-gap ready", "Zero-trust", "Full audit trail"],

    demo: [
      {
        q: "מה אתה רואה בשער הראשי ברגע זה?",
        a: "מחסום הרכב מורם ועמדת השומר ריקה. דמות במעיל כהה עם קפוצ'ון צמודה לחלון העמדה משמאל, כף יד אחת שטוחה על הזכוכית. תיק גב כהה מונח על הקרקע ליד הדלת.",
      },
      {
        q: "האם משהו חוסם את ציר הגישה לשער?",
        a: "ואן לבן עוצר לרוחב נתיב הכניסה, חונה על אזור איסור העצירה המסומן מול המחסום, ודלת הנהג שלו פתוחה. הנתיב מאחוריו פנוי.",
      },
    ],

    engineHeading: "מנוע תפיסה שקורא וידאו כמו אנליסט.",
    engineBody:
      "Ghost מריץ ליבת שפה-וראייה מולטימודלית ישירות על החומרה שלכם. במקום להריץ פיקסלים מחדש, הוא מפרש כל פיד באופן רציף — קורא הקשר, התנהגות וכוונה על פני הסצנה — ומזקק את מה שהוא מבין לטקסט מובנה וניתן לחיפוש ברגע ההתרחשות.",
    enginePoints: [
      {
        title: "ליבה מולטימודלית On-prem",
        body: "מודל השפה-והראייה רץ כולו בתוך הגדר שלכם — אף פריים לא עוזב את הרשת.",
      },
      {
        title: "פריימים הופכים לזיכרון",
        body: "כל רצף מזוקק לטקסט מאונדקס ברגע שהוא מתרחש, וניתן לחיפוש בהמשך בשפה חופשית.",
      },
      {
        title: "הבנה, לא התראות תנועה",
        body: "Ghost מסיק על המשמעות של הסצנה ולא על הפרשי פיקסלים — אתם מקבלים אות במקום רעש.",
      },
      {
        title: "הסקה חוצת-מצלמות",
        body: "אירוע בודד מוצלב על פני פידים וחלונות זמן רבים כדי לשחזר מה באמת קרה.",
      },
    ],

    gapHeading: "התיעוד כבר קיים. ההבנה — עדיין לא.",
    gapBody:
      "חמ\"לים רוויים בפידים שאיש לא מסוגל לצפות בהם במלואם. רגעים קריטיים קבורים בשעות של הקלטה, מפוזרים על פני עשרות מצלמות, וניתנים לשחזור רק בדיעבד. Ghost סוגר את הפער הזה — כל מצלמה הופכת לשיחה, כל קבוצת מצלמות הופכת לערוץ תחקור, וכל רגע מוקלט הופך לזיכרון טקסטואלי שמחפשים בו פשוט באמצעות שאלה.",

    layers: [
      {
        title: "היסטוריה שאפשר לדבר איתה",
        body: "כל רצף מומר באופן רציף לטקסט עשיר וניתן לחיפוש. שאלו מה קרה במיקום ובחלון זמן וקבלו תשובה בתוך שניות — בלי גלילה, בלי לקפוץ בין מצלמות.",
      },
      {
        title: "שאלו מה קורה עכשיו",
        body: "תחקרו כל מצלמה או גזרה בזמן אמת וקבלו תיאור בשפה חופשית של התמונה הנוכחית, לפי דרישה.",
      },
      {
        title: "בדיקות שאתם מגדירים בשפה טבעית",
        body: "תארו בדיקה חוזרת במילים שלכם. Ghost מריץ בדיוק את מה שהגדרתם ומסמן חריגות — הוא מבצע את הכוונה שלכם, לא מחליט לבד.",
      },
    ],

    capabilities: [
      {
        title: "תחקור בשפה חופשית",
        body: "שחזרו אירוע על פני כמה מצלמות באמצעות שאלה, לא חיפוש.",
      },
      {
        title: "סיכומי משמרת וגזרה",
        body: "הפיקו סיכומי חפיפה ותמונת מצב לכל חלון זמן או קבוצת מצלמות.",
      },
      {
        title: "שאילתות מצב בזמן אמת",
        body: "שאלו מה מצבו של כל אזור ברגע זה וקבלו תשובה עם הקשר.",
      },
      {
        title: "בדיקות חוזרות מוגדרות",
        body: "הקימו משימות צפייה בשפה טבעית וקבלו התראות על חריגות.",
      },
      {
        title: "ערוצי תחקור חוצי-מצלמות",
        body: "קבצו מצלמות כמו שיחות ותחקרו גזרה שלמה כשרשור אחד.",
      },
      {
        title: "תיעוד טקסטואלי רציף",
        body: "רשומה מתמשכת וניתנת לשאילתה של הסביבה המצולמת, נשמרת כזיכרון מובנה.",
      },
    ],

    watchHeading:
      "תארו בדיקה במילים פשוטות. Ghost צופה, אתם מקבלים רק את החריגות.",
    watchDefine: {
      title: "הגדרת בדיקה",
      quote: "״צפה ברציף ההעמסה והתרע ברגע שיציאת החירום נחסמת.״",
      chipContinuous: "רציף",
      chipCamera: "רציף העמסה",
      chipActive: "פעיל",
      footnote:
        "Ghost מריץ בדיוק את מה שהגדרתם ומסמן רק את החריגות — הוא מבצע את הכוונה שלכם, לא מחליט לבד.",
    },
    alertCheck: "יציאת החירום חייבת להישאר פנויה",
    alertSeen:
      "קרטונים רטובים נערמים על יציאת החירום וחוסמים את ידית הבהלה. מלגזה צהובה חונה ישירות מול הדלת.",
    previewLegend: [
      "שחזרו כל חלון זמן מהזיכרון הטקסטואלי — פשוט שאלו.",
      "קבלו קריאה בשפה חופשית של מה שהמצלמה רואה ברגע זה.",
      "בדיקה בשפה טבעית רצה לפי לוח זמנים ומרימה את ההתראה.",
    ],

    pipelineHeading: "ארבעה שלבים. כיוון אחד. בלי agents על המצלמות שלכם.",
    pipelineBody:
      "Ghost קולט זרמים מהתשתית הקיימת שלכם דרך RTSP, לכידת HDMI מבודדת או אינטגרציות מקומיות. הפריימים מפורשים לכדי נרטיבים מובנים והקשר, ומוצגים למפעילים כשיחות בשפה חופשית — בלי לחשוף וידאו גולמי מעבר לגבול שלכם.",
    pipelineStages: [
      { label: "מצלמות קיימות", sub: "הצי הפרוס שלכם" },
      { label: "RTSP / HDMI", sub: "לכידה ללא agent" },
      { label: "פרשנות Ghost", sub: "ראייה + שפה" },
      { label: "שיחת מפעיל", sub: "צ'אט עם כל מצלמה" },
    ],

    deployIntro:
      "Ghost תומך במספר תצורות פריסה כדי לעמוד בדרישות האבטחה, הריבונות והתפעול של ארגוני ביטחון וביטחון לאומי — מאתרים מנותקים לחלוטין (Air-gap) ועד אינטגרציות בחמ\"לים לאומיים.",
    deployments: [
      {
        title: "On-prem / RTSP מקומי",
        body: "עיבוד בתוך רשתות מבודדות שבשליטתכם.",
      },
      {
        title: "Air-gap מלא",
        body: "אתרים מנותקים לחלוטין ברמת אבטחה גבוהה.",
      },
      {
        title: "לכידת HDMI",
        body: "לכידה מבודדת ללא צימוד רשת.",
      },
      { title: "היברידי", body: "סביבות מודיעין היברידיות." },
      {
        title: "חמ\"ל לאומי / ארגוני",
        body: "אינטגרציה עם מרכזי תפעול קיימים.",
      },
    ],

    compliance: [
      {
        title: "ארכיטקטורת Zero-trust",
        body: "כל בקשה מאומתת; אין אמון מובנה בין רכיבים.",
      },
      {
        title: "בקרת גישה ויומני ביקורת",
        body: "גישה מבוססת תפקידים עם נתיבי ביקורת ניתנים להגדרה ולייצוא, ושרשרת משמורת.",
      },
      {
        title: "ערוצים מוצפנים",
        body: "כל התקשורת עוברת בערוצים מוצפנים, מקצה לקצה.",
      },
      {
        title: "מזעור נתונים",
        body: "חשיפת וידאו גולמי ממוזערת; במקומה נשמרות שכבות זיכרון מובנות.",
      },
    ],
    complianceNote:
      "מתאים לארגונים תחת דרישות אבטחה מחמירות — תשתיות קריטיות, ארגוני ביטחון לאומי, גופי הגנה וחמ\"לים בזמינות גבוהה.",

    verticals: [
      "תשתיות קריטיות",
      "אבטחת היקף ואתרים",
      "חמ\"לים לאומיים וארגוניים",
      "נמלים, גבולות ותעופה",
      "אנרגיה ותשתיות",
      "מתקני ממשלה וביטחון",
    ],

    useCasesHeading: "אותו מנוע, מכוון לאזורים שחשובים בסביבה שלכם.",
    useCasesBody:
      "לכל תחום תפעולי מיפינו את האזורים הקריטיים ואת הבדיקות שבאמת הייתם מריצים — ניטור תקופתי, התראות קריטיות רציפות וביקורות מתוזמנות לסוף משמרת, הכול בשפה חופשית. פתחו כל מגזר כדי לראות את זה בפועל.",
    exploreAll: (count) => `לכל ${count} המגזרים`,

    prompts: [
      "הראה לי כל נקודה לאורך גדר ההיקף שנראית חתוכה, מעוקמת או פתוחה בכוח.",
      "האם מישהו ברציף ההעמסה בלי קסדה או אפוד זוהר?",
      "האם משהו עוצר בנתיב החירום או חוסם יציאת אש ברגע זה?",
      "האם יש סימני עשן או אש גלויה באחת ממצלמות הגזרה?",
      "האם מישהו שוכב על הרצפה או שעון על קיר במצלמות הקומה?",
    ],

    accessHeading: "בקשו גישה מבצעית.",
    accessBody:
      "Ghost מוקצה לארגוני ביטחון וביטחון לאומי שעברו סינון. בקשו גישה והצוות שלנו יתאם תדריך מאובטח.",
  },
};

// ── Featured sector cards ──
// Names + blurbs for the sector teaser on the brief, keyed by sector id so the
// shared SECTORS data (owned elsewhere) stays untouched. Images are structural
// and live in the component.
export interface SectorCardCopy {
  name: string;
  blurb: string;
}

export const DEFENSE_SECTOR_CARDS: Record<
  Locale,
  Record<string, SectorCardCopy>
> = {
  en: {
    construction: {
      name: "Construction Sites",
      blurb:
        "Worker safety, heavy machinery and an open perimeter — Ghost watches helmet compliance, falls and blocked access in every corner of the site.",
    },
    restaurant: {
      name: "Restaurants",
      blurb:
        "Kitchen, bar, dining room and register — Ghost flags queues, uncleared tables, open flames and violent incidents in real time.",
    },
    "gas-station": {
      name: "Fuel Stations",
      blurb:
        "Forecourt, convenience store and underground tanks — Ghost enforces no-smoking, catches register robberies and hazardous fluid leaks.",
    },
    greenhouse: {
      name: "Greenhouses",
      blurb:
        "Crop rows, pump rooms and the sheeting perimeter — Ghost detects pipe bursts, structural collapse and intrusion through the mesh.",
    },
    parking: {
      name: "Parking Garages",
      blurb:
        "Barriers, drive lanes and elevator lobbies — Ghost spots blocked lanes, a person down, smoke from a vehicle and break-ins at payment stations.",
    },
    supermarket: {
      name: "Supermarkets",
      blurb:
        "Checkouts, aisles and the back stockroom — Ghost flags queues, blocked emergency exits, register robberies and empty shelves.",
    },
    pharmacy: {
      name: "Pharmacies",
      blurb:
        "Pharmacist counter, prescription safe and storeroom — Ghost guards the medicine cabinet, threats to the pharmacist and crowding in the waiting area.",
    },
    clinic: {
      name: "Private Clinics",
      blurb:
        "Waiting room, treatment rooms and drug storage — Ghost detects patient collapse, blocked corridors and unauthorized access to medical equipment.",
    },
    dental: {
      name: "Dental Clinics",
      blurb:
        "Treatment rooms, X-ray and sterilization — Ghost detects unattended sharp instruments, fainting and smoke from the autoclave.",
    },
  },
  he: {
    construction: {
      name: "אתרי בנייה",
      blurb:
        "בטיחות עובדים, ציוד כבד והיקף פתוח — Ghost צופה בחבישת קסדות, נפילות וגישה חסומה בכל פינה באתר.",
    },
    restaurant: {
      name: "מסעדות",
      blurb:
        "מטבח, בר, חלל ישיבה וקופה — Ghost מסמן תורים, שולחנות שלא פונו, אש גלויה ואירועים אלימים בזמן אמת.",
    },
    "gas-station": {
      name: "תחנות דלק",
      blurb:
        "רחבת תדלוק, חנות נוחות ומכלים תת-קרקעיים — Ghost אוכף איסור עישון, תופס שוד בקופה ודליפות נוזלים מסוכנים.",
    },
    greenhouse: {
      name: "חממות",
      blurb:
        "שורות גידול, חדרי משאבות והיקף היריעות — Ghost מציף פיצוצי צנרת, קריסת מבנה וחדירה דרך הרשת.",
    },
    parking: {
      name: "חניונים",
      blurb:
        "מחסומים, נתיבי נסיעה ומבואות מעליות — Ghost מציף נתיבים חסומים, אדם שקרס על הרצפה, עשן מרכב ופריצה לעמדות תשלום.",
    },
    supermarket: {
      name: "סופרמרקטים",
      blurb:
        "קופות, מעברים ומחסן אחורי — Ghost מסמן תורים, יציאות חירום חסומות, שוד בקופה ומדפים ריקים.",
    },
    pharmacy: {
      name: "בתי מרקחת",
      blurb:
        "דלפק הרוקח, כספת המרשמים והמחסן — Ghost שומר על ארון התרופות, על איומים כלפי הרוקח ועל צפיפות באזור ההמתנה.",
    },
    clinic: {
      name: "מרפאות פרטיות",
      blurb:
        "חדר המתנה, חדרי טיפול ואחסון תרופות — Ghost מציף קריסת מטופל, מסדרונות חסומים וגישה לא מורשית לציוד רפואי.",
    },
    dental: {
      name: "מרפאות שיניים",
      blurb:
        "חדרי טיפול, רנטגן וסטריליזציה — Ghost מציף מכשירים חדים ללא השגחה, התעלפות ועשן מהאוטוקלב.",
    },
  },
};
