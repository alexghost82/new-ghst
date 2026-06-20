#!/usr/bin/env node
// Builds the Ghost TED-style light deck (violence early-signs detection,
// Clalit) as a 16:9 landscape gopdf HTML at the repo root.
// Run: node tools/clalit-ted/build.mjs
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "clalit-ted-violence.html");
const ICON = "frontend/public/ghost-icon.png";
const IMG = "tools/clalit-ted/assets";
const SHOT = "tools/operator-training/shots";

/* ---------------------------------------------------------------- slides */

/* Renders the in-app alert-setup panel exactly as it looks in Ghost (light mode). */
function alertMock(sentence) {
  return `<div class="mock">
        <div class="mock-bar"><span class="mono" dir="ltr">GHOST // ALERT SETUP</span><span class="mono mock-bar-cap" dir="ltr">live system ui</span></div>
        <div class="mock-body">
          <div class="mock-head"><span>מצב התראה פעיל</span><span class="toggle on"></span></div>
          <div class="mock-sub">הוסף שורות חופשיות שמתארות מצבים שיש להתריע עליהם — אדם אוחז נשק, שריפה, אלימות וכדומה.</div>
          <div class="mock-label">שורות התראה · 1</div>
          <div class="mock-row"><span class="row-txt">${sentence}</span><span class="toggle on small"></span></div>
          <div class="mock-status"><span class="dot-live"></span>ערוץ התראות פעיל — כל פריים נבחן מול השורה</div>
        </div>
      </div>`;
}

