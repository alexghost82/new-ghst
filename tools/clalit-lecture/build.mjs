#!/usr/bin/env node
// Builds the Ghost lecture deck (Clalit — violence prevention) as a 16:9
// landscape gopdf HTML at the repo root. Run: node tools/clalit-lecture/build.mjs
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "clalit-violence-lecture.html");
const OUT_CLEAN = resolve(ROOT, "clalit-violence-lecture-clean.html");
const ICON = "frontend/public/ghost-icon.png";

/* ---------------------------------------------------------------- slides */

const slides = [
  /* ------------------------------------------------ 01 — cover */
  {
    nav: "פתיחה",
    title: "פתיחה",
    minutes: 4,
    bubble: "על מה נדבר בשעה הקרובה?",
    body: `
      <div class="kicker mono">GHOST // LECTURE · HEALTHCARE SAFETY</div>
      <p class="lead">המצלמות במרפאה רואות הכול.<br/><span class="dim">השאלה היא מי מקשיב להן בזמן.</span></p>
      <p>הרצאת תוכן על מניעת אלימות במוסדות רפואיים: מה השתנה בטכנולוגיה של הבנת וידאו, איך מצלמות הופכות משחזור-בדיעבד לכלי מניעה בזמן אמת, ומה זה דורש מארגון בריאות — בלי להחליף אף מצלמה.</p>
      <div class="chips">
        <div class="chip"><div class="c-t">חלק 1 · המציאות והפער</div><div class="c-d">אלימות במערכת הבריאות, ולמה המצלמות של היום לא מונעות אותה.</div></div>
        <div class="chip"><div class="c-t">חלק 2 · הטכנולוגיה</div><div class="c-d">הבנת סצנות ויזואליות בשפה טבעית — ושינוי הממשק שמגיע איתה.</div></div>
        <div class="chip"><div class="c-t">חלק 3 · היישומים</div><div class="c-d">ציר הזמן של אירוע אלים, חלון המניעה, ותרחישים מהמרחב הרפואי.</div></div>
        <div class="chip"><div class="c-t">חלק 4 · אתיקה והטמעה</div><div class="c-d">פרטיות מטופלים, האדם שבמרכז, ומה נדרש כדי שזה יעבוד.</div></div>
      </div>`,
    speaker: {
      say: "אני לא כאן כדי למכור לכם מערכת. אני כאן כדי להסביר מה השתנה — ולמה זה חשוב דווקא לכם.",
      points: [
        "הצג את עצמך ואת הרקע שלך (עד 2 דקות).",
        "פתח בסיפור אישי קצר מביקור במרפאה או במלר\"ד — רגע של מתח שכולם מכירים.",
        "הדגש מפורשות: זו הרצאת תוכן על טכנולוגיה ויישומים, לא מצגת מכירה.",
        "עבור על ארבעת החלקים והבטח שעה אחת בלי באזוורדס.",
      ],
    },
  },

  /* ------------------------------------------------ 02 — the reality */
  {
    nav: "המציאות בשטח",
    title: "המציאות בשטח",
    minutes: 6,
    bubble: "כמה גדולה באמת בעיית האלימות במערכת הבריאות?",
    body: `
      <p class="lead">אלימות נגד צוותים רפואיים היא לא אירוע חריג. <span class="dim">היא שגרה יומיומית.</span></p>
      <p>בכל יום מדווחים במערכת הבריאות בישראל אירועי אלימות — במרפאות הקהילה, בבתי המרקחת, במוקדי הקבלה ובמחלקות לרפואה דחופה. הצוותים שבחזית — אחיות ואחים, מזכירות רפואיות, רוקחים ומאבטחים — סופגים את רובם.</p>
      <div class="stats">
        <div class="stat"><div class="s-b">כל יום</div><div class="s-l">אירועי אלימות מדווחים במרפאות ובבתי החולים</div></div>
        <div class="stat"><div class="s-b">דלפק ומלר"ד</div><div class="s-l">מוקדי הסיכון המרכזיים — נקודות ההמתנה והחיכוך</div></div>
        <div class="stat"><div class="s-b">מילולי ← פיזי</div><div class="s-l">רוב האירועים הפיזיים מתחילים בהסלמה מילולית</div></div>
        <div class="stat"><div class="s-b">תת-דיווח</div><div class="s-l">חלק ניכר מהאירועים כלל אינו מדווח</div></div>
      </div>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">המחיר האנושי</div><div class="ft-desc">שחיקה, פחד, נטישת מקצועות הסיעוד והקבלה — עוד לפני שדיברנו על פציעות.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">המחיר הארגוני</div><div class="ft-desc">ימי היעדרות, תחלופת עובדים, אבטחה מתוגברת, ופגיעה ברצף הטיפול.</div></div></li>
      </ul>`,
    speaker: {
      say: "מי שיושב כאן באולם לא צריך שאקריא לו סטטיסטיקות. אתם חיים את זה.",
      points: [
        "פתח בהצבעה: \"מי כאן חווה אלימות מילולית בעבודה בשנה האחרונה?\" — תן לתוצאה לדבר.",
        "לפני הכנס: עדכן את הנתונים מהדוח השנתי העדכני של משרד הבריאות וציין מקור.",
        "הדגש את תופעת תת-הדיווח — המספרים הרשמיים הם רצפה, לא תקרה.",
        "אם מזכירים אירועים קשים מהעבר — בזהירות וברגישות, בלי שמות ובלי פרטים מזהים.",
      ],
    },
  },

  /* ------------------------------------------------ 03 — the paradox */
  {
    nav: "הפרדוקס של המצלמות",
    title: "הפרדוקס של המצלמות",
    minutes: 5,
    bubble: "אם בכל מרפאה יש מצלמות — למה הן לא מונעות כלום?",
    body: `
      <p class="lead">המצלמה של היום היא עד ראייה. <span class="dim">לא שומר סף.</span></p>
      <p>כמעט כל מתקן רפואי מכוסה במצלמות. ובכל זאת — האירועים קורים מול העדשה, והמערכת לומדת עליהם רק אחרי שהם הסתיימו. הבעיה היא לא בעיניים. הבעיה היא בקשב.</p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">attention-gap</span><span class="copy mono" dir="ltr">today</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t">קיר של 32 מסכים</span><span class="n-s">בעמדת האבטחה</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">זוג עיניים אחד</span><span class="n-s">אם בכלל</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">קשב מוגבל</span><span class="n-s">עייפות, ריבוי משימות</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">צפייה בדיעבד</span><span class="n-s">אחרי האירוע</span></div>
          </div>
        </div>
      </div>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">ההקלטה היא ראייתית, לא מונעת</div><div class="ft-desc">היא מצוינת לחקירה ולתביעה — ולא שווה דבר ברגע שבו ההסלמה מתרחשת.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">אף אדם לא צופה בעשרות מסכים</div><div class="ft-desc">מחקרי קשב מראים ירידה חדה ביכולת לזהות אירוע כבר אחרי דקות ספורות של צפייה במסכים מרובים.</div></div></li>
      </ul>`,
    speaker: {
      say: "ההקלטה מספרת מה קרה. מניעה דורשת להבין מה קורה — עכשיו.",
      points: [
        "שאל את הקהל: מתי בפעם האחרונה מישהו אצלכם \"תפס\" אירוע במצלמה בזמן אמת, ולא בדיעבד?",
        "הסבר את פער הקשב: המצלמות התרבו, אבל זוג העיניים שמולן נשאר אחד.",
        "סגור את החלק הראשון של ההרצאה במשפט המפתח שלמעלה — והשהה שנייה לפני המעבר לטכנולוגיה.",
      ],
    },
  },

  /* ------------------------------------------------ 04 — what changed */
  {
    nav: "מה השתנה בטכנולוגיה",
    title: "מה השתנה בטכנולוגיה",
    minutes: 6,
    bubble: "מה בעצם השתנה, שמאפשר היום משהו אחר?",
    body: `
      <p class="lead">מודלים שמבינים תמונה כמו אדם — <span class="dim">ומדברים איתנו בשפה שלנו.</span></p>
      <p>בשנים האחרונות נולד דור חדש של מודלים שמחברים ראייה ושפה. הם לא מסמנים ריבועים סביב עצמים מתוך רשימה סגורה — הם מבינים סצנה שלמה: מי נמצא ביחס למה, מה מונח איפה, מה חריג בהקשר הזה. ומכיוון שהם מבינים שפה, אפשר פשוט לכתוב להם מה חשוב לנו.</p>
      <div class="chips">
        <div class="chip"><div class="c-t">הבנת סצנה, לא תיוג</div><div class="c-d">המערכת מתארת מצב והקשר — כמו אדם חכם שמסתכל על המסך — ולא רשימת עצמים.</div></div>
        <div class="chip"><div class="c-t">שפה טבעית</div><div class="c-d">מגדירים מה חשוב במשפט בעברית. בלי כללים, בלי תכנות, בלי הגדרות מסובכות.</div></div>
        <div class="chip"><div class="c-t">ללא אימון וללא איסוף דאטה</div><div class="c-d">אין צורך ללמד את המערכת מראש. כל מה שאפשר לתאר במילים — אפשר לבקש.</div></div>
        <div class="chip"><div class="c-t">על המצלמות הקיימות</div><div class="c-d">שכבת הבנה מעל התשתית שכבר מותקנת. אף מצלמה לא מוחלפת.</div></div>
      </div>`,
    speaker: {
      say: "ההבדל הוא כמו ההבדל בין גלאי עשן — לבין אדם שנכנס לחדר ומריח שמשהו נשרף.",
      points: [
        "זה השקף הטכנולוגי המרכזי — דבר לאט וברור, הקהל אינו טכנולוגי.",
        "הסבר את ההבדל בין \"כלל קבוע שמופעל\" לבין \"הבנה של מצב\" עם דוגמה יומיומית.",
        "הדגש: אין רשימת יכולות סגורה ואין אימון — זה מה ששובר את התקרה של הדור הקודם.",
        "הימנע ממונחים טכניים. אם נשאלת על \"איך זה עובד בפנים\" — הפנה לשיחה אחרי ההרצאה.",
      ],
    },
  },

  /* ------------------------------------------------ 05 — 3CLICKS */
  {
    nav: "כל מצלמה היא שיחה",
    title: "שינוי הממשק: כל מצלמה היא שיחה",
    minutes: 4,
    bubble: "איך נראית עבודה מול מאות מצלמות — בלי קיר מסכים?",
    body: `
      <p class="lead">במקום קיר מסכים — רשימת שיחות. <span class="dim">כמו וואטסאפ.</span></p>
      <p>לפני שמדברים על בינה — מדברים על ממשק. כל מצלמה היא צ'אט. מצלמות מתארגנות בקבוצות — לפי מרפאה, מחוז או תפקיד. גם בארגון עם מאות מצלמות בעשרות מתקנים, מגיעים לכל נקודה בשלוש לחיצות:</p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">3 CLICKS</span><span class="copy mono" dir="ltr">navigation</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t">מחוז דן</span><span class="n-s">לחיצה ראשונה</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">מרפאת רמת-גן</span><span class="n-s">לחיצה שנייה</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">מצלמת אזור הקבלה</span><span class="n-s">לחיצה שלישית</span></div>
          </div>
        </div>
      </div>
      <p>שלוש לחיצות — כדי לראות, לשאול ולהגדיר משימות לכל מצלמה או אזור בארגון. הממשק שכולם כבר מכירים מהטלפון, מוחל על עולם שתקוע בממשקי שנות התשעים.</p>`,
    speaker: {
      say: "תחשבו על המצלמות שלכם כמו על אנשי קשר. לכל מצלמה יש שיחה. לכל אזור יש קבוצה.",
      points: [
        "הדגש: זה קודם כל שינוי ממשק — עוד לפני שדיברנו על בינה מלאכותית.",
        "עבור על שלוש הלחיצות שעל המסך אחת-אחת, באצבע.",
        "שאלה רטורית לקהל: כמה לחיצות נדרשות היום אצלכם כדי להגיע למצלמה ספציפית במרפאה ספציפית?",
      ],
    },
  },

  /* ------------------------------------------------ 06 — talk to cameras */
  {
    nav: "שיחה עם המצלמות",
    title: "שיחה עם המצלמות",
    minutes: 4,
    bubble: "מה בכלל שואלים מצלמה?",
    body: `
      <p class="lead">שואלים בעברית. <span class="dim">ומקבלים תשובה של מי שבאמת מסתכל.</span></p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">live-session</span><span class="copy mono" dir="ltr">08:42</span></div>
        <div class="cb-body qa">
          <div class="qa-q">מה קורה עכשיו באזור ההמתנה של מרפאת הילדים?</div>
          <div class="qa-a">באזור ההמתנה כתשעה ממתינים. מול דלפק הקבלה עומדים שלושה אנשים צמודים לאשנב, אחד מהם רוכן מעל הדלפק ומסמכים פזורים עליו. עגלת תינוק חוסמת חלקית את המעבר לחדר האחיות. שאר הממתינים יושבים במקומם.</div>
          <div class="qa-q">האם יציאת החירום במסדרון הדרומי פנויה?</div>
          <div class="qa-a">לא. עגלת ציוד ועליה ארגזי קרטון חוסמת כשני שלישים מרוחב הדלת. שלט היציאה מואר ותקין.</div>
        </div>
      </div>
      <p>שימו לב לתשובות: לא "זוהה אירוע" ולא קוד שגיאה — תיאור של סצנה והקשר, ברמת פירוט של אדם שעומד מול המסך ומסתכל בעצמו.</p>`,
    speaker: {
      say: "התשובה הזו לא נכתבה מראש. אף אחד לא הגדיר 'עגלת תינוק' או 'ארגזי קרטון'. המערכת פשוט הסתכלה ותיארה.",
      points: [
        "הקרא את השאלה והתשובה הראשונה בקול, מילה במילה — זה הרגע שממחיש הכי הרבה.",
        "הדגש את רמת הפירוט: מיקום, חפצים, יחסים בין דברים — לא תיוג יבש.",
        "הדוגמה השנייה מראה שזה לא רק ביטחון — גם בטיחות ותפעול באותו כלי.",
      ],
    },
  },

  /* ------------------------------------------------ 07 — tasks & alerts */
  {
    nav: "משימות והתראות",
    title: "משימות, בדיקות והתראות",
    minutes: 5,
    bubble: "ואם אף אחד לא שואל באותו רגע — מי שם לב?",
    body: `
      <p class="lead">מגדירים פעם אחת מה חשוב — <span class="dim">והמערכת בודקת בשבילכם, כל הזמן.</span></p>
      <p>השאלות החד-פעמיות הן רק ההתחלה. הכוח האמיתי הוא במשימות עומדות — הוראות בשפה חופשית שהמערכת מבצעת באופן קבוע:</p>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">בדיקה מתוזמנת</div><div class="ft-desc">"כל בוקר ב-06:30 — ודא שמסדרון המלר"ד פנוי ושאף יציאת חירום אינה חסומה בציוד או באלונקות."</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">ניטור רציף</div><div class="ft-desc">"התרע כשמצטברת מול דלפק הקבלה התקהלות צפופה של יותר מחמישה ממתינים הנדחקים אל האשנב."</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">בדיקה מותנית</div><div class="ft-desc">"אחרי שעות הקבלה — בדוק שדלת חדר התרופות סגורה ושלא נשאר ציוד על עמדת האחיות."</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">תיעוד מסודר</div><div class="ft-desc">כל בדיקה וכל התראה נרשמות: מה נבדק, מה נמצא, מתי, ומי טיפל. זיכרון ארגוני שנבנה מעצמו.</div></div></li>
      </ul>`,
    speaker: {
      say: "ההבדל בין שאלה להתראה עומדת הוא ההבדל בין לבדוק לפעמים — לבין לדעת תמיד.",
      points: [
        "הסבר את ההבדל בין שאילתה חד-פעמית (השקף הקודם) למשימה עומדת (השקף הזה).",
        "הקרא את דוגמת הניטור הרציף — היא לב יישום מניעת האלימות, נחזור אליה בעוד שני שקפים.",
        "הדגש: ההגדרה נכתבת במשפט אחד בעברית. מי שיודע לכתוב הודעת וואטסאפ — יודע להגדיר משימה.",
      ],
    },
  },

  /* ------------------------------------------------ 08 — no limits */
  {
    nav: "הבנה ללא גבולות",
    title: "הבנה ללא גבולות",
    minutes: 3,
    bubble: "איפה אפשר לראות את רשימת הדברים שהמערכת יודעת לבדוק?",
    body: `
      <p class="lead">אין רשימה. <span class="dim">כל מה שאפשר לתאר במילים — אפשר לבדוק.</span></p>
      <p>וזה היתרון המהותי על כל הדור הקודם: אין קטלוג יכולות, אין "אירועים נתמכים", ואין צורך לבקש פיתוח חדש לכל תרחיש. כמה דוגמאות מהשטח הרפואי — שאף אחת מהן לא הוגדרה מראש:</p>
      <div class="chips">
        <div class="chip"><div class="c-t">"ודא שדלת חדר התרופות נסגרה אחרי כל פתיחה"</div></div>
        <div class="chip"><div class="c-t">"בדוק אם נשארה אלונקה עם ציוד רפואי במסדרון בסוף המשמרת"</div></div>
        <div class="chip"><div class="c-t">"התרע אם מטף הכיבוי הוסר מעמדת הקיר ליד הכניסה"</div></div>
        <div class="chip"><div class="c-t">"בדוק אם רצפת הכניסה רטובה ואין לידה שלט אזהרה"</div></div>
      </div>
      <div class="closer">
        <div class="big">גם אנחנו לא יודעים מראש מה תרצו לבדוק — ולא צריכים לדעת.</div>
        <div class="small">ברגע שהמערכת צופה במצלמות שלכם, אפשר להגדיר כל דבר שחשוב לכם. הגבול היחיד הוא הדמיון.</div>
      </div>`,
    speaker: {
      say: "גם אנחנו לא יודעים מראש מה תרצו לבדוק — ולא צריכים לדעת. הגבול היחיד הוא הדמיון של מי שמגדיר.",
      points: [
        "שקף קצר ונושם — תן לקהל רגע לעכל לפני המעבר ליישום המרכזי.",
        "אמור את משפט המפתח שבמסגרת, מילה במילה.",
        "אפשר לשאול את הקהל: מה הייתם רוצים שמישהו יבדוק עבורכם כל בוקר במרפאה?",
      ],
    },
  },

  /* ------------------------------------------------ 09 — the timeline */
  {
    nav: "ציר הזמן של אירוע",
    title: "ציר הזמן של אירוע אלים",
    minutes: 6,
    bubble: "איפה בדיוק נמצא חלון המניעה?",
    body: `
      <p class="lead">אלימות כמעט אף פעם לא מתחילה במכה. <span class="dim">היא מתחילה בסימנים.</span></p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">escalation-timeline</span><span class="copy mono" dir="ltr">prevention window</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t">המתנה מתארכת</span><span class="n-s">תור עומד, תסכול נבנה</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">צפיפות בדלפק</span><span class="n-s">ממתינים נדחקים אל האשנב</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">הסלמה ניכרת</span><span class="n-s">עמידה צמודה, תנועות חדות</span></div>
            <div class="arrow">&larr;</div>
            <div class="node hot"><span class="n-t">אירוע פיזי</span><span class="n-s">חפץ מונף, מגע אלים</span></div>
          </div>
          <div class="window mono" dir="rtl">→ חלון המניעה: שלושת השלבים הראשונים ←</div>
        </div>
      </div>
      <p>כל השלבים המוקדמים גלויים למצלמה — אבל בלתי נראים למערכת שרק מקליטה. כשמשימה עומדת מזהה צפיפות חריגה מול הדלפק או הסלמה ניכרת באזור ההמתנה, אדם מקבל התראה <b>לפני</b> השלב האחרון — וצוות יכול להגיע, להרגיע, לתגבר או להפריד. זו כל התורה: להזיז את נקודת הידיעה אחורה בזמן.</p>`,
    speaker: {
      say: "כל מה שקורה משמאל לשלב האחרון — המצלמה רואה. השאלה היא רק אם מישהו יודע על זה בזמן.",
      points: [
        "זהו לב ההרצאה — קח את הזמן. עבור על הציר שלב-שלב, באצבע, מימין לשמאל.",
        "חבר כל שלב לחוויה מוכרת: כולם ראו תור תקוע, כולם ראו את הרגע שבו מישהו מתחיל להרים קול.",
        "הדגש: ההתראה מגיעה לאדם — מאבטח, אח אחראי — וההתערבות היא אנושית: נוכחות, הרגעה, תגבור.",
        "קשר לפרוטוקולי ההסלמה וההדרכות שכבר קיימים בכללית — הטכנולוגיה מזינה אותם, לא מחליפה אותם.",
      ],
    },
  },

  /* ------------------------------------------------ 10 — scenarios */
  {
    nav: "תרחישים במרחב הרפואי",
    title: "תרחישים במרחב הרפואי",
    minutes: 5,
    bubble: "איך זה נראה בפועל — במרפאה, בבית מרקחת, במלר\"ד?",
    body: `
      <p class="lead">משימות אמיתיות, בשפה שבה הן נכתבות. <span class="dim">ביטחון, בטיחות, תפעול וחירום — באותו כלי.</span></p>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">התראה: כיסא מתכת מונף באוויר מעל דלפק הקבלה</div><div class="ft-desc">כשניירות ומסמכים מפוזרים על הרצפה לידו — הסלמה בעיצומה, כל שנייה קובעת.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">התראה: התקהלות צפופה מול אשנב האחות התורנית</div><div class="ft-desc">יותר מחמישה ממתינים נדחקים אל האשנב כשדלת הזכוכית מוחזקת פתוחה — השלב שלפני ההסלמה.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">בדיקה: עגלת החייאה חוסמת את יציאת החירום במסדרון המלר"ד</div><div class="ft-desc">מפגע בטיחות שגם מקשה על צוות להגיע במהירות לאירוע אלים.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">בדיקה: דלת המחלקה נותרה פתוחה לרווחה אחרי שעות הביקור</div><div class="ft-desc">נקודת כניסה לא מבוקרת למחלקה רגישה — יולדות, ילדים, גריאטריה.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">חירום: אדם שרוע על רצפת חדר ההמתנה ליד עמדת המים</div><div class="ft-desc">כוס פלסטיק הפוכה לידו — אירוע רפואי באזור שאף איש צוות לא רואה כרגע.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">בטיחות: מטף כיבוי שהוסר מהקיר מוטל על הרצפה ליד עמדת השמירה</div><div class="ft-desc">גם חפץ שעלול לשמש לתקיפה, וגם ציוד חירום שאינו במקומו.</div></div></li>
      </ul>`,
    speaker: {
      say: "שימו לב שאף תרחיש כאן הוא לא 'יש מישהו באזור'. כל תרחיש הוא סצנה — עם הקשר, חפצים ומשמעות מבצעית.",
      points: [
        "בחר שניים-שלושה תרחישים והרחב עליהם בסיפור קצר — אל תקריא את כל הרשימה.",
        "הדגש את הרוחב: אלימות, בטיחות, תפעול וחירום — מערכת אחת, שפה אחת.",
        "תרגיל קצר עם הקהל: בקש מהם להציע תרחיש משלהם, ונסח אותו יחד כמשפט משימה.",
      ],
    },
  },

  /* ------------------------------------------------ 11 — privacy */
  {
    nav: "פרטיות ואתיקה",
    title: "פרטיות, אתיקה ורגולציה",
    minutes: 5,
    bubble: "ומה עם הפרטיות של המטופלים ושל העובדים?",
    body: `
      <p class="lead">מרחב רפואי מחייב רף אחר. <span class="dim">הפרטיות חייבת להיות חלק מהארכיטקטורה — לא תוספת.</span></p>
      <p>זו השאלה הראשונה שכל ארגון בריאות צריך לשאול, ובצדק. העקרונות שצריך לדרוש מכל מערכת הבנת וידאו במרחב רפואי:</p>
      <div class="chips">
        <div class="chip"><div class="c-t">תיאור סצנות — לא זיהוי זהויות</div><div class="c-d">המערכת מתארת מצבים ("התקהלות מול הדלפק"), לא קובעת מי האנשים. ללא זיהוי פנים וללא מעקב אחר אדם ספציפי.</div></div>
        <div class="chip"><div class="c-t">עיבוד בסביבה מבודדת</div><div class="c-d">תמיכה בפריסה מקומית ובסביבות מנותקות — הווידאו לא חייב לעזוב את הארגון.</div></div>
        <div class="chip"><div class="c-t">שמירת מינימום</div><div class="c-d">תובנות מובנות במקום אגירת וידאו גולמי; מדיניות מחיקה מוגדרת מראש.</div></div>
        <div class="chip"><div class="c-t">בקרת גישה ותיעוד מלא</div><div class="c-d">הרשאות לפי תפקיד, ותיעוד של כל שאלה וכל צפייה — מי, מה ומתי.</div></div>
      </div>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">שקיפות מול העובדים והמטופלים</div><div class="ft-desc">שילוט ברור, שיתוף נציגות העובדים, ומדיניות כתובה — תנאי הכרחי לאמון, לא המלצה.</div></div></li>
      </ul>`,
    speaker: {
      say: "ההבדל המהותי הוא בין 'לדעת מי' לבין 'להבין מה'. מניעת אלימות דורשת להבין מה — לא לדעת מי.",
      points: [
        "אל תחכה שישאלו — פתח את נושא הפרטיות יזום. זה בונה אמינות מיידית.",
        "הסבר את ההבחנה: תיאור מצב ('התקהלות') לעומת זיהוי אדם ('פלוני נמצא כאן').",
        "הדגש את חובת השקיפות מול ועדי עובדים ומטופלים — מנקודת מבט אתית, לא רק משפטית.",
        "אם יש בקהל יועצים משפטיים או ממוני פרטיות — הזמן אותם לשיחה בסוף.",
      ],
    },
  },

  /* ------------------------------------------------ 12 — human in the loop */
  {
    nav: "האדם במרכז",
    title: "האדם במרכז",
    minutes: 3,
    bubble: "אז המערכת מחליפה את המאבטח?",
    body: `
      <p class="lead">לא. היא נותנת לו עיניים. <span class="dim">ההחלטה נשארת אנושית — תמיד.</span></p>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">ההתראה מגיעה לאדם</div><div class="ft-desc">מאבטח, אח אחראי, מנהל משמרת — אדם מקבל את ההתראה, רואה את התמונה, ומחליט.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">שיקול הדעת נשאר בידי הצוות</div><div class="ft-desc">להתקרב, להרגיע, לתגבר, להזעיק — ההתערבות היא אנושית ומקצועית. הטכנולוגיה רק מקצרת את הדרך אליה.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">כלי לצוות — לא מעליו</div><div class="ft-desc">המטרה היא שאחות בעמדת קבלה תרגיש פחות לבד מול תור עוין. לא עוד מערכת שמפקחת עליה.</div></div></li>
      </ul>
      <div class="closer">
        <div class="big">הטכנולוגיה מקצרת את הזמן שבין "משהו קורה" ל"מישהו יודע".</div>
        <div class="small">כל מה שקורה אחרי — נשאר בדיוק כמו שצריך: בידיים של אנשי המקצוע.</div>
      </div>`,
    speaker: {
      say: "המטרה היא לא להחליף אף אחד. המטרה היא שאף אחות לא תהיה לבד מול הסלמה — בלי שמישהו יודע.",
      points: [
        "שקף קצר שעונה על החשש הכי נפוץ בקהל — גם אם לא נשאל בקול.",
        "פנה ישירות לאנשי הצוות באולם: זה כלי בשבילכם, לא מערכת פיקוח עליכם.",
        "אפשר לשלב סיפור על אירוע שבו דקה אחת של התרעה מוקדמת הייתה משנה הכול.",
      ],
    },
  },

  /* ------------------------------------------------ 13 — implementation */
  {
    nav: "הטמעה בפועל",
    title: "הטמעה בארגון בריאות",
    minutes: 4,
    bubble: "מה נדרש כדי שזה יעבוד אצלנו בפועל?",
    body: `
      <p class="lead">לא פרויקט תשתית. <span class="dim">שכבת הבנה מעל מה שכבר קיים.</span></p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">rollout-path</span><span class="copy mono" dir="ltr">phased</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t">המצלמות הקיימות</span><span class="n-s">ללא החלפת ציוד</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">חיבור השכבה</span><span class="n-s">בלי התקנות על המצלמות</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">הגדרת משימות עם הצוות</span><span class="n-s">בשפה טבעית, יחד עם השטח</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">פיילוט מדיד</span><span class="n-s">מרפאה אחת, יעדים ברורים</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">הרחבה הדרגתית</span><span class="n-s">לפי תוצאות</span></div>
          </div>
        </div>
      </div>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">מה מודדים בפיילוט</div><div class="ft-desc">זמן מהתחלת הסלמה ועד הגעת צוות, מספר התערבויות מוקדמות, אירועים שנמנעו, ותחושת הביטחון של הצוות.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">את מי מערבים מהיום הראשון</div><div class="ft-desc">ביטחון, סיעוד, ועד העובדים, ממונה פרטיות, ומנהל המרפאה — הצלחת הטמעה היא ארגונית לפני שהיא טכנולוגית.</div></div></li>
      </ul>`,
    speaker: {
      say: "השאלה הנכונה היא לא 'כמה מצלמות צריך לקנות' — אלא 'מה אנחנו רוצים לדעת, ומי צריך לדעת את זה'.",
      points: [
        "הדגש: אין החלפת תשתית ואין התקנות על המצלמות — זו הסרת החסם הגדול ביותר.",
        "המלץ על פיילוט קטן ומדיד במרפאה אחת עם מדדים מוגדרים מראש.",
        "חזור על עקרון השקיפות: שיתוף ועד העובדים וממונה הפרטיות מהיום הראשון.",
      ],
    },
  },

  /* ------------------------------------------------ 14 — summary */
  {
    nav: "סיכום ושאלות",
    title: "סיכום ושאלות",
    minutes: 4,
    bubble: "אז מה לוקחים הביתה מהשעה הזו?",
    body: `
      <p class="lead">המצלמות כבר שם. <span class="dim">ההבדל הוא היכולת להבין אותן — בזמן.</span></p>
      <ul class="feat">
        <li><span class="dot"></span><div><div class="ft-title">1 · הבעיה היא קשב, לא כיסוי</div><div class="ft-desc">האירועים קורים מול עדשות שאף אחד לא מסוגל לצפות בהן ברציפות. ההקלטה מתעדת — היא לא מונעת.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">2 · הטכנולוגיה השתנתה מהיסוד</div><div class="ft-desc">הבנת סצנות בשפה טבעית, בלי רשימות סגורות ובלי אימון — מעל המצלמות הקיימות.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">3 · חלון המניעה אמיתי</div><div class="ft-desc">הסימנים המוקדמים גלויים למצלמה. כשאדם מקבל התראה בזמן — יש לו דקות, לא שניות.</div></div></li>
        <li><span class="dot"></span><div><div class="ft-title">4 · האדם נשאר במרכז</div><div class="ft-desc">פרטיות בארכיטקטורה, שקיפות מול הצוות, והחלטה אנושית — תמיד.</div></div></li>
      </ul>
      <div class="closer">
        <div class="big">שאלות?</div>
        <div class="small">אפשר גם אחרי ההרצאה — אשמח להמשיך את השיחה.</div>
      </div>`,
    speaker: {
      say: "אם תצאו מכאן עם משפט אחד — שיהיה זה: מניעה מתחילה ברגע שבו מישהו יודע בזמן.",
      points: [
        "סכם את ארבע הנקודות בקצב — משפט לכל אחת, בלי לפתוח מחדש.",
        "פתח לשאלות. אם הקהל שקט, שאל בעצמך: \"מה הייתם רוצים לדעת כל בוקר על המרפאה שלכם?\"",
        "שאלות דיון רזרביות: איפה אצלכם נקודת החיכוך הכי קשה? מי אצלכם צריך לקבל את ההתראה הראשונה?",
        "סיים בתודה לצוותים שבחזית — הם הסיבה שההרצאה הזו קיימת.",
      ],
    },
  },
];

