import type { Locale } from "../../stores/languageStore";

// ── LKM-Drone — bilingual page copy ──
// Tactical mono chrome stays brand-signature English and hardcoded in the
// component: "LKM-Drone by Ghost · …" kicker, "Technology // …" section
// labels, the scope titlebar/HUD readouts (CONTACT-07, CAM-12 …), spec lines
// ("Intel · PDF", "System · Brief"), "SECRET // NOFORN", the classification
// footer, and the engine names (Micro-Signature Tracking, Micro-Flutter
// Analysis, Heat Atlas) which stay English inside Hebrew sentences too.
// Everything a visitor *reads* lives here, per locale. English is the
// original copy, byte-for-byte. Icons, images and per-card structure stay in
// the component and are zipped positionally.

export interface DroneEngineCopy {
  tagline: string;
  imageAlt: string;
  body: string;
  points: string[];
}

export interface DroneEnvironmentCopy {
  title: string;
  points: string[];
}

export interface DroneStageCopy {
  label: string;
  sub: string;
}

export interface DroneCardCopy {
  title: string;
  body: string;
}

export interface DroneContactMapCopy {
  a: string;
  b: string;
}

export interface DroneCopy {
  // The sidebar CTA — this page relabels it ("Request a demonstration").
  accessLabel: string;
  bannerAlt: string;
  heroTitle: string;
  heroTitleSub: string;
  heroBody: string;
  requestDemo: string;
  downloadFieldReport: string;
  viewArchitecture: string;
  trust: string[];
  scopeCaption: string;
  scopeClassification: string;
  scopeTrackNote: string;
  challengeTitle: string;
  challengeP1: string;
  challengeP2: string;
  doctrineTitle: string;
  doctrineBody: string;
  doctrineLines: string[];
  doctrineNote: string;
  evaluatedLabel: string;
  evaluates: string[];
  pixelP1: string;
  pixelP2: string;
  traditionalAskLabel: string;
  traditionalAsk: string;
  ghostAskLabel: string;
  // The "behave" word carries the accent span, so the quote ships in parts.
  ghostAskPre: string;
  ghostAskAccent: string;
  ghostAskPost: string;
  techTitle: string;
  techBody: string;
  engines: DroneEngineCopy[];
  engineCaption: string;
  lifecycleTitle: string;
  lifecycle: DroneStageCopy[];
  awareness: DroneCardCopy[];
  environments: DroneEnvironmentCopy[];
  experienceTitle: string;
  experienceBody: string;
  contactMap: DroneContactMapCopy[];
  queries: string[];
  composerPlaceholder: string;
  deploymentIntro: string;
  deployment: DroneCardCopy[];
  useCases: DroneCardCopy[];
  benefits: string[];
  summaryBody: string;
  summaryAccent: string;
  reportTitle: string;
  reportBody: string;
  reportItems: string[];
  reportDocMeta: string;
  reportDownload: string;
  reportFootnote: string;
  ctaTitle: string;
  ctaBody: string;
  explorePlatform: string;
}