const slides = [
  /* ---------------------------------------------- 00 — black cover */
  {
    cover: true,
    nav: "שער",
    title: "שער",
  },

  /* ---------------------------------------------- 01 — the idea */
  {
    nav: "הרעיון",
    title: "הרעיון",
    bubble: "מה הרעיון האחד של ההרצאה הזו?",
    body: `
      <div class="kicker mono">GHOST // TED BRIEF · HEALTHCARE SECURITY</div>
      <p class="hero">אלימות לא מתפרצת.<br/><span class="dim">היא מבשילה.</span></p>
      <p class="one">ומה שמבשיל — אפשר לראות. אם מסתכלים בזמן.</p>
      <div class="media">
        <span class="badge mono">FIELD // WAITING ROOM</span>
        <img src="${IMG}/clinic-waiting-room.png" alt="" />
      </div>`,
  },

  /* ---------------------------------------------- 02 — the problem */
  {
    nav: "הבעיה",
    title: "הבעיה",
    bubble: "אז למה זה ממשיך לקרות מול המצלמות?",
    body: `
      <p class="hero">כולם מצלמים.<br/><span class="dim">אף אחד לא רואה.</span></p>
      <div class="stats">
        <div class="stat"><div class="s-b">מאות</div><div class="s-l">מצלמות בכל מרחב רפואי</div></div>
        <div class="stat"><div class="s-b">זוג עיניים אחד</div><div class="s-l">מול קיר המסכים — אם בכלל</div></div>
        <div class="stat"><div class="s-b">בדיעבד</div><div class="s-l">ההקלטה נפתחת אחרי שהאירוע נגמר</div></div>
      </div>
      <p class="one">ההקלטה מספרת מה קרה. מניעה דורשת לדעת מה קורה — עכשיו.</p>`,
  },

  /* ---------------------------------------------- 03 — what Ghost changes */
  {
    nav: "מה Ghost משנה",
    title: "מה Ghost משנה",
    bubble: "ומה Ghost עושה אחרת?",
    body: `
      <p class="hero">במקום לצפות במצלמות —<br/><span class="dim">מדברים איתן.</span></p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">the-shift</span><span class="copy mono" dir="ltr">before &rarr; after</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t">קיר מסכים</span><span class="n-s">שאף אחד לא מסתכל בו</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">רשימת שיחות</span><span class="n-s">כל מצלמה היא צ'אט</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">שאלה בעברית</span><span class="n-s">"מה קורה עכשיו בקבלה?"</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">תשובה של מי שמסתכל</span><span class="n-s">סצנה, הקשר, פרטים</span></div>
          </div>
        </div>
      </div>
      <p class="one">שכבת הבנה מעל המצלמות הקיימות. בלי להחליף אף מצלמה. בלי לאמן אף מודל.</p>`,
  },

  /* ---------------------------------------------- 04 — early signs (security knowledge) */
  {
    nav: "הסימנים המוקדמים",
    title: "הסימנים המוקדמים",
    bubble: "מה רואים לפני שרואים אלימות?",
    body: `
      <p class="hero">ההסלמה מדברת<br/><span class="dim">לפני שהיא צועקת.</span></p>
      <div class="cols">
        <div class="col">
          <ul class="feat">
            <li><span class="num mono">01</span><div><div class="ft-title">עומס שקט</div><div class="ft-desc">תור עומד. ממתינים קמים מהכיסאות ונשארים לעמוד.</div></div></li>
            <li><span class="num mono">02</span><div><div class="ft-title">כיווץ מרחב</div><div class="ft-desc">היצמדות לאשנב, רכינה מעל הדלפק, חדירה למרחב האישי.</div></div></li>
            <li><span class="num mono">03</span><div><div class="ft-title">שפת גוף חדה</div><div class="ft-desc">הצבעה לעבר הצוות, הליכה הלוך-ושוב לאורך הדלפק.</div></div></li>
            <li><span class="num mono">04</span><div><div class="ft-title">חזרתיות</div><div class="ft-desc">חזרה לאשנב שוב ושוב בתוך דקות. מסמכים נטרקים על המשטח.</div></div></li>
            <li><span class="num mono">05</span><div><div class="ft-title">קהל נאסף</div><div class="ft-desc">ממתינים קמים, מצטופפים סביב, טלפונים נשלפים לצילום.</div></div></li>
            <li><span class="num mono">06</span><div><div class="ft-title">רגע החפץ</div><div class="ft-desc">כיסא מורם. דלת נבעטת. מחיצת אשנב נדחפת. כאן זה כבר אירוע.</div></div></li>
          </ul>
        </div>
        <div class="col media-col">
          <div class="media tall">
            <span class="badge mono">SIGN 02 // SPACE COLLAPSE</span>
            <img src="${IMG}/reception-crowding.png" alt="" />
          </div>
          <p class="cap">חמשת השלבים הראשונים גלויים למצלמה — דקות לפני השישי.</p>
        </div>
      </div>`,
  },

  /* ---------------------------------------------- 05 — defining for AI */
  {
    nav: "איך מגדירים את זה ל-AI",
    title: "איך מגדירים את זה ל-AI",
    bubble: "ואיך מלמדים מערכת לראות את הסימנים האלה?",
    body: `
      <p class="hero">לא מלמדים. <span class="dim">כותבים.</span></p>
      <p class="one">כל סימן מוקדם הופך למשפט אחד בעברית. בלי תכנות, בלי אימון, בלי רשימת "אירועים נתמכים".</p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">sign &rarr; sentence</span><span class="copy mono" dir="ltr">natural language</span></div>
        <div class="cb-body rules">
          <div class="rule"><span class="r-tag mono">02</span><span class="r-txt">"התרע כשיותר מחמישה ממתינים נדחקים אל אשנב הקבלה ומישהו רוכן מעבר לדלפק"</span></div>
          <div class="rule"><span class="r-tag mono">04</span><span class="r-txt">"התרע כשמסמכים מפוזרים על רצפת הקבלה ליד האשנב או נטרקים על משטח הדלפק"</span></div>
          <div class="rule"><span class="r-tag mono">06</span><span class="r-txt">"התרע כשכיסא המתנה מורם מעל גובה הכתפיים בכל מקום באזור ההמתנה"</span></div>
        </div>
      </div>
      <p class="one">מי שיודע לכתוב הודעת וואטסאפ — יודע להגדיר התראת ביטחון.</p>`,
  },

  /* ---------------------------------------------- sign vs reality A — leaning over counter */
  {
    nav: "הגדרה ↔ מציאות · רכינה",
    title: "הגדרה מול מציאות · כיווץ מרחב",
    bubble: "איך נראית ההתראה — ואיך נראה הרגע שהיא תופסת?",
    body: `
      <p class="hero-s">משפט אחד במערכת. <span class="dim">רגע אחד במציאות.</span></p>
      <div class="cols">
        <div class="col">
          ${alertMock("התרע כשמישהו רוכן מעבר לאשנב הקבלה לעבר עמדת המזכירה ומסמכים מתפזרים על הדלפק")}
        </div>
        <div class="col media-col">
          <div class="media tall">
            <span class="badge mono">FIELD // REALITY</span>
            <img src="${IMG}/leaning-over-counter.png" alt="" />
          </div>
          <p class="cap">כך זה נראה בפועל — שניות לפני שהמילים נגמרות. ההתראה כבר אצל מנהל הביטחון.</p>
        </div>
      </div>`,
  },

  /* ---------------------------------------------- sign vs reality B — pacing & pointing */
  {
    nav: "הגדרה ↔ מציאות · הצבעה",
    title: "הגדרה מול מציאות · שפת גוף חדה",
    bubble: "וסימן שכמעט אף עין לא תופסת בזמן?",
    body: `
      <p class="hero-s">ההסלמה עוד מילולית. <span class="dim">הגוף כבר צועק.</span></p>
      <div class="cols">
        <div class="col">
          ${alertMock("התרע כשאדם הולך הלוך ושוב לאורך הדלפק ומצביע בתנועות חדות לעבר עמדת הצוות")}
        </div>
        <div class="col media-col">
          <div class="media tall">
            <span class="badge mono">FIELD // REALITY</span>
            <img src="${IMG}/pacing-gesturing.png" alt="" />
          </div>
          <p class="cap">הליכה הלוך ושוב, הצבעה לעבר האשנב — השלב שבו נוכחות אחת מרגיעה הכול.</p>
        </div>
      </div>`,
  },

  /* ---------------------------------------------- sign vs reality C — chair raised */
  {
    nav: "הגדרה ↔ מציאות · כיסא",
    title: "הגדרה מול מציאות · רגע החפץ",
    bubble: "ומה קורה כשמגיעים לשלב האחרון?",
    body: `
      <p class="hero-s">כאן כל שנייה קובעת. <span class="dim">וההתראה כבר בדרך.</span></p>
      <div class="cols">
        <div class="col">
          ${alertMock("התרע כשכיסא המתנה מורם מעל גובה הכתפיים בכל מקום באזור ההמתנה")}
        </div>
        <div class="col media-col">
          <div class="media tall">
            <span class="badge mono">FIELD // REALITY</span>
            <img src="${IMG}/chair-raised.png" alt="" />
          </div>
          <p class="cap">רגע החפץ — השלב השישי. מי שקיבל את ההתראות בשלבים 2 ו-3, כמעט אף פעם לא פוגש אותו.</p>
        </div>
      </div>`,
  },

  /* ---------------------------------------------- 06 — real screen: define alert */
  {
    nav: "מסך אמיתי · הגדרה",
    title: "מסך אמיתי · הגדרת התראה",
    bubble: "איך זה נראה במערכת עצמה?",
    body: `
      <p class="hero-s">ככה מגדירים התראה. <span class="dim">משפט אחד.</span></p>
      <div class="shot">
        <div class="shot-head"><span class="mono" dir="ltr">GHOST // LIVE SYSTEM</span><span class="mono shot-cap" dir="ltr">alert setup</span></div>
        <img src="${SHOT}/07-alert-rule-added.png" alt="" />
      </div>
      <p class="one">צילום מסך אמיתי: שורת התראה פעילה — "אדם מרים יד גבוה מעל הראש" — לצד תדריך משמרת לילה שנכתב בשיחה עם Ghost.</p>`,
  },

  /* ---------------------------------------------- 07 — real screen: live conversation */
  {
    nav: "מסך אמיתי · שיחה חיה",
    title: "מסך אמיתי · שיחה חיה",
    bubble: "ומה קורה כששואלים מצלמה בשידור חי?",
    body: `
      <p class="hero-s">ככה שואלים מצלמה <span class="dim">מה היא רואה.</span></p>
      <div class="shot">
        <div class="shot-head"><span class="mono" dir="ltr">GHOST // LIVE SYSTEM</span><span class="mono shot-cap" dir="ltr">live camera session</span></div>
        <img src="${SHOT}/10-live-answer-frame.png" alt="" />
      </div>
      <p class="one">צילום מסך אמיתי: מצלמה חיה בשיחה. המפעיל ביקש לציין כל דבר שדורש תשומת לב — והתשובה מתארת את הסצנה והפריימים מצורפים כראיה.</p>`,
  },

  /* ---------------------------------------------- 08 — real screen: alert fired */
  {
    nav: "מסך אמיתי · התראה",
    title: "מסך אמיתי · מצב התראה פעיל",
    bubble: "ואיך נראה מצב התראה דרוך בשידור חי?",
    body: `
      <p class="hero-s">וככה נראה הרגע <span class="dim">שבו המערכת על המשמר.</span></p>
      <div class="shot">
        <div class="shot-head"><span class="mono" dir="ltr">GHOST // LIVE SYSTEM</span><span class="mono shot-cap" dir="ltr">alert armed · live</span></div>
        <img src="${SHOT}/14-alert-armed.png" alt="" />
      </div>
      <p class="one">צילום מסך אמיתי: מצב התראה פעיל בשידור חי — ערוץ ההתראות דרוך, שורת ההתראה מופעלת, וכל פריים שנכנס נבחן מולה ברציפות.</p>`,
  },

  /* ---------------------------------------------- 09 — the case */
  {
    nav: "המקרה · 12 הדקות שלפני",
    title: "המקרה · 12 הדקות שלפני",
    bubble: "איך נראה אירוע שנמנע?",
    body: `
      <p class="hero-s">האירוע שלא קרה <span class="dim">לא מופיע באף דוח.</span></p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">case-timeline</span><span class="copy mono" dir="ltr">12 minutes</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t mono" dir="ltr">09:41</span><span class="n-s">התור באשנב עומד. ממתינים מתחילים לקום מהכיסאות.</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t mono" dir="ltr">09:47</span><span class="n-s">צפיפות מול האשנב. רכינה מעבר לדלפק. התראה נשלחת.</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t mono" dir="ltr">09:49</span><span class="n-s">מנהל הביטחון רואה את הפריים בטלפון. מאבטח מופנה לקבלה.</span></div>
            <div class="arrow">&larr;</div>
            <div class="node ok"><span class="n-t mono" dir="ltr">09:53</span><span class="n-s">נוכחות, שיחה, הפרדה. התור זורם. בלי אירוע.</span></div>
          </div>
        </div>
      </div>
      <p class="one">שתים-עשרה דקות עברו בין הסימן הראשון לרגע שבו זה היה הופך לאירוע. הפעם — היה מי שראה אותן.</p>`,
  },

  /* ---------------------------------------------- 10 — security manager day */
  {
    nav: "היום-יום של מנהל הביטחון",
    title: "היום-יום של מנהל הביטחון",
    bubble: "מה משתנה ביום העבודה של מנהל הביטחון?",
    body: `
      <p class="hero-s">ממנהל חקירות <span class="dim">— למנהל מניעה.</span></p>
      <div class="cols">
        <div class="col">
          <div class="vs">
            <div class="vs-col">
              <div class="vs-head mono" dir="ltr">BEFORE</div>
              <div class="vs-item">נפתח הבוקר מול קיר מסכים</div>
              <div class="vs-item">לומד על אירועים מהטלפון — אחרי</div>
              <div class="vs-item">שעות על הקלטות לחקירת אתמול</div>
              <div class="vs-item">עונה על "איפה הייתם"</div>
            </div>
            <div class="vs-col after">
              <div class="vs-head mono" dir="ltr">AFTER</div>
              <div class="vs-item">נפתח הבוקר עם סיכום בדיקות הלילה</div>
              <div class="vs-item">מקבל התראה בשלב הסימנים — לפני</div>
              <div class="vs-item">שואל כל מצלמה שאלה ומקבל תשובה</div>
              <div class="vs-item">מנהל נוכחות מכוונת — איפה שצריך, כשצריך</div>
            </div>
          </div>
        </div>
        <div class="col media-col">
          <div class="media tall">
            <span class="badge mono">FIELD // ON SHIFT</span>
            <img src="${IMG}/security-manager-phone.png" alt="" />
          </div>
          <p class="cap">כל המרחב הרפואי — בכיס. שיחה אחת לכל מצלמה.</p>
        </div>
      </div>`,
  },

  /* ---------------------------------------------- 11 — new morning routine */
  {
    nav: "שגרת בוקר חדשה",
    title: "שגרת בוקר חדשה",
    bubble: "איך נראית משמרת שמתחילה נכון?",
    body: `
      <p class="hero-s">הבוקר מתחיל בשיחה. <span class="dim">לא בסיור מסכים.</span></p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">shift-routine</span><span class="copy mono" dir="ltr">runs itself</span></div>
        <div class="cb-body rules">
          <div class="rule"><span class="r-tag mono" dir="ltr">06:30</span><span class="r-txt">בדיקה אוטומטית: יציאות חירום פנויות, דלתות מחלקות סגורות, אזורי המתנה ערוכים.</span></div>
          <div class="rule"><span class="r-tag mono" dir="ltr">08:00</span><span class="r-txt">שעת העומס בקבלה — ניטור רציף של צפיפות והסלמה מול האשנבים נכנס לפעולה.</span></div>
          <div class="rule"><span class="r-tag mono" dir="ltr">12:40</span><span class="r-txt">שאלה יזומה: "מה מצב ההמתנה בבית המרקחת?" — תשובה תוך שניות, בלי לקום מהכיסא.</span></div>
          <div class="rule"><span class="r-tag mono" dir="ltr">19:00</span><span class="r-txt">סיכום משמרת: כל בדיקה, כל התראה וכל טיפול — מתועדים מעצמם. זיכרון ארגוני שנבנה לבד.</span></div>
        </div>
      </div>`,
  },

  /* ---------------------------------------------- 12 — privacy */
  {
    nav: "מה. לא מי.",
    title: "מה. לא מי.",
    bubble: "ומה עם הפרטיות של המטופלים?",
    body: `
      <p class="hero">Ghost מבין <b>מה</b> קורה.<br/><span class="dim">לא מי האנשים.</span></p>
      <div class="stats">
        <div class="stat"><div class="s-b">תיאור מצבים</div><div class="s-l">"צפיפות מול האשנב" — לא זהויות. ללא זיהוי פנים.</div></div>
        <div class="stat"><div class="s-b">עיבוד מקומי</div><div class="s-l">תמיכה בסביבה מבודדת — הווידאו לא עוזב את הארגון</div></div>
        <div class="stat"><div class="s-b">תיעוד מלא</div><div class="s-l">כל שאלה וכל צפייה נרשמות — מי, מה ומתי</div></div>
      </div>
      <p class="one">מניעת אלימות דורשת להבין מה מתרחש. היא לא דורשת לדעת מי האנשים. וזה כל ההבדל.</p>`,
  },

  /* ---------------------------------------------- 13 — take home */
  {
    nav: "לקחת הביתה",
    title: "לקחת הביתה",
    bubble: "מה לוקחים מכאן הביתה?",
    body: `
      <p class="hero">חלון המניעה היה שם תמיד.<br/><span class="dim">עכשיו יש מי שמסתכל.</span></p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">the-idea</span><span class="copy mono" dir="ltr">one sentence</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t">הסימנים גלויים</span><span class="n-s">ההסלמה מבשילה בשקט, מול העדשה</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">המצלמות כבר שם</span><span class="n-s">צריך רק מי שיקשיב להן</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">ההגדרה היא משפט</span><span class="n-s">בעברית. של איש ביטחון. לא של מתכנת</span></div>
          </div>
        </div>
      </div>
      <div class="closer">
        <div class="big">האירוע הבא כבר התחיל להבשיל איפשהו. השאלה היא רק אם מישהו רואה.</div>
        <div class="small">Ghost · ועכשיו — אתם</div>
      </div>`,
  },

  /* ---------------------------------------------- FAQ / audience questions */
  {
    nav: "שאלות מהקהל",
    title: "שאלות מהקהל",
    bubble: "שאלות מהמשתתפים?",
    body: `
      <p class="hero-s">עכשיו אתם. <span class="dim">ואלה השאלות שכולם שואלים:</span></p>
      <div class="faq">
        <div class="qa"><div class="q">זה מחליף את המאבטח או המוקדן?</div><div class="a">לא. כל התראה מגיעה לאדם, עם הפריים. ההחלטה וההתערבות נשארות אנושיות — תמיד.</div></div>
        <div class="qa"><div class="q">צריך להחליף מצלמות או תשתית?</div><div class="a">לא. Ghost היא שכבת הבנה מעל המצלמות הקיימות — בלי חומרה חדשה ובלי התקנות על המצלמות.</div></div>
        <div class="qa"><div class="q">מי מגדיר את ההתראות?</div><div class="a">איש הביטחון עצמו, במשפט בעברית. בלי מתכנת, בלי אינטגרטור, בלי אפיון.</div></div>
        <div class="qa"><div class="q">מה עם פרטיות מטופלים ועובדים?</div><div class="a">המערכת מתארת מצבים, לא זהויות: ללא זיהוי פנים, תמיכה בעיבוד מקומי, ותיעוד מלא של כל צפייה.</div></div>
        <div class="qa"><div class="q">ומה עם התראות שווא?</div><div class="a">כל התראה מגיעה עם הפריים שהפעיל אותה — מאשרים או דוחים בשנייה, ומחדדים את הניסוח באותו משפט.</div></div>
        <div class="qa"><div class="q">כמה זמן לוקח להתחיל?</div><div class="a">פיילוט במרפאה אחת, על המצלמות הקיימות, עם יעדים מדידים מראש — מתחילים בקטן ומרחיבים לפי תוצאות.</div></div>
      </div>`,
  },

  /* ---------------------------------------------- live demo on stage */
  {
    nav: "הדגמה חיה",
    title: "הדגמה חיה על הבמה",
    bubble: "אפשר לראות את זה עובד — עכשיו?",
    body: `
      <p class="hero">עכשיו — לא במצגת.<br/><span class="dim">על הבמה.</span></p>
      <p class="one">חמש הדקות הקרובות: מצלמה חיה, התראה שמוגדרת במשפט אחד מול עיניכם — וההתראה שנורית בזמן אמת.</p>
      <div class="codeblock">
        <div class="cb-head"><span class="mono" dir="ltr">LIVE // ON STAGE</span><span class="copy mono" dir="ltr">real time</span></div>
        <div class="cb-body">
          <div class="pipe">
            <div class="node"><span class="n-t">מצלמה חיה על הבמה</span><span class="n-s">מתחברת לשיחה כמו כל מצלמה במרפאה</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">הקהל בוחר סימן מקדים</span><span class="n-s">תציעו תרחיש — מהרשימה או משלכם</span></div>
            <div class="arrow">&larr;</div>
            <div class="node"><span class="n-t">ההגדרה נכתבת במשפט</span><span class="n-s">בעברית, מול העיניים, בלי תכנות</span></div>
            <div class="arrow">&larr;</div>
            <div class="node ok"><span class="n-t">ההתראה נורית</span><span class="n-s">בזמן אמת, עם הפריים שתפס אותה</span></div>
          </div>
        </div>
      </div>
      <div class="closer">
        <div class="big">כל מה שראיתם בשקפים — קורה עכשיו, בלייב.</div>
        <div class="small">Ghost · הדגמה חיה · תודה לצוותים שבחזית</div>
      </div>`,
  },
];