/* ----------------------------------------------------------------- html */

const pad = (n) => String(n).padStart(2, "0");
const TOTAL = slides.length;
const totalMin = slides.reduce((s, x) => s + x.minutes, 0);

const css = `
  :root {
    --bg-primary: #212121;
    --bg-sidebar: #171717;
    --bg-surface: #2f2f2f;
    --bg-surface-hover: #3a3a3a;
    --bg-code: #1e1e1e;
    --text-primary: #ececec;
    --text-secondary: #b4b4b4;
    --text-muted: #767676;
    --border-subtle: #3a3a3a;
    --accent: #ececec;
    --accent-ink: #171717;
    --sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    --mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 338.667mm 190.5mm; margin: 0; }
  html, body {
    background: #0d0d0d;
    color: var(--text-primary);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .mono { font-family: var(--mono); letter-spacing: 0.04em; direction: ltr; unicode-bidi: embed; }

  /* ---------- 16:9 landscape page = one ChatGPT screen ---------- */
  .page {
    width: 338.667mm;
    height: 190.5mm;
    margin: 0 auto;
    background: var(--bg-primary);
    display: flex;
    overflow: hidden;
    position: relative;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* ---------- Sidebar (right in RTL) ---------- */
  .sidebar {
    width: 52mm;
    flex-shrink: 0;
    background: var(--bg-sidebar);
    border-inline-end: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    padding: 13px 10px;
    gap: 5px;
  }
  .brand { display: flex; align-items: center; gap: 9px; padding: 4px 5px 10px; }
  .brand img { width: 27px; height: 27px; border-radius: 8px; display: block; }
  .brand .name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .brand .name .sub { display: block; font-size: 9px; font-weight: 400; color: var(--text-muted); margin-top: 1px; }
  .newchat {
    display: flex; align-items: center; gap: 9px;
    height: 32px; padding: 0 11px;
    border: 1px solid var(--border-subtle); border-radius: 10px;
    color: var(--text-secondary); font-size: 11.5px;
  }
  .newchat .plus { width: 13px; height: 13px; position: relative; opacity: 0.85; }
  .newchat .plus::before, .newchat .plus::after { content: ""; position: absolute; background: var(--text-secondary); }
  .newchat .plus::before { right: 5.5px; top: 1px; width: 2px; height: 11px; border-radius: 2px; }
  .newchat .plus::after { top: 5.5px; right: 1px; height: 2px; width: 11px; border-radius: 2px; }
  .nav-label { font-size: 9.5px; font-weight: 600; color: var(--text-muted); padding: 9px 8px 3px; }
  .nav-item {
    display: flex; align-items: center; gap: 7px;
    height: 23.5px; padding: 0 9px; border-radius: 8px;
    font-size: 10.5px; color: var(--text-secondary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .nav-item .ix { font-size: 8.5px; color: var(--text-muted); width: 14px; font-family: var(--mono); direction: ltr; }
  .nav-item.active { background: var(--bg-surface); color: var(--text-primary); }
  .nav-item.active .ix { color: var(--text-primary); }
  .sidebar .spacer { flex: 1; }
  .sidebar .foot {
    border-top: 1px solid var(--border-subtle);
    padding: 9px 8px 1px; font-size: 9px; color: var(--text-muted); line-height: 1.5;
  }
  .sidebar .foot b { color: var(--text-secondary); font-weight: 600; }

  /* ---------- Main ---------- */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .topbar {
    height: 42px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 22px; border-bottom: 1px solid var(--border-subtle);
  }
  .topbar .title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
  .topbar .meta { font-size: 10.5px; color: var(--text-muted); }

  .bodyrow { flex: 1; display: flex; min-height: 0; }

  .thread { flex: 1; min-width: 0; overflow: hidden; padding: 16px 26px 6px; display: flex; flex-direction: column; justify-content: center; gap: 16px; }

  .msg-user { display: flex; justify-content: flex-end; }
  .msg-user .bubble {
    max-width: 72%; background: var(--bg-surface); color: var(--text-primary);
    border-radius: 18px; padding: 10px 16px; font-size: 14px; line-height: 1.5;
  }
  .msg-ai { display: flex; gap: 14px; }
  .msg-ai .av { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; overflow: hidden; margin-top: 2px; }
  .msg-ai .av img { width: 100%; height: 100%; display: block; }
  .msg-ai .body { flex: 1; min-width: 0; }
  .msg-ai .body p { font-size: 13.5px; line-height: 1.62; color: var(--text-primary); }
  .msg-ai .body p + p { margin-top: 9px; }
  .msg-ai .body .lead { font-size: 24px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.28; margin-bottom: 9px; }
  .msg-ai .body .lead .dim { color: var(--text-secondary); font-weight: 500; }
  .msg-ai .body .kicker { font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 9px; }

  .feat { list-style: none; margin-top: 11px; display: flex; flex-direction: column; }
  .feat li { padding: 9px 0; border-bottom: 1px solid var(--border-subtle); display: flex; gap: 12px; align-items: flex-start; }
  .feat li:last-child { border-bottom: none; }
  .feat .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-primary); margin-top: 7px; flex-shrink: 0; }
  .feat .ft-title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
  .feat .ft-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.45; margin-top: 2px; }

  .codeblock { margin-top: 11px; background: var(--bg-code); border: 1px solid var(--border-subtle); border-radius: 10px; overflow: hidden; }
  .codeblock + p { margin-top: 11px; }
  .cb-head { display: flex; align-items: center; justify-content: space-between; background: #2a2a2a; padding: 7px 14px; font-size: 10.5px; color: var(--text-secondary); }
  .cb-head .copy { color: var(--text-muted); }
  .cb-body { padding: 15px 15px; }

  .pipe { display: flex; align-items: stretch; }
  .node {
    flex: 1; background: var(--bg-surface); border: 1px solid var(--border-subtle);
    border-radius: 10px; padding: 12px 9px; text-align: center;
    display: flex; flex-direction: column; gap: 4px; justify-content: center;
  }
  .node.hot { border-color: #6a6a6a; background: #383838; }
  .node .n-t { font-size: 12.5px; font-weight: 600; color: var(--text-primary); line-height: 1.25; }
  .node .n-s { font-size: 10px; color: var(--text-muted); }
  .arrow { align-self: center; width: 24px; text-align: center; color: var(--text-muted); font-size: 15px; flex-shrink: 0; }
  .window { margin-top: 10px; text-align: center; font-size: 10px; color: var(--text-muted); letter-spacing: 0.1em; }

  .chips { margin-top: 11px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
  .chip { border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 14px; background: rgba(255,255,255,0.02); }
  .chip .c-t { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.4; }
  .chip .c-d { font-size: 11.5px; color: var(--text-secondary); margin-top: 3px; line-height: 1.45; }

  .stats { margin-top: 11px; display: grid; grid-template-columns: repeat(4,1fr); gap: 9px; }
  .stat { border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 9px; text-align: center; }
  .stat .s-b { font-size: 16px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }
  .stat .s-l { font-size: 10.5px; color: var(--text-muted); margin-top: 5px; line-height: 1.4; }

  .closer { margin-top: 13px; padding: 16px 20px; border: 1px solid var(--border-subtle); border-radius: 14px; background: rgba(255,255,255,0.02); text-align: center; }
  .closer .big { font-size: 17px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; line-height: 1.35; }
  .closer .small { font-size: 12px; color: var(--text-secondary); margin-top: 5px; }

  /* Q&A inside codeblock */
  .qa { display: flex; flex-direction: column; gap: 10px; }
  .qa-q {
    align-self: flex-end; max-width: 68%;
    background: var(--bg-surface); border-radius: 14px;
    padding: 8px 14px; font-size: 12.5px; color: var(--text-primary); line-height: 1.5;
  }
  .qa-a { font-size: 12.5px; color: var(--text-secondary); line-height: 1.62; padding-inline-start: 4px; }

  /* ---------- Speaker rail ---------- */
  .speaker {
    width: 66mm; flex-shrink: 0;
    border-inline-start: 1px solid var(--border-subtle);
    background: rgba(255,255,255,0.015);
    padding: 16px 16px 12px;
    display: flex; flex-direction: column; gap: 9px;
  }
  .sp-head { display: flex; align-items: center; justify-content: space-between; }
  .sp-head .lbl { font-size: 8.5px; color: var(--text-muted); letter-spacing: 0.22em; text-transform: uppercase; font-family: var(--mono); direction: ltr; }
  .sp-head .time { font-size: 8.5px; color: var(--text-secondary); font-family: var(--mono); direction: ltr; letter-spacing: 0.12em; border: 1px solid var(--border-subtle); border-radius: 999px; padding: 2px 8px; }
  .sp-say {
    border-inline-start: 2px solid var(--text-muted);
    padding: 6px 10px 6px 2px; margin: 2px 0;
    font-size: 11.5px; color: var(--text-primary); line-height: 1.5; font-weight: 500;
  }
  .sp-say .tag { display: block; font-size: 8.5px; color: var(--text-muted); letter-spacing: 0.18em; font-family: var(--mono); direction: ltr; margin-bottom: 3px; }
  .sp-list { list-style: none; display: flex; flex-direction: column; gap: 7px; }
  .sp-list li { display: flex; gap: 8px; font-size: 11px; color: var(--text-secondary); line-height: 1.5; }
  .sp-list .d { width: 4px; height: 4px; border-radius: 50%; background: var(--text-muted); margin-top: 6px; flex-shrink: 0; }

  /* presentation variant — no speaker rail, wider breathing room */
  .page.noguide .thread { padding: 16px 72px 6px; }

  /* ---------- Composer ---------- */
  .composer-wrap { padding: 6px 26px 12px; flex-shrink: 0; }
  .composer {
    max-width: 200mm; margin: 0 auto;
    background: var(--bg-surface); border: 1px solid var(--border-subtle);
    border-radius: 22px; padding: 8px 10px 8px 15px;
    display: flex; align-items: center; gap: 11px;
  }
  .composer .ph { flex: 1; font-size: 12px; color: var(--text-muted); }
  .composer .send { width: 26px; height: 26px; border-radius: 50%; background: var(--accent); flex-shrink: 0; position: relative; }
  .composer .send::after {
    content: ""; position: absolute; left: 50%; top: 52%;
    width: 7px; height: 7px; border-top: 2px solid var(--accent-ink); border-left: 2px solid var(--accent-ink);
    transform: translate(-50%,-50%) rotate(45deg);
  }
  .disclaimer { max-width: 200mm; margin: 6px auto 0; text-align: center; font-size: 9.5px; color: var(--text-muted); }
`;