export const DRONE_COPY: Record<Locale, DroneCopy> = {
  en: {
    accessLabel: "Request a demonstration",
    bannerAlt:
      "Ghost counter-drone field training — tripod thermal camera and tactical tablet",
    heroTitle: "When every drone becomes",
    heroTitleSub: "a potential threat.",
    heroBody:
      "AI-powered drone detection, tracking and early warning. LKM-Drone turns your existing surveillance infrastructure into an active aerial threat detection system — identifying drones before they become a threat, even when they appear as only a few pixels.",
    requestDemo: "Request a demonstration",
    downloadFieldReport: "Download the field report",
    viewArchitecture: "View the architecture",
    trust: ["Pixel-scale detection", "Behavioral AI", "Existing sensors", "Day & night"],
    scopeCaption:
      "Operator scope · live behavioral classification of an aerial contact",
    scopeClassification: "Hostile drone — likely",
    scopeTrackNote:
      "Low, erratic approach from the north-east. Hovering bursts and repeated course corrections — consistent with a stabilised quadcopter, not a bird.",
    challengeTitle:
      "Small, low-cost drones fly low, move unpredictably, and stay unnoticed until they are already in range.",
    challengeP1:
      "Modern drones are capable of intelligence gathering, surveillance, targeting, payload delivery and direct attack. They generate minimal radar signatures and are difficult to detect with traditional means. Military units, border forces, critical-infrastructure operators, airports, energy sites and homeland-security organizations all face the same reality: identifying an aerial threat seconds earlier can be the difference between a successful response and a critical incident.",
    challengeP2:
      "Ghost built LKM-Drone to close that gap — detecting, analyzing and alerting on drone activity before it becomes a threat.",
    doctrineTitle: "Ghost analyzes behavior, not just shape.",
    doctrineBody:
      "LKM-Drone is not a video monitoring system. It is an AI-powered Visual Intelligence layer that continuously analyzes the airspace using existing and dedicated sensors to identify abnormal aerial activity in real time.",
    doctrineLines: [
      "Instead of searching only for drone shapes — Ghost analyzes behavior.",
      "Instead of relying on a single frame — Ghost evaluates motion across time.",
      "Instead of displaying video feeds — Ghost understands what is happening.",
    ],
    doctrineNote:
      "This enables reliable detection even when a drone appears as only a few pixels — or a single pixel — within the camera sensor.",
    evaluatedLabel: "Continuously evaluated",
    evaluates: [
      "Motion trajectories",
      "Flight behavior",
      "Stabilization patterns",
      "Direction changes",
      "Thermal signatures",
      "Micro-vibrations",
      "Environmental anomalies",
      "Object persistence",
      "Threat probability",
    ],
    pixelP1:
      "Most computer-vision systems are trained to identify large, clearly visible objects — people, vehicles, boats, equipment. At operational distances, a drone may occupy only a handful of pixels and be nearly indistinguishable from background noise. Traditional object recognition becomes ineffective.",
    pixelP2:
      "Ghost solves this through advanced temporal analysis and behavioral intelligence.",
    traditionalAskLabel: "Traditional systems ask",
    traditionalAsk: "\u201cDoes this look like a drone?\u201d",
    ghostAskLabel: "Ghost asks",
    ghostAskPre: "\u201cDoes this ",
    ghostAskAccent: "behave",
    ghostAskPost: " like a drone?\u201d",
    techTitle: "Three layers of behavioral intelligence, working as one.",
    techBody:
      "Micro-Signature Tracking, Micro-Flutter Analysis and Heat Atlas run together over every sensor — turning faint motion into a calibrated, defensible threat probability.",
    engines: [
      {
        tagline: "Identifying invisible flight patterns",
        imageAlt:
          "Flight-path vector signature as the model sees it — a movement pattern, not an object",
        body: "Each aerial object creates a unique movement signature. Ghost continuously analyzes position changes, flight consistency, acceleration, hovering behavior and course corrections to classify the probability of an aerial threat with exceptional precision.",
        points: [
          "Position & acceleration profiling",
          "Hover and course-correction analysis",
          "Bird vs. drone vs. aircraft separation",
        ],
      },
      {
        tagline: "Detecting drone stabilization behavior",
        imageAlt:
          "Micro-vibration flutter signature as the model sees it — a frequency pattern, not an object",
        body: "Every drone performs thousands of stabilization adjustments per minute to compensate for wind, turbulence and payload. These create microscopic motion patterns — invisible to operators, but detectable through frame-to-frame analysis.",
        points: [
          "Frame-to-frame micro-vibration extraction",
          "Flight-controller stabilization fingerprinting",
          "High-confidence false-positive rejection",
        ],
      },
      {
        tagline: "Dynamic thermal environment modeling",
        imageAlt:
          "Behavioral thermal model as the model sees it — stable and dynamic zones, not objects",
        body: "Heat Atlas continuously builds a live thermal model of the operational environment — learning stable and dynamic zones, normal behavior and expected fluctuations — so the system understands the scene before it searches for threats.",
        points: [
          "Live stable / dynamic thermal zoning",
          "Historical thermal pattern learning",
          "Dramatic false-alarm reduction at sensitivity",
        ],
      },
    ],
    engineCaption: "As the model sees it · pattern, not object",
    lifecycleTitle: "Six stages. One continuous loop. Detection alone is not enough.",
    lifecycle: [
      { label: "Observe", sub: "Existing & dedicated sensors stream the airspace." },
      { label: "Detect", sub: "Behavioral & temporal analysis flags abnormal motion." },
      { label: "Classify", sub: "Micro-signatures separate drones from birds & noise." },
      { label: "Track", sub: "Trajectory, direction and persistence are followed in real time." },
      { label: "Alert", sub: "Operators receive location, heading and confidence instantly." },
      { label: "Investigate", sub: "Every event is stored, searchable and re-correlated." },
    ],
    awareness: [
      { title: "Instant alerts", body: "Operators are notified the moment a potential aerial threat is confirmed." },
      { title: "Object location & heading", body: "Position, movement direction and confidence are surfaced together." },
      { title: "Confidence scoring", body: "Every contact carries a calibrated threat-probability score." },
      { title: "Searchable event history", body: "Each event is stored and available for future analysis and correlation." },
      { title: "Automated investigations", body: "Critical contacts launch automated investigation threads." },
      { title: "Escalation", body: "Confirmed events escalate to the right personnel automatically." },
    ],
    environments: [
      {
        title: "Desert environments",
        points: ["Extreme temperatures", "Heat distortion", "Dust & sand", "Long-range visibility"],
      },
      {
        title: "Urban areas",
        points: ["Dense visual clutter", "Buildings & structures", "Complex movement", "High background activity"],
      },
      {
        title: "Border security operations",
        points: ["Wide-area surveillance", "Open-terrain monitoring", "Remote deployment", "Persistent coverage"],
      },
      {
        title: "Night operations",
        points: ["Zero-light conditions", "Thermal-only detection", "Continuous monitoring", "Day & night parity"],
      },
    ],
    experienceTitle: "Operators ask questions. Ghost answers with intelligence.",
    experienceBody:
      "Ghost follows a fundamentally different philosophy than traditional VMS platforms. The user interacts through a familiar chat-based experience — not a complicated control-room interface — and receives rich intelligence summaries instead of simple alerts.",
    contactMap: [
      { a: "Camera", b: "Contact" },
      { a: "Multiple cameras", b: "Operational group" },
      { a: "Video feed", b: "Intelligence source" },
    ],
    queries: [
      "Have any drones been detected in the last 24 hours?",
      "Show all aerial threats detected near the perimeter.",
      "Where was the last drone identified, and on which heading?",
      "How long did it remain in the area?",
      "Was this the same object detected earlier this week?",
    ],
    composerPlaceholder: "Ask about any aerial contact…",
    deploymentIntro:
      "LKM-Drone enhances current security investments without replacing existing infrastructure. It can be deployed across any combination of the following:",
    deployment: [
      { title: "Existing surveillance cameras", body: "Re-use the fleet already covering your site." },
      { title: "Thermal imaging systems", body: "Thermal-only detection for night and zero-light." },
      { title: "Dedicated observation sensors", body: "Purpose-built optics for long-range sectors." },
      { title: "Tactical edge computers", body: "On-site inference with no cloud dependency." },
      { title: "Mobile operational stations", body: "Rapidly deployable forward positions." },
      { title: "Fixed security infrastructure", body: "Integration into permanent control centers." },
    ],
    useCases: [
      { title: "Military force protection", body: "Early warning against hostile drone activity near deployed forces." },
      { title: "Border security", body: "Continuous monitoring of large operational sectors and open terrain." },
      { title: "Critical infrastructure", body: "Defense of power plants, energy facilities, transport hubs and strategic assets." },
      { title: "Military bases & installations", body: "Persistent aerial surveillance and threat detection over installations." },
      { title: "Airport & airspace security", body: "Identification of unauthorized drone activity in controlled airspace." },
      { title: "Industrial & commercial", body: "Protection of factories, warehouses, logistics centers and high-value sites." },
    ],
    benefits: [
      "Early detection of small aerial threats",
      "AI-powered behavioral analysis",
      "Reduced false alarms",
      "Real-time threat intelligence",
      "Searchable event history",
      "Integration with existing infrastructure",
      "Rapid deployment capability",
      "Chat-based operational experience",
      "Continuous learning & adaptation",
    ],
    summaryBody:
      "LKM-Drone transforms surveillance infrastructure into an active aerial intelligence network. By combining advanced computer vision, behavioral analysis, thermal intelligence and natural-language interaction, Ghost gives security teams earlier detection, faster decisions and greater operational awareness. As aerial threats become smaller, faster and harder to detect, organizations need more than cameras. They need intelligence. ",
    summaryAccent: "Ghost delivers it.",
    reportTitle: "The LKM-Drone counter-UAS field report.",
    reportBody:
      "A five-page brief covering the detection doctrine, the proprietary engine, and results from a controlled counter-UAS field trial — including thermal-only classification of a stabilized quadcopter. Released on a need-to-know basis under NDA.",
    reportItems: [
      "Threat & detection doctrine",
      "Proprietary detection engine",
      "Field-trial evidence",
      "Deployment & handling",
    ],
    reportDocMeta: "PDF · 5 pages · English",
    reportDownload: "Download the report",
    reportFootnote: "Requires full name, company, work email and mobile phone.",
    ctaTitle: "See LKM-Drone against a live airspace.",
    ctaBody:
      "Request a demonstration and our team will arrange a secured briefing tailored to your sensors, terrain and operational sector.",
    explorePlatform: "Explore the platform",
  },
  he: {
    accessLabel: "בקשת הדגמה",
    bannerAlt:
      "אימון שטח של Ghost ללוחמה בכטב\"מים — מצלמה תרמית על חצובה וטאבלט טקטי",
    heroTitle: "כשכל רחפן הופך",
    heroTitleSub: "לאיום פוטנציאלי.",
    heroBody:
      "גילוי, עקיבה והתרעה מוקדמת מפני כטב\"מים, מבוססי AI. LKM-Drone הופך את תשתית התצפית הקיימת שלכם למערך גילוי פעיל של איומים אוויריים — מגלה רחפנים לפני שהם הופכים לאיום, גם כשהם נראים כפיקסלים בודדים בלבד.",
    requestDemo: "בקשת הדגמה",
    downloadFieldReport: "הורדת דוח השטח",
    viewArchitecture: "צפייה בארכיטקטורה",
    trust: ["גילוי ברמת הפיקסל", "AI התנהגותי", "חיישנים קיימים", "יום ולילה"],
    scopeCaption: "סקופ מפעיל · סיווג התנהגותי חי של מגע אווירי",
    scopeClassification: "כטב\"ם עוין — סבירות גבוהה",
    scopeTrackNote:
      "גישה נמוכה ולא יציבה מצפון-מזרח. פרצי ריחוף ותיקוני מסלול חוזרים — מתיישב עם רחפן מיוצב, לא עם ציפור.",
    challengeTitle:
      "רחפנים קטנים וזולים טסים נמוך, נעים באופן בלתי צפוי, ונשארים בלתי מורגשים עד שהם כבר בטווח.",
    challengeP1:
      "רחפנים מודרניים מסוגלים לאיסוף מודיעין, תצפית, סימון מטרות, נשיאת מטענים ותקיפה ישירה. הם מייצרים חתימת מכ\"ם מזערית וקשים לגילוי באמצעים מסורתיים. יחידות צבאיות, כוחות גבול, מפעילי תשתיות קריטיות, שדות תעופה, אתרי אנרגיה וארגוני ביטחון פנים ניצבים כולם מול אותה מציאות: זיהוי איום אווירי שניות מוקדם יותר יכול להיות ההבדל בין תגובה מוצלחת לאירוע חמור.",
    challengeP2:
      "Ghost בנה את LKM-Drone כדי לסגור את הפער הזה — גילוי, ניתוח והתרעה על פעילות רחפנים לפני שהיא הופכת לאיום.",
    doctrineTitle: "Ghost מנתח התנהגות, לא רק צורה.",
    doctrineBody:
      "LKM-Drone אינו מערכת ניטור וידאו. זוהי שכבת Visual Intelligence מבוססת AI שמנתחת ברציפות את המרחב האווירי באמצעות חיישנים קיימים וייעודיים, כדי לאתר פעילות אווירית חריגה בזמן אמת.",
    doctrineLines: [
      "במקום לחפש רק צורות של רחפנים — Ghost מנתח התנהגות.",
      "במקום להסתמך על פריים בודד — Ghost בוחן תנועה לאורך זמן.",
      "במקום להציג פידים של וידאו — Ghost מבין מה קורה.",
    ],
    doctrineNote:
      "כך מתאפשר גילוי אמין גם כשרחפן נראה כפיקסלים בודדים — או כפיקסל יחיד — בתוך חיישן המצלמה.",
    evaluatedLabel: "נבחן ברציפות",
    evaluates: [
      "מסלולי תנועה",
      "התנהגות טיסה",
      "דפוסי ייצוב",
      "שינויי כיוון",
      "חתימות תרמיות",
      "מיקרו-רעידות",
      "אנומליות סביבתיות",
      "התמדת עצם במרחב",
      "סבירות איום",
    ],
    pixelP1:
      "רוב מערכות הראייה הממוחשבת מאומנות לזהות אובייקטים גדולים וגלויים — אנשים, כלי רכב, כלי שיט, ציוד. במרחקים מבצעיים, רחפן עשוי לתפוס קומץ פיקסלים בלבד ולהיות כמעט בלתי ניתן להבחנה מרעש הרקע. זיהוי אובייקטים מסורתי הופך לחסר תועלת.",
    pixelP2: "Ghost פותר זאת באמצעות ניתוח טמפורלי מתקדם ואינטליגנציה התנהגותית.",
    traditionalAskLabel: "מערכות מסורתיות שואלות",
    traditionalAsk: "\"האם זה נראה כמו רחפן?\"",
    ghostAskLabel: "Ghost שואל",
    ghostAskPre: "\"האם זה ",
    ghostAskAccent: "מתנהג",
    ghostAskPost: " כמו רחפן?\"",
    techTitle: "שלוש שכבות של אינטליגנציה התנהגותית, פועלות כאחת.",
    techBody:
      "Micro-Signature Tracking, Micro-Flutter Analysis ו-Heat Atlas רצים יחד על כל חיישן — והופכים תנועה קלושה לסבירות איום מכוילת ועמידה בביקורת.",
    engines: [
      {
        tagline: "זיהוי דפוסי טיסה בלתי נראים",
        imageAlt:
          "חתימת וקטור של נתיב טיסה כפי שהמודל רואה אותה — דפוס תנועה, לא אובייקט",
        body: "כל עצם אווירי מייצר חתימת תנועה ייחודית. Ghost מנתח ברציפות שינויי מיקום, עקביות טיסה, תאוצה, התנהגות ריחוף ותיקוני מסלול כדי לסווג את סבירות האיום האווירי בדיוק יוצא דופן.",
        points: [
          "פרופיל מיקום ותאוצה",
          "ניתוח ריחוף ותיקוני מסלול",
          "הפרדה בין ציפור, רחפן וכלי טיס",
        ],
      },
      {
        tagline: "גילוי התנהגות ייצוב של רחפנים",
        imageAlt:
          "חתימת רפרוף של מיקרו-רעידות כפי שהמודל רואה אותה — דפוס תדר, לא אובייקט",
        body: "כל רחפן מבצע אלפי תיקוני ייצוב בדקה כדי לפצות על רוח, טורבולנציה ומטען. אלה יוצרים דפוסי תנועה מיקרוסקופיים — בלתי נראים למפעילים, אך ניתנים לגילוי בניתוח פריים-אחר-פריים.",
        points: [
          "חילוץ מיקרו-רעידות פריים-אחר-פריים",
          "טביעת אצבע של ייצוב בקר הטיסה",
          "דחיית התראות שווא בביטחון גבוה",
        ],
      },
      {
        tagline: "מידול תרמי דינמי של הסביבה",
        imageAlt:
          "מודל תרמי התנהגותי כפי שהמודל רואה אותו — אזורים יציבים ודינמיים, לא אובייקטים",
        body: "Heat Atlas בונה ברציפות מודל תרמי חי של הסביבה המבצעית — לומד אזורים יציבים ודינמיים, התנהגות שגרתית ותנודות צפויות — כך שהמערכת מבינה את הסצנה לפני שהיא מחפשת איומים.",
        points: [
          "מיפוי תרמי חי של אזורים יציבים / דינמיים",
          "למידת דפוסים תרמיים היסטוריים",
          "צמצום דרמטי של התראות שווא ברגישות גבוהה",
        ],
      },
    ],
    engineCaption: "כפי שהמודל רואה · דפוס, לא אובייקט",
    lifecycleTitle: "שישה שלבים. לולאה רציפה אחת. גילוי לבדו אינו מספיק.",
    lifecycle: [
      { label: "תצפית", sub: "חיישנים קיימים וייעודיים מזרימים את המרחב האווירי." },
      { label: "גילוי", sub: "ניתוח התנהגותי וטמפורלי מסמן תנועה חריגה." },
      { label: "סיווג", sub: "מיקרו-חתימות מפרידות רחפנים מציפורים ומרעש." },
      { label: "עקיבה", sub: "מסלול, כיוון והתמדה נעקבים בזמן אמת." },
      { label: "התראה", sub: "המפעילים מקבלים מיקום, כיוון התקדמות ורמת ביטחון — מיד." },
      { label: "תחקור", sub: "כל אירוע נשמר, ניתן לחיפוש ומוצלב מחדש." },
    ],
    awareness: [
      { title: "התראות מיידיות", body: "המפעילים מקבלים הודעה ברגע שאיום אווירי פוטנציאלי מאומת." },
      { title: "מיקום וכיוון התקדמות", body: "מיקום, כיוון תנועה ורמת ביטחון מוצגים יחד." },
      { title: "ציון ביטחון", body: "כל מגע נושא ציון סבירות איום מכויל." },
      { title: "היסטוריית אירועים ניתנת לחיפוש", body: "כל אירוע נשמר וזמין לניתוח ולהצלבה עתידיים." },
      { title: "תחקירים אוטומטיים", body: "מגעים קריטיים פותחים שרשורי תחקיר אוטומטיים." },
      { title: "הסלמה", body: "אירועים מאומתים עוברים הסלמה אוטומטית לגורמים הנכונים." },
    ],
    environments: [
      {
        title: "סביבות מדבריות",
        points: ["טמפרטורות קיצוניות", "עיוות חום", "אבק וחול", "ראות לטווח ארוך"],
      },
      {
        title: "אזורים עירוניים",
        points: ["עומס ויזואלי צפוף", "בניינים ומבנים", "תנועה מורכבת", "פעילות רקע גבוהה"],
      },
      {
        title: "מבצעי ביטחון גבולות",
        points: ["תצפית רחבת שטח", "ניטור שטחים פתוחים", "פריסה מרוחקת", "כיסוי מתמשך"],
      },
      {
        title: "מבצעי לילה",
        points: ["תנאי אפס אור", "גילוי תרמי בלבד", "ניטור רציף", "יכולת זהה ביום ובלילה"],
      },
    ],
    experienceTitle: "מפעילים שואלים שאלות. Ghost עונה במודיעין.",
    experienceBody:
      "Ghost פועל לפי פילוסופיה שונה מהיסוד מפלטפורמות VMS מסורתיות. המשתמש מתקשר דרך חוויית צ'אט מוכרת — לא ממשק חמ\"ל מסורבל — ומקבל סיכומי מודיעין עשירים במקום התראות פשוטות.",
    contactMap: [
      { a: "מצלמה", b: "איש קשר" },
      { a: "מצלמות מרובות", b: "קבוצה מבצעית" },
      { a: "פיד וידאו", b: "מקור מודיעיני" },
    ],
    queries: [
      "התגלו כטב\"מים ב-24 השעות האחרונות?",
      "הצג את כל האיומים האוויריים שהתגלו ליד הגדר ההיקפית.",
      "איפה התגלה הרחפן האחרון, ובאיזה כיוון התקדמות?",
      "כמה זמן הוא שהה באזור?",
      "האם זה אותו עצם שהתגלה מוקדם יותר השבוע?",
    ],
    composerPlaceholder: "שאלו על כל מגע אווירי…",
    deploymentIntro:
      "LKM-Drone משדרג את השקעות האבטחה הנוכחיות בלי להחליף תשתית קיימת. ניתן לפרוס אותו על כל שילוב של הבאים:",
    deployment: [
      { title: "מצלמות תצפית קיימות", body: "שימוש חוזר בצי שכבר מכסה את האתר שלכם." },
      { title: "מערכות הדמיה תרמית", body: "גילוי תרמי בלבד ללילה ולתנאי אפס אור." },
      { title: "חיישני תצפית ייעודיים", body: "אופטיקה ייעודית לגזרות ארוכות טווח." },
      { title: "מחשבי קצה טקטיים", body: "עיבוד באתר, ללא תלות בענן." },
      { title: "עמדות מבצעיות ניידות", body: "עמדות קדמיות הניתנות לפריסה מהירה." },
      { title: "תשתית אבטחה קבועה", body: "אינטגרציה לחמ\"לים קבועים." },
    ],
    useCases: [
      { title: "הגנת כוחות צבאיים", body: "התרעה מוקדמת מפני פעילות רחפנים עוינת ליד כוחות פרוסים." },
      { title: "ביטחון גבולות", body: "ניטור רציף של גזרות מבצעיות רחבות ושטחים פתוחים." },
      { title: "תשתיות קריטיות", body: "הגנה על תחנות כוח, מתקני אנרגיה, מוקדי תחבורה ונכסים אסטרטגיים." },
      { title: "בסיסים ומתקנים צבאיים", body: "תצפית אווירית מתמדת וגילוי איומים מעל מתקנים." },
      { title: "אבטחת שדות תעופה ומרחב אווירי", body: "איתור פעילות רחפנים בלתי מורשית במרחב אווירי מבוקר." },
      { title: "תעשייה ומסחר", body: "הגנה על מפעלים, מחסנים, מרכזים לוגיסטיים ואתרים בעלי ערך גבוה." },
    ],
    benefits: [
      "גילוי מוקדם של איומים אוויריים קטנים",
      "ניתוח התנהגותי מבוסס AI",
      "פחות התראות שווא",
      "מודיעין איומים בזמן אמת",
      "היסטוריית אירועים ניתנת לחיפוש",
      "אינטגרציה עם תשתית קיימת",
      "יכולת פריסה מהירה",
      "חוויית תפעול מבוססת צ'אט",
      "למידה והסתגלות מתמשכות",
    ],
    summaryBody:
      "LKM-Drone הופך תשתית תצפית לרשת מודיעין אווירי פעילה. בשילוב ראייה ממוחשבת מתקדמת, ניתוח התנהגותי, מודיעין תרמי ואינטראקציה בשפה טבעית, Ghost נותן לצוותי אבטחה גילוי מוקדם יותר, החלטות מהירות יותר ומודעות מבצעית גבוהה יותר. ככל שאיומים אוויריים נעשים קטנים, מהירים וקשים יותר לגילוי, ארגונים צריכים יותר ממצלמות. הם צריכים מודיעין. ",
    summaryAccent: "Ghost מספק אותו.",
    reportTitle: "דוח השטח של LKM-Drone ללוחמה בכטב\"מים.",
    reportBody:
      "תקציר בן חמישה עמודים המכסה את דוקטרינת הגילוי, המנוע הקנייני ותוצאות מניסוי שטח מבוקר בלוחמה בכטב\"מים — כולל סיווג תרמי בלבד של רחפן מיוצב. משוחרר על בסיס צורך-לדעת תחת NDA.",
    reportItems: [
      "דוקטרינת איום וגילוי",
      "מנוע גילוי קנייני",
      "ראיות מניסוי שטח",
      "פריסה ובקרת הפצה",
    ],
    reportDocMeta: "PDF · 5 עמודים · אנגלית",
    reportDownload: "הורדת הדוח",
    reportFootnote: "נדרשים שם מלא, חברה, אימייל עבודה וטלפון נייד.",
    ctaTitle: "ראו את LKM-Drone מול מרחב אווירי חי.",
    ctaBody:
      "בקשו הדגמה והצוות שלנו יתאם תדריך מאובטח, מותאם לחיישנים, לטופוגרפיה ולגזרה המבצעית שלכם.",
    explorePlatform: "היכרות עם הפלטפורמה",
  },
};