/* ----------------------------------------------------------------- html */

const pad = (n) => String(n).padStart(2, "0");
const TOTAL = slides.length;

const css = `
  :root {
    --bg-primary: #ffffff;
    --bg-sidebar: #f9f9f9;
    --bg-surface: #f4f4f4;
    --bg-surface-hover: #ececec;
    --bg-code: #fafafa;
    --text-primary: #0d0d0d;
    --text-secondary: rgb(110 110 110);
    --text-muted: rgb(155 155 155);
    --border-subtle: rgb(229 229 229);
    --accent: #0d0d0d;
    --accent-ink: #ffffff;
    --sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    --mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 338.667mm 190.5mm; margin: 0; }
  html, body {
    background: #ededed;
    color: var(--text-primary);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .mono { font-family: var(--mono); letter-spacing: 0.04em; direction: ltr; unicode-bidi: embed; }

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

  /* ---------- Black cover: Ghost icon only ---------- */
  .page.cover {
    background: #0d0d0d;
    align-items: center; justify-content: center;
  }
  .page.cover img {
    width: 118px; height: 118px; object-fit: contain; display: block;
    filter: invert(1);
  }

  /* ---------- Sidebar (right, RTL) ---------- */
  .sidebar {
    width: 52mm; flex-shrink: 0;
    background: var(--bg-sidebar);
    border-inline-end: 1px solid var(--border-subtle);
    display: flex; flex-direction: column;
    padding: 13px 10px; gap: 5px;
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
    background: var(--bg-primary);
  }
  .newchat .plus { width: 13px; height: 13px; position: relative; opacity: 0.85; }
  .newchat .plus::before, .newchat .plus::after { content: ""; position: absolute; background: var(--text-secondary); }
  .newchat .plus::before { right: 5.5px; top: 1px; width: 2px; height: 11px; border-radius: 2px; }
  .newchat .plus::after { top: 5.5px; right: 1px; height: 2px; width: 11px; border-radius: 2px; }
  .nav-label { font-size: 9.5px; font-weight: 600; color: var(--text-muted); padding: 9px 8px 3px; }
  .nav-item {
    display: flex; align-items: center; gap: 7px;
    height: 21.5px; padding: 0 9px; border-radius: 7px;
    font-size: 10px; color: var(--text-secondary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .nav-item .ix { font-size: 8.5px; color: var(--text-muted); width: 14px; font-family: var(--mono); direction: ltr; }
  .nav-item.active { background: var(--bg-surface); color: var(--text-primary); }
  .nav-item.active .ix { color: var(--text-primary); }
  .sidebar .spacer { flex: 1; }
  .sidebar .foot { border-top: 1px solid var(--border-subtle); padding: 9px 8px 1px; font-size: 9px; color: var(--text-muted); line-height: 1.5; }
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

  .thread { flex: 1; min-width: 0; overflow: hidden; padding: 14px 60px 6px; display: flex; flex-direction: column; justify-content: center; gap: 13px; }

  .msg-user { display: flex; justify-content: flex-end; }
  .msg-user .bubble {
    max-width: 72%; background: var(--bg-surface); color: var(--text-primary);
    border-radius: 18px; padding: 9px 16px; font-size: 14px; line-height: 1.5;
  }
  .msg-ai { display: flex; gap: 14px; }
  .msg-ai .av { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; overflow: hidden; margin-top: 4px; }
  .msg-ai .av img { width: 100%; height: 100%; display: block; }
  .msg-ai .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 11px; }
  .kicker { font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.18em; text-transform: uppercase; }

  /* TED hero statements */
  .hero { font-size: 36px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.18; color: var(--text-primary); }
  .hero-s { font-size: 27px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.22; color: var(--text-primary); }
  .hero .dim, .hero-s .dim { color: var(--text-muted); font-weight: 500; }
  .one { font-size: 14.5px; line-height: 1.6; color: var(--text-secondary); max-width: 200mm; }

  /* photo media card — VISINT grayscale */
  .media {
    position: relative; border: 1px solid var(--border-subtle); border-radius: 14px;
    overflow: hidden; background: var(--bg-surface);
  }
  .media img { width: 100%; height: 300px; object-fit: cover; display: block; filter: grayscale(1) contrast(1.03); }
  .media.tall img { height: 330px; }
  .media .badge {
    position: absolute; top: 10px; inset-inline-start: 12px; z-index: 2;
    font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase;
    color: #ffffff; background: rgba(13,13,13,0.62);
    padding: 4px 9px; border-radius: 999px;
  }
  .cap { font-size: 11px; color: var(--text-muted); line-height: 1.5; margin-top: 7px; }

  /* real system screenshot card */
  .shot { border: 1px solid var(--border-subtle); border-radius: 14px; overflow: hidden; background: var(--bg-surface); }
  .shot-head {
    display: flex; align-items: center; justify-content: space-between;
    background: #0d0d0d; color: #ececec; padding: 7px 14px;
    font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase;
  }
  .shot-head .shot-cap { color: rgb(155 155 155); }
  .shot img { width: 100%; max-height: 358px; object-fit: contain; display: block; background: #0d0d0d; }

  /* two columns */
  .cols { display: flex; gap: 22px; align-items: stretch; }
  .cols .col { flex: 1.25; min-width: 0; }
  .cols .media-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }

  /* numbered feature list */
  .feat { list-style: none; display: flex; flex-direction: column; }
  .feat li { padding: 7.5px 0; border-bottom: 1px solid var(--border-subtle); display: flex; gap: 12px; align-items: flex-start; }
  .feat li:last-child { border-bottom: none; }
  .feat .num { font-size: 10px; color: var(--text-muted); margin-top: 3px; flex-shrink: 0; }
  .feat .ft-title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); display: inline; }
  .feat .ft-desc { font-size: 11.5px; color: var(--text-secondary); line-height: 1.45; margin-top: 1px; }

  /* code-style blocks */
  .codeblock { background: var(--bg-code); border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; }
  .cb-head { display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); padding: 7px 14px; font-size: 10.5px; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle); }
  .cb-head .copy { color: var(--text-muted); }
  .cb-body { padding: 15px 15px; }

  .pipe { display: flex; align-items: stretch; }
  .node {
    flex: 1; background: var(--bg-primary); border: 1px solid var(--border-subtle);
    border-radius: 10px; padding: 12px 10px; text-align: center;
    display: flex; flex-direction: column; gap: 5px; justify-content: center;
  }
  .node.ok { border-color: #9a9a9a; background: var(--bg-surface); }
  .node .n-t { font-size: 12.5px; font-weight: 600; color: var(--text-primary); line-height: 1.25; }
  .node .n-s { font-size: 10px; color: var(--text-secondary); line-height: 1.4; }
  .arrow { align-self: center; width: 24px; text-align: center; color: var(--text-muted); font-size: 15px; flex-shrink: 0; }

  /* rule rows (sign → sentence / routine) */
  .rules { display: flex; flex-direction: column; gap: 0; padding: 4px 15px; }
  .rule { display: flex; align-items: flex-start; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); }
  .rule:last-child { border-bottom: none; }
  .r-tag {
    flex-shrink: 0; font-size: 9.5px; color: var(--text-secondary);
    border: 1px solid var(--border-subtle); border-radius: 999px;
    padding: 3px 9px; margin-top: 1px; background: var(--bg-primary);
  }
  .r-txt { font-size: 13px; color: var(--text-primary); line-height: 1.5; }

  /* in-app alert-setup mock (light system UI) */
  .mock { border: 1px solid var(--border-subtle); border-radius: 14px; overflow: hidden; background: var(--bg-primary); }
  .mock-bar {
    display: flex; align-items: center; justify-content: space-between;
    background: #0d0d0d; color: #ececec; padding: 7px 14px;
    font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase;
  }
  .mock-bar-cap { color: rgb(155 155 155); }
  .mock-body { padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 10px; }
  .mock-head { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .mock-sub { font-size: 11px; color: var(--text-secondary); line-height: 1.5; }
  .mock-label { font-size: 10px; font-weight: 600; color: var(--text-muted); margin-top: 2px; }
  .mock-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border: 1px solid var(--border-subtle); border-radius: 12px;
    background: var(--bg-code); padding: 12px 14px;
  }
  .mock-row .row-txt { font-size: 13px; font-weight: 500; color: var(--text-primary); line-height: 1.5; }
  .toggle {
    width: 34px; height: 19px; border-radius: 999px; background: rgb(101 163 13);
    position: relative; flex-shrink: 0;
  }
  .toggle::after {
    content: ""; position: absolute; top: 2px; inset-inline-start: 2px;
    width: 15px; height: 15px; border-radius: 50%; background: #ffffff;
  }
  .toggle.small { width: 30px; height: 17px; }
  .toggle.small::after { width: 13px; height: 13px; }
  .mock-status { display: flex; align-items: center; gap: 7px; font-size: 10.5px; color: rgb(101 163 13); font-weight: 500; }
  .dot-live { width: 7px; height: 7px; border-radius: 50%; background: rgb(101 163 13); flex-shrink: 0; }

  /* FAQ grid */
  .faq { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .qa { border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 14px; background: var(--bg-code); }
  .qa .q { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.4; }
  .qa .a { font-size: 11.5px; color: var(--text-secondary); line-height: 1.5; margin-top: 4px; }

  /* before / after */
  .vs { display: flex; gap: 12px; }
  .vs-col { flex: 1; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 14px; background: var(--bg-code); }
  .vs-col.after { background: var(--bg-primary); border-color: #bdbdbd; }
  .vs-head { font-size: 9px; letter-spacing: 0.22em; color: var(--text-muted); margin-bottom: 8px; }
  .vs-col.after .vs-head { color: var(--text-primary); }
  .vs-item { font-size: 12px; color: var(--text-secondary); line-height: 1.45; padding: 6px 0; border-bottom: 1px solid var(--border-subtle); }
  .vs-item:last-child { border-bottom: none; }
  .vs-col.after .vs-item { color: var(--text-primary); }

  /* stats */
  .stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
  .stat { border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px 12px; text-align: center; background: var(--bg-code); }
  .stat .s-b { font-size: 17px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }
  .stat .s-l { font-size: 11px; color: var(--text-secondary); margin-top: 5px; line-height: 1.45; }

  .closer { padding: 16px 22px; border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-code); text-align: center; }
  .closer .big { font-size: 17px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; line-height: 1.4; }
  .closer .small { font-size: 11.5px; color: var(--text-secondary); margin-top: 5px; }

  /* ---------- Composer ---------- */
  .composer-wrap { padding: 6px 60px 12px; flex-shrink: 0; }
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
      <div class="name">Ghost<span class="sub">זיהוי סימנים מוקדמים · TED Brief</span></div>
    </div>
    <div class="newchat"><span class="plus"></span><span>שיחה חדשה</span></div>
    <div class="nav-label">פרקי ההרצאה</div>
      ${items}
    <div class="spacer"></div>
    <div class="foot"><b>שירותי בריאות כללית</b><br/>TED Brief · מניעת אלימות · 2026</div>
  </aside>`;
}