function sidebar(activeIdx) {
  const items = slides
    .map(
      (s, i) =>
        `<div class="nav-item${i === activeIdx ? " active" : ""}"><span class="ix">${pad(i + 1)}</span><span>${s.nav}</span></div>`
    )
    .join("\n      ");
  return `<aside class="sidebar">
    <div class="brand">
      <img src="${ICON}" alt="Ghost" />
      <div class="name">Ghost<span class="sub">מניעת אלימות · הרצאה</span></div>
    </div>
    <div class="newchat"><span class="plus"></span><span>שיחה חדשה</span></div>
    <div class="nav-label">פרקי ההרצאה</div>
      ${items}
    <div class="spacer"></div>
    <div class="foot"><b>שירותי בריאות כללית</b><br/>כנס מניעת אלימות · ${totalMin} דקות · 2026</div>
  </aside>`;
}

function speakerRail(s) {
  const points = s.speaker.points
    .map((p) => `<li><span class="d"></span><span>${p}</span></li>`)
    .join("\n        ");
  return `<div class="speaker">
      <div class="sp-head"><span class="lbl">SPEAKER // GUIDE</span><span class="time">&asymp; ${pad(s.minutes)} MIN</span></div>
      <div class="sp-say"><span class="tag">SAY THIS</span>"${s.speaker.say}"</div>
      <ul class="sp-list">
        ${points}
      </ul>
    </div>`;
}

