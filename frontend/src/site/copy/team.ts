import type { Locale } from "../../stores/languageStore";

// ── The People Behind Ghost — bilingual page copy ──
// Hard brand rules: people's NAMES stay English in both locales (only the
// role and story translate); tactical mono chips ("Identity protected",
// member tags, "Signal · Live") and the "Ghost // …" section labels are
// brand-signature English and stay hardcoded in the component. English is
// the original copy, byte-for-byte.

export type TeamMemberId =
  | "omer"
  | "yevgeny"
  | "ido"
  | "yehonatan"
  | "noa"
  | "shai";

export interface TeamMemberCopy {
  role: string;
  story: string;
}

export interface TeamCopy {
  heroTitle: string;
  heroBody: string;
  privacyNote: string;
  groupAlt: string;
  groupCaption: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  members: Record<TeamMemberId, TeamMemberCopy>;
}

export const TEAM_COPY: Record<Locale, TeamCopy> = {
  en: {
    heroTitle: "The people behind Ghost.",
    heroBody:
      "A small team out of the operations, defense, and infrastructure worlds, building one thing: cameras that understand. We work quietly, and so do our portraits — every face on this page is pixelated on purpose.",
    privacyNote:
      "Faces are intentionally obscured. Privacy by default isn't a feature we sell — it's how we operate.",
    groupAlt: "The Ghost leadership team — identities protected",
    groupCaption:
      "Six people, one black sweater each, and a standing rule: the work speaks louder than the faces.",
    ctaTitle: "Want to work with the people behind the pixels?",
    ctaBody:
      "We talk to operators, partners, and builders who take their cameras as seriously as we do. Reach out — the team will answer.",
    ctaButton: "Request operational access",
    members: {
      omer: {
        role: "Chief Executive Officer",
        story:
          "Omer spent fifteen years on the operator's side of the glass — watching feeds that no one had time to actually watch. He started Ghost on a single conviction: a camera should answer questions, not just record them. He sets the company's direction and keeps it honest to that first idea.",
      },
      yevgeny: {
        role: "Chairman of the Board",
        story:
          "Yevgeny built and scaled two infrastructure companies before Ghost, and learned the hard way that the right architecture decides whether a product survives its first thousand sites. As Chairman he guards the long view — capital, governance, and the discipline to grow without losing the plot.",
      },
      ido: {
        role: "VP, Defense Division",
        story:
          "Ido comes from the field, where a missed detail costs more than a quarter. He leads Ghost's defense and national-security work, translating operational doctrine into systems that hold up under pressure — and saying no to anything that wouldn't.",
      },
      yehonatan: {
        role: "Head of Retail & Energy",
        story:
          "Yehonatan ran loss-prevention and site operations across hundreds of retail and fuel locations before joining Ghost. He owns the verticals where margins are thin and every alert has to earn its place — turning plain-language checks into measurable savings on the ground.",
      },
      noa: {
        role: "Head of Business Development",
        story:
          "Noa opens the rooms and reads them. She maps where Ghost belongs next — new sectors, partners, and markets — and brings the customer's real problem back into the building before a line of the answer is written.",
      },
      shai: {
        role: "Co-Chief Executive Officer",
        story:
          "Shai runs the engine room. As Co-CEO he turns strategy into shipped product and a team that can keep shipping — pairing a builder's instinct with the patience to make complex systems feel quiet and inevitable.",
      },
    },
  },
  he: {
    heroTitle: "האנשים מאחורי Ghost.",
    heroBody:
      "צוות קטן שמגיע מעולמות התפעול, הביטחון והתשתיות, ובונה דבר אחד: מצלמות שמבינות. אנחנו עובדים בשקט, וכך גם הדיוקנאות שלנו — כל פנים בעמוד הזה מפוקסלות בכוונה.",
    privacyNote:
      "הפנים מטושטשות בכוונה. פרטיות כברירת מחדל היא לא פיצ'ר שאנחנו מוכרים — זו הדרך שבה אנחנו פועלים.",
    groupAlt: "צוות ההנהגה של Ghost — זהויות מוגנות",
    groupCaption:
      "שישה אנשים, סוודר שחור אחד לכל אחד, וכלל קבוע: העבודה מדברת חזק יותר מהפנים.",
    ctaTitle: "רוצים לעבוד עם האנשים שמאחורי הפיקסלים?",
    ctaBody:
      "אנחנו מדברים עם מפעילים, שותפים ובונים שמתייחסים למצלמות שלהם ברצינות כמונו. פנו אלינו — הצוות יענה.",
    ctaButton: "בקשת גישה מבצעית",
    members: {
      omer: {
        role: "מנכ\"ל",
        story:
          "עומר בילה חמש-עשרה שנים בצד המפעיל של הזכוכית — מול פידים שלאיש לא היה זמן באמת לצפות בהם. הוא הקים את Ghost מתוך הכרה אחת: מצלמה צריכה לענות על שאלות, לא רק להקליט אותן. הוא מתווה את כיוון החברה ושומר שתישאר נאמנה לרעיון הראשון.",
      },
      yevgeny: {
        role: "יו\"ר הדירקטוריון",
        story:
          "יבגני בנה והצמיח שתי חברות תשתית לפני Ghost, ולמד בדרך הקשה שהארכיטקטורה הנכונה קובעת אם מוצר ישרוד את אלף האתרים הראשונים שלו. כיו\"ר הוא שומר על המבט הארוך — הון, ממשל תאגידי, והמשמעת לצמוח בלי לאבד את הכיוון.",
      },
      ido: {
        role: "סמנכ\"ל, חטיבת הביטחון",
        story:
          "עידו מגיע מהשטח, שם פרט שפוספס עולה יותר מרבעון. הוא מוביל את פעילות הביטחון והביטחון הלאומי של Ghost, מתרגם דוקטרינה מבצעית למערכות שעומדות בלחץ — ואומר לא לכל מה שלא יעמוד.",
      },
      yehonatan: {
        role: "ראש תחום קמעונאות ואנרגיה",
        story:
          "יהונתן ניהל מניעת אובדן ותפעול אתרים במאות נקודות קמעונאות ודלק לפני שהצטרף ל-Ghost. הוא אחראי על הוורטיקלים שבהם השוליים דקים וכל התראה צריכה להצדיק את מקומה — והופך בדיקות בשפה טבעית לחיסכון מדיד בשטח.",
      },
      noa: {
        role: "ראש פיתוח עסקי",
        story:
          "נועה פותחת את החדרים וקוראת אותם. היא ממפה לאן Ghost שייך בשלב הבא — סקטורים, שותפים ושווקים חדשים — ומחזירה את הבעיה האמיתית של הלקוח אל תוך הבניין לפני ששורה אחת מהפתרון נכתבת.",
      },
      shai: {
        role: "מנכ\"ל-שותף",
        story:
          "שי מנהל את חדר המכונות. כמנכ\"ל-שותף הוא הופך אסטרטגיה למוצר שיוצא לשטח ולצוות שיכול להמשיך לספק — ומחבר אינסטינקט של בונה מערכות עם הסבלנות להפוך מערכות מורכבות לשקטות ומובנות מאליהן.",
      },
    },
  },
};
