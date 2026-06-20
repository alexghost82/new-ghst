import type { Locale } from "../../stores/languageStore";

// ── Partners — bilingual page copy ──
// Tactical mono labels (section labels, the "Ghost Partner Summit" image
// badge and the footer brand line) are brand-signature English and stay
// hardcoded in the component; everything a visitor *reads* lives here, per
// locale. English is the original copy, byte-for-byte.

export interface PartnersItemCopy {
  title: string;
  body: string;
}

export interface PartnersTrackCopy {
  title: string;
  summary: string;
  points: string[];
}

export interface PartnersStepCopy {
  step: string;
  title: string;
  body: string;
}

export interface PartnersCopy {
  accessLabel: string;
  heroTitle: string;
  heroTitleSub: string;
  heroBody: string;
  howToJoin: string;
  heroImageAlt: string;
  whyTitle: string;
  whyBody: string;
  audiences: PartnersItemCopy[];
  strategyTitle: string;
  strategyBody: string;
  tracksTitle: string;
  tracks: PartnersTrackCopy[];
  stepsTitle: string;
  steps: PartnersStepCopy[];
  supportTitle: string;
  support: PartnersItemCopy[];
  supportFootnote: string;
  portalTitle: string;
  portalBody: string;
  portalPoints: string[];
  diffTitle: string;
  diffTitleSub: string;
  differentiators: PartnersItemCopy[];
  quote: string;
  quoteBody: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
}