function page(s, i) {
  if (s.cover) {
    return `<!-- ============ PAGE ${pad(i + 1)} — Cover ============ -->
<div class="page cover">
  <img src="${ICON}" alt="Ghost" />
</div>`;
  }
  return `<!-- ============ PAGE ${pad(i + 1)} — ${s.title} ============ -->
<div class="page">
  ${sidebar(i)}
  <div class="main">
    <div class="topbar">
      <div class="title">${s.title}</div>
      <div class="meta mono">${pad(i + 1)} / ${pad(TOTAL)}</div>
    </div>
    <div class="thread">
      <div class="msg-user"><div class="bubble">${s.bubble}</div></div>
      <div class="msg-ai">
        <div class="av"><img src="${ICON}" alt="Ghost" /></div>
        <div class="body">${s.body}
        </div>
      </div>
    </div>
    <div class="composer-wrap">
      <div class="composer"><span class="ph">שאל את Ghost מה קורה עכשיו בקבלה…</span><span class="send"></span></div>
      <div class="disclaimer">Ghost — TED Brief · זיהוי סימנים מוקדמים לאלימות במוסדות רפואיים</div>
    </div>
  </div>
</div>`;
}

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ghost — זיהוי סימנים מוקדמים לאלימות · TED Brief</title>
<style>${css}</style>
</head>
<body>

${slides.map((s, i) => page(s, i)).join("\n\n")}

</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${TOTAL} slides, light 16:9)`);