function page(s, i, withGuide) {
  return `<!-- ============ PAGE ${pad(i + 1)} — ${s.title} ============ -->
<div class="page${withGuide ? "" : " noguide"}">
  ${sidebar(i)}
  <div class="main">
    <div class="topbar">
      <div class="title">${s.title}</div>
      <div class="meta mono">${pad(i + 1)} / ${pad(TOTAL)}</div>
    </div>
    <div class="bodyrow">
      <div class="thread">
        <div class="msg-user"><div class="bubble">${s.bubble}</div></div>
        <div class="msg-ai">
          <div class="av"><img src="${ICON}" alt="Ghost" /></div>
          <div class="body">${s.body}
          </div>
        </div>
      </div>
      ${withGuide ? speakerRail(s) : ""}
    </div>
    <div class="composer-wrap">
      <div class="composer"><span class="ph">שאל את Ghost על מה שקורה עכשיו במרפאה…</span><span class="send"></span></div>
      <div class="disclaimer">Ghost — הרצאת תוכן · מניעת אלימות במוסדות רפואיים · שירותי בריאות כללית</div>
    </div>
  </div>
</div>`;
}

function doc(withGuide) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ghost — מניעת אלימות במוסדות רפואיים · הרצאה</title>
<style>${css}</style>
</head>
<body>

${slides.map((s, i) => page(s, i, withGuide)).join("\n\n")}

</body>
</html>
`;
}

writeFileSync(OUT, doc(true));
writeFileSync(OUT_CLEAN, doc(false));
console.log(`Wrote ${OUT} (${TOTAL} slides, ${totalMin} min, with speaker guide)`);
console.log(`Wrote ${OUT_CLEAN} (${TOTAL} slides, presentation only)`);