export const PARTNERS_COPY: Record<Locale, PartnersCopy> = {
  en: {
    accessLabel: "Become a partner",
    heroTitle: "Everything is about to change.",
    heroTitleSub: "Join the right side of the shift.",
    heroBody:
      "Ghost transforms security cameras into an intelligent system you can talk to. Recurring commission from every payment your referred customers make. Always.",
    howToJoin: "How to join",
    heroImageAlt:
      "Ghost partners and distributors conference — the Ghost mark glowing on stage",
    whyTitle: "A product that sells itself.",
    whyBody:
      "Ghost isn't just another security product. Everyone who hears about it for the first time immediately understands it's something different. The sales barrier is virtually nonexistent — because Ghost's promise is clear, immediate, and compelling: talk to your cameras and get answers.",
    audiences: [
      {
        title: "For Independent Installers",
        body: "Camera installer, low-voltage technician, intercom and alarm specialist? Offer your customers a unique service — smart monitoring and alerts. A new passive income stream without changing your daily work.",
      },
      {
        title: "For Installation Companies",
        body: "Have installation teams and existing customers? Ghost creates a significant, ongoing revenue stream without adding work. Every customer that connects = a fixed monthly commission for you.",
      },
      {
        title: "For Sales Professionals",
        body: "Not from the industry? No matter. Ghost is your entry ticket to video analytics — one of the fastest-growing fields in tech. Steady income from customers you refer. Main or side occupation.",
      },
    ],
    strategyTitle: "Not every customer is ready to pay from day one? Totally fine.",
    strategyBody:
      "Install the free version of Ghost for your customers. Ghost will convert them to paying subscribers — sooner or later. Once a customer upgrades to a paid plan, you start earning commission.",
    tracksTitle: "Distributor or Ambassador — what fits you?",
    tracks: [
      {
        title: "Ghost Partner — Distributor",
        summary:
          "From sales agents who spotted an opportunity, independent camera installers, low-voltage technicians — to companies with installation teams.",
        points: [
          "A product that everyone says Wow to — near-zero sales barrier",
          "Entry ticket to video analytics — one of the fastest-growing fields in tech",
          "Steady, recurring income from previously referred customers",
          "Marketing support, sales training, and professional materials",
        ],
      },
      {
        title: "Ghost Ambassador",
        summary:
          "Ambassadors create large-scale deals — with public, governmental, defense, or Enterprise clients.",
        points: [
          "Direct access to the Ghost team for complex deal support",
          "Unique terms for large-scale deals",
          "Long-term strategic partnership with Ghost",
          "Represent Ghost at forums, conferences, and tenders",
        ],
      },
    ],
    stepsTitle: "Four steps to get started.",
    steps: [
      {
        step: "01",
        title: "Introductory Call",
        body: "An initial call for mutual understanding — who you are, your background, and what you're looking for in a partnership with Ghost.",
      },
      {
        step: "02",
        title: "In-Depth Meeting",
        body: "A face-to-face meeting at Ghost's offices in Acre or Tel Aviv — deeper introduction, product presentation, and live demo.",
      },
      {
        step: "03",
        title: "Training & Certification",
        body: "A full training day including sales training, in-depth product familiarization, and receiving an official Ghost Authorized Distributor certificate.",
      },
      {
        step: "04",
        title: "Start Operating",
        body: "You start building your Users Bank — the list of customers you've brought. Every subscriber added = steady income for you.",
      },
    ],
    supportTitle: "You're not alone. Ghost is by your side.",
    support: [
      {
        title: "Sales Training & Guidance",
        body: "Regular hands-on training sessions to improve performance and stay updated on new capabilities.",
      },
      {
        title: "Marketing Materials",
        body: "Presentations, videos, sales materials, and product sheets — ready for immediate use.",
      },
      {
        title: "Sponsored Campaigns",
        body: "Digital campaign management and social media posting on your behalf — at no cost.*",
      },
      {
        title: "Official Distributor Portal",
        body: "Access to a dedicated management portal — view, add, edit, and manage your customer list.",
      },
    ],
    supportFootnote:
      "* Campaign management and social media publishing subject to terms and activity scope.",
    portalTitle: "Full transparency. From day one.",
    portalBody:
      "Get access to an official distributor portal that lets you view, add, edit, and manage your Users Bank. Transparency and fairness — from day one through years ahead.",
    portalPoints: [
      "View and update your Users Bank in real time",
      "Payment and billing data for every customer",
      "Commissions due and commissions paid",
      "Detailed status for every customer — tenure, debt, usage data",
      "Add new customers directly from the portal",
      "Personal performance reports",
    ],
    diffTitle: "Ghost isn't just another security system.",
    diffTitleSub: "Ghost changes the rules.",
    differentiators: [
      {
        title: "Conversation Instead of Search",
        body: "Instead of scrolling through hours of video — just ask. Ghost answers in seconds.",
      },
      {
        title: "No Fixed Capability List",
        body: "Ghost isn't limited to 50 detection types. It understands anything that can be described in words.",
      },
      {
        title: "No Model Training",
        body: "No labeling, examples, or tuning needed. Users simply write in free language.",
      },
      {
        title: "3CLICKS — Any Camera in 3 Clicks",
        body: "Even in organizations with thousands of cameras — reach any camera in 3 clicks. Like WhatsApp.",
      },
    ],
    quote:
      "“We don't know in advance what you'll want to check. And that's exactly the point.”",
    quoteBody:
      "Ghost enables every user to define what matters to them — the moment they think of it. No waiting for development, no model training, no limitations.",
    ctaTitle: "Leave your details and we'll get back to you.",
    ctaBody:
      "Want to learn more? Reach out and the Ghost partnerships team will walk you through the program and the next steps.",
    ctaButton: "Become a Ghost partner",
  },
  he: {
    accessLabel: "הצטרפו כשותפים",
    heroTitle: "הכול עומד להשתנות.",
    heroTitleSub: "הצטרפו לצד הנכון של המהפך.",
    heroBody:
      "Ghost הופך מצלמות אבטחה למערכת חכמה שאפשר לדבר איתה. עמלה חוזרת מכל תשלום של לקוח שהפניתם. תמיד.",
    howToJoin: "איך מצטרפים",
    heroImageAlt: "כנס שותפים ומפיצים של Ghost — סמל Ghost מואר על הבמה",
    whyTitle: "מוצר שמוכר את עצמו.",
    whyBody:
      "Ghost הוא לא עוד מוצר אבטחה. כל מי ששומע עליו בפעם הראשונה מבין מיד שמדובר במשהו אחר. חסם המכירה כמעט לא קיים — כי ההבטחה של Ghost ברורה, מיידית ומשכנעת: דברו עם המצלמות שלכם וקבלו תשובות.",
    audiences: [
      {
        title: "למתקינים עצמאיים",
        body: "מתקין מצלמות, טכנאי מתח נמוך, איש אינטרקום ואזעקות? הציעו ללקוחות שלכם שירות ייחודי — ניטור חכם והתראות. זרם הכנסה פסיבי חדש, בלי לשנות את העבודה היומיומית.",
      },
      {
        title: "לחברות התקנה",
        body: "יש לכם צוותי התקנה ולקוחות קיימים? Ghost מייצר זרם הכנסות משמעותי ומתמשך בלי תוספת עבודה. כל לקוח שמתחבר = עמלה חודשית קבועה עבורכם.",
      },
      {
        title: "לאנשי מכירות",
        body: "לא מהתחום? לא משנה. Ghost הוא כרטיס הכניסה שלכם לעולם הבנת הווידאו — אחד התחומים הצומחים בטק. הכנסה קבועה מלקוחות שהפניתם. עיסוק עיקרי או צדדי.",
      },
    ],
    strategyTitle: "לא כל לקוח מוכן לשלם מהיום הראשון? בסדר גמור.",
    strategyBody:
      "התקינו ללקוחות שלכם את הגרסה החינמית של Ghost. Ghost כבר ימיר אותם למנויים משלמים — במוקדם או במאוחר. ברגע שלקוח עובר למסלול בתשלום, אתם מתחילים לקבל עמלה.",
    tracksTitle: "מפיץ או שגריר — מה מתאים לכם?",
    tracks: [
      {
        title: "Ghost Partner — מפיץ",
        summary:
          "מסוכני מכירות שזיהו הזדמנות, דרך מתקיני מצלמות עצמאיים וטכנאי מתח נמוך — ועד חברות עם צוותי התקנה.",
        points: [
          "מוצר שכולם אומרים עליו וואו — חסם מכירה כמעט אפסי",
          "כרטיס כניסה לעולם הבנת הווידאו — אחד התחומים הצומחים בטק",
          "הכנסה קבועה וחוזרת מלקוחות שהופנו בעבר",
          "תמיכה שיווקית, הדרכות מכירה וחומרים מקצועיים",
        ],
      },
      {
        title: "Ghost Ambassador — שגריר",
        summary:
          "שגרירים מייצרים עסקאות בהיקפים גדולים — מול לקוחות ציבוריים, ממשלתיים, ביטחוניים או Enterprise.",
        points: [
          "גישה ישירה לצוות Ghost לליווי עסקאות מורכבות",
          "תנאים ייחודיים לעסקאות בהיקפים גדולים",
          "שותפות אסטרטגית ארוכת טווח עם Ghost",
          "ייצוג Ghost בפורומים, בכנסים ובמכרזים",
        ],
      },
    ],
    stepsTitle: "ארבעה שלבים כדי להתחיל.",
    steps: [
      {
        step: "01",
        title: "שיחת היכרות",
        body: "שיחה ראשונית להיכרות הדדית — מי אתם, מה הרקע שלכם ומה אתם מחפשים בשותפות עם Ghost.",
      },
      {
        step: "02",
        title: "פגישת עומק",
        body: "פגישה פנים אל פנים במשרדי Ghost בעכו או בתל אביב — היכרות מעמיקה, הצגת המוצר ודמו חי.",
      },
      {
        step: "03",
        title: "הדרכה והסמכה",
        body: "יום הדרכה מלא הכולל הדרכת מכירות, היכרות מעמיקה עם המוצר וקבלת תעודת Ghost Authorized Distributor רשמית.",
      },
      {
        step: "04",
        title: "יוצאים לדרך",
        body: "אתם מתחילים לבנות את ה-Users Bank שלכם — רשימת הלקוחות שהבאתם. כל מנוי שנוסף = הכנסה קבועה עבורכם.",
      },
    ],
    supportTitle: "אתם לא לבד. Ghost לצידכם.",
    support: [
      {
        title: "הדרכות מכירה וליווי",
        body: "מפגשי הדרכה מעשיים וקבועים לשיפור הביצועים ולהתעדכנות ביכולות חדשות.",
      },
      {
        title: "חומרי שיווק",
        body: "מצגות, סרטונים, חומרי מכירה ודפי מוצר — מוכנים לשימוש מיידי.",
      },
      {
        title: "קמפיינים ממומנים",
        body: "ניהול קמפיינים דיגיטליים ופרסום ברשתות החברתיות עבורכם — ללא עלות.*",
      },
      {
        title: "פורטל מפיצים רשמי",
        body: "גישה לפורטל ניהול ייעודי — צפייה, הוספה, עריכה וניהול של רשימת הלקוחות שלכם.",
      },
    ],
    supportFootnote:
      "* ניהול קמפיינים ופרסום ברשתות החברתיות בכפוף לתנאים ולהיקף הפעילות.",
    portalTitle: "שקיפות מלאה. מהיום הראשון.",
    portalBody:
      "קבלו גישה לפורטל מפיצים רשמי שמאפשר לצפות, להוסיף, לערוך ולנהל את ה-Users Bank שלכם. שקיפות והגינות — מהיום הראשון ולשנים קדימה.",
    portalPoints: [
      "צפייה ועדכון של ה-Users Bank בזמן אמת",
      "נתוני תשלומים וחיוב לכל לקוח",
      "עמלות לתשלום ועמלות ששולמו",
      "סטטוס מפורט לכל לקוח — ותק, חוב, נתוני שימוש",
      "הוספת לקוחות חדשים ישירות מהפורטל",
      "דוחות ביצועים אישיים",
    ],
    diffTitle: "Ghost הוא לא עוד מערכת אבטחה.",
    diffTitleSub: "Ghost משנה את הכללים.",
    differentiators: [
      {
        title: "שיחה במקום חיפוש",
        body: "במקום לגלול שעות של וידאו — פשוט שואלים. Ghost עונה בתוך שניות.",
      },
      {
        title: "בלי רשימת יכולות סגורה",
        body: "Ghost לא מוגבל לרשימה סגורה של 50 יכולות. הוא מבין כל מה שאפשר לתאר במילים.",
      },
      {
        title: "בלי אימון מודלים",
        body: "בלי תיוג, בלי דוגמאות ובלי כוונון. המשתמשים פשוט כותבים בשפה חופשית.",
      },
      {
        title: "3CLICKS — כל מצלמה בשלוש לחיצות",
        body: "גם בארגונים עם אלפי מצלמות — מגיעים לכל מצלמה בשלוש לחיצות. כמו WhatsApp.",
      },
    ],
    quote: "“אנחנו לא יודעים מראש מה תרצו לבדוק. וזו בדיוק הנקודה.”",
    quoteBody:
      "Ghost מאפשר לכל משתמש להגדיר מה חשוב לו — ברגע שזה עולה בראש. בלי לחכות לפיתוח, בלי אימון מודלים, בלי מגבלות.",
    ctaTitle: "השאירו פרטים ונחזור אליכם.",
    ctaBody:
      "רוצים לשמוע עוד? השאירו פרטים וצוות השותפויות של Ghost יעבור איתכם על התוכנית ועל הצעדים הבאים.",
    ctaButton: "הפכו לשותפים של Ghost",
  },
};
