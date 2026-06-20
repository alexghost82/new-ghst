# תכנית: בנייה מחדש של `/partners` כהמשך טבעי של `/capabilities`

מסמך תכנון. לא בוצע עדיין שום שינוי קוד. מטרת המסמך: לקחת את שפת העיצוב שכבר
**מומשה** בעמוד [`/capabilities`](../../frontend/src/components/auth/WhatGhostCanDoPage.tsx)
(הסגנון בהשראת `cursor.com/product`, monochrome, tokens קיימים) ולעצב מחדש את עמוד
[`/partners`](../../frontend/src/components/auth/PartnersPage.tsx) כך שירגיש כמו אותו
מוצר ואותו קו עיצובי — בלי לשנות את ה-copy ואת המסרים של תוכנית השותפים.

מקור האמת לשפת הסגנון: הקוד שכבר רץ ב-`components/capabilities/*` ו-`data/capabilities.ts`.

---

## 1. למה צריך redesign — הפער בין שני העמודים

שני העמודים נכונים מבחינת מותג (monochrome, tokens, אנגלית/LTR), אבל הם נכתבו
ב**שתי שכבות עיצוב שונות**. `/partners` הוא הדור הישן ("tactical card"), `/capabilities`
הוא הדור החדש ("Cursor-style"). הטבלה ממקדת את ההבדלים שצריך לגשר:

| מאפיין | `/partners` (קיים) | `/capabilities` (יעד) |
| --- | --- | --- |
| רוחב container | `max-w-5xl` | `max-w-6xl` |
| כותרות | `font-semibold` + `tracking-[-0.03em]` (כבד) | `.ghost-display` (weight 400, `-0.03em`, `line-height 1.02`) ב-`clamp` גדול |
| כותרת סקשן | `text-[22px] sm:text-[28px]` | `.ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)]` |
| תווית-פרק (kicker) | `SectionLabel` עם קו אופקי | מונו `tracking-[0.24em]` מעל הכותרת, בלי קו |
| מקצב אנכי | `mt-20` בין סקשנים בתוך `main` יחיד | סקשנים full-bleed, רקעים מתחלפים (`bg-ghost-bg` ↔ `bg-ghost-bg-secondary`), `py-20/24` |
| כרטיסים | spotlight + tilt + `-translate-y-1` + shadows כבדים (`handleSpotlight`/`Spotlight`) | `rounded-2xl border-ghost-border-subtle bg-ghost-surface/20 p-6`, hover עדין בלבד |
| רקע אווירה | `ghost-ambient` blobs בלבד | `ghost-ambient ghost-ambient--page` עם `ghost-ambient__grid` + blobs (ב-hero) |
| Hero | טקסט + תמונת כנס (`/partners-conference.png`) | hero קולנועי עם `.ghost-display` ענק + dual CTA |
| Motion | `Reveal` מקומי (כפילות קוד) | `Reveal` מתוך `components/capabilities/shared` |
| CTA כפתורים | `bg-ghost-accent` (תקין) | זהה (`bg-ghost-accent` ראשי + `ghost-glass` משני) |

**מסקנה:** ה-redesign הוא בעיקר **התאמת שפת קומפוננטות וטיפוגרפיה**, לא שכתוב תוכן.
כל הטקסטים, ה-tracks, ה-steps וה-CTA נשמרים מילה במילה.

---

## 2. עקרון מנחה — "אותו DNA, תוכן אחר"

`/partners` יאמץ בדיוק את אותם primitives של `/capabilities`:

- `Reveal`, `SectionLabel` (גרסת ה-mono kicker), `ghost-display`, `ghost-link-arrow`,
  `ghost-glass`, `ghost-ambient--page` — **ייבוא**, לא העתקה.
- מבנה עמוד: `Hero` full-bleed → סדרת סקשנים full-bleed עם רקעים מתחלפים → `FinalCta`.
- כרטיסים שטוחים ושקטים (לא spotlight/tilt). hover = שינוי עדין של `bg`/`border` בלבד.

> מה **לא** משתנה: ה-copy, ה-`SiteSidebar` (`active="partners"`, `accessLabel="Become a partner"`),
> נעילת `locale="en"`/`dir="ltr"`, וזרימת `onAccess`/`onBack`/`onNavigate`.

---

## 3. ארכיטקטורת מידע — מיפוי הסקשנים הקיימים לסגנון החדש

כל סקשן קיים נשמר; משתנה רק העטיפה הויזואלית. מיפוי 1:1:

| # | סקשן קיים ב-`PartnersPage` | מקבילה עיצובית ב-`/capabilities` | רקע |
| --- | --- | --- | --- |
| 1 | Hero (kicker + h1 + פסקה + CTA + תמונת כנס) | `CapabilitiesHero` (hero קולנועי) | `ghost-ambient--page` |
| 2 | Why Ghost + 3 כרטיסי `AUDIENCES` | סקשן כותרת-פרק + grid כרטיסים שטוחים | `bg-ghost-bg` |
| 3 | Distributor Strategy (טקסט בלבד) | סקשן טקסט עם `.ghost-display` | `bg-ghost-bg-secondary` |
| 4 | Partnership Tracks (2 כרטיסי `TRACKS`) | 2 כרטיסי `ghost-glass` עם רשימת `Check` | `bg-ghost-bg` |
| 5 | Joining Process (4 `STEPS` ממוספרים) | grid 4 כרטיסים עם מספר מונו גדול | `bg-ghost-bg-secondary` |
| 6 | Ongoing Support (4 `SUPPORT`) | grid כרטיסי אייקון שטוחים | `bg-ghost-bg` |
| 7 | Distributor Portal (טקסט + רשימת `PORTAL_POINTS`) | grid דו-טורי טקסט + פאנל רשימה | `bg-ghost-bg-secondary` |
| 8 | What Makes Ghost Different (4 `DIFFERENTIATORS`) | grid כרטיסי אייקון שטוחים | `bg-ghost-bg` |
| 9 | Pull quote (`blockquote` ב-`ghost-glass`) | `blockquote` בסגנון `TrustedByStrip` | `bg-ghost-bg-secondary` |
| 10 | Closing CTA | `FinalCta` (גרסת "Try Ghost now." הגדולה) | `border-t` |

> **חידוש אופציונלי (החלטה #3):** להוסיף "TrustedByStrip" של ציטוטי שותפים/מפיצים —
> רק אם יש ציטוטים אמיתיים. אחרת לדלג (אסור להמציא עדויות).

---

## 4. שינויים ב-Design System

### 4.1 `frontend/src/index.css`
- **אין צורך בקלאסים חדשים.** הכול כבר קיים: `.ghost-display` (שורות ~2055),
  `.ghost-link-arrow` (~2063), `.ghost-glass` (~2027), `.ghost-ambient--page` (~1911),
  `.ghost-ambient__grid` (~1957).

### 4.2 `frontend/tailwind.config.js`
- ללא שינוי. כל ה-tokens (`ghost-bg`, `ghost-bg-secondary`, `ghost-surface`,
  `ghost-border-subtle`, `ghost-accent`, `ghost-text-*`) קיימים ובשימוש בשני העמודים.

> חוקי מותג נאכפים: monochrome בלבד (אין כתום `#F54E00`); אייקון Ghost ללא מעטפת;
> טקסט דינמי דרך `sanitizeBrand` (כאן אין טקסט דינמי — הכול סטטי באנגלית).

---

## 5. מודל נתונים — חילוץ התוכן מחוץ לקומפוננטה

כיום כל המערכים (`AUDIENCES`, `TRACKS`, `STEPS`, `SUPPORT`, `PORTAL_POINTS`,
`DIFFERENTIATORS`) מוגדרים inline ב-`PartnersPage.tsx`. נחלץ אותם לקובץ נתונים,
בדיוק כמו ש-`/capabilities` שואב מ-`data/capabilities.ts`.

**קובץ חדש:** `frontend/src/data/partners.ts`
- טיפוסים: `PartnerAudience`, `PartnerTrack`, `JoinStep`, `SupportItem`, `Differentiator`.
- מערכים: `AUDIENCES`, `TRACKS`, `STEPS`, `SUPPORT`, `PORTAL_POINTS`, `DIFFERENTIATORS`.
- `PARTNERS_CHROME` עם כל מחרוזות העמוד (hero, kickers וכותרות הסקשנים, final CTA).
- התוכן נשאר **אנגלית בלבד** (העמוד מקובע ל-`en`), כך שאין צורך ב-`Record<Locale, ...>`
  כמו ב-capabilities — מבנה שטוח של מחרוזות. (החלטה #4: לקבע `en` או לתמוך דו-לשוני.)

> הטקסטים מועתקים כמו שהם מהקובץ הקיים — אפס שינוי copy.

---

## 6. ארכיטקטורת קומפוננטות

כדי לשמור על קומפוננטות קטנות ולמחזר את שפת ה-capabilities, נפצל לתיקייה ייעודית:

```
components/partners/
  PartnersHero.tsx        # hero קולנועי + תמונת הכנס בתוך מסגרת ghost-glass
  WhyGhostSection.tsx     # כותרת-פרק + grid AUDIENCES (כרטיסים שטוחים)
  TracksSection.tsx       # 2 כרטיסי ghost-glass (Distributor / Ambassador)
  JoinProcessSection.tsx  # 4 שלבים עם מספר מונו גדול
  SupportSection.tsx      # grid SUPPORT + הערת שוליים
  PortalSection.tsx       # grid דו-טורי טקסט + רשימת PORTAL_POINTS
  DifferentiatorsSection.tsx # grid DIFFERENTIATORS + pull-quote
  PartnersFinalCta.tsx    # "Become a Ghost partner" בעיצוב FinalCta הגדול
```

- **שיתוף primitives:** לייבא `Reveal`, `SectionLabel` מ-`components/capabilities/shared`.
  אם נרצה ניתוק תלות בין דפי השיווק — לשקול הוצאת `shared.tsx` ל-`components/marketing/shared.tsx`
  משותף (החלטה #2). ברירת מחדל: לייבא מ-capabilities/shared כדי לא לשבור את capabilities.
- `PartnersPage.tsx` הופך ל**מרכיב הרכבה** דק: `SiteSidebar` + רצף הסקשנים + `FinalCta`,
  בדיוק כמו ש-`WhatGhostCanDoPage.tsx` הפך למרכיב הרכבה.
- מוחקים את `handleSpotlight`/`Spotlight`/`Reveal`/`SectionLabel` המקומיים מ-`PartnersPage`
  (כפילות קוד שמוחלפת ב-primitives המשותפים).

---

## 7. Hero חדש (`PartnersHero`)

- שתי שורות כותרת ב-`.ghost-display text-[clamp(2.5rem,6vw,4.5rem)]`:
  "Everything is about to change." / "Join the right side of the shift." (נשמר ה-copy).
- תת-כותרת ב-`text-[17px] text-ghost-text-secondary max-w-2xl`.
- pill kicker עם `ghost-alert-dot` (כמו `CapabilitiesHero`): "Ghost // Partner Program".
- dual CTA: ראשי `bg-ghost-accent` ("How to join" → `onAccess`) + משני `ghost-glass`
  (אופציונלי "Talk to us"). שמירה על `ArrowRight`/`ArrowUpRight` עם `rtl:rotate-180`.
- מתחת: תמונת הכנס `/partners-conference.png` בתוך מסגרת `ghost-glass rounded-3xl`
  (במקום ה-figure עם spotlight/tilt) — שקטה יותר, תואמת ל-`DemoFrame` של capabilities.
- רקע: `ghost-ambient ghost-ambient--page` עם `ghost-ambient__grid` + שני blobs.

---

## 8. רספונסיביות, RTL ולוקליזציה
- העמוד נשאר מקובע `en`/`ltr` (כמו היום). שמירה על `ps-/pe-` (logical properties).
- Breakpoints: grids → טור יחיד ב-`<sm`/`<lg` (כפי שכבר נהוג); כותרות `clamp` רספונסיביות.
- ה-`lg:ps-[260px]` עבור ה-sidebar הקבוע נשמר.

## 9. אנימציות
- שימוש חוזר ב-`Reveal` המשותף (IntersectionObserver, fade-up, מכבד `prefers-reduced-motion`).
- `ghost-ambient` blobs (מושבתים תחת reduced-motion).
- מסירים tilt/spotlight כבדים; hover מצטמצם ל-`bg`/`border`/`translate` עדין כמו ב-capabilities.

---

## 10. שלבי ביצוע + הערכת זמן

| שלב | תיאור | סיכון |
| --- | --- | --- |
| 0 | אישור החלטות פתוחות (סעיף 13) | — |
| 1 | חילוץ `data/partners.ts` (טיפוסים + מערכים + chrome) מהקוד הקיים | נמוך |
| 2 | (אופציונלי) הוצאת primitives משותפים ל-`components/marketing/shared` | נמוך |
| 3 | `PartnersHero` (hero קולנועי + תמונה במסגרת ghost-glass) | בינוני |
| 4 | סקשני התוכן (Why/Tracks/Join/Support/Portal/Differentiators) | בינוני |
| 5 | `PartnersFinalCta` (גרסת "Try Ghost now." הגדולה) | נמוך |
| 6 | הרכבה מחדש של `PartnersPage` + מחיקת קוד כפול | בינוני |
| 7 | QA ויזואלי בדפדפן Cursor (light+dark, 1440/768/390) + בדיקת רצף מ-/capabilities | — |

עלות בן-אדם משוערת: ~4–7 שעות פיתוח. בסוכן: צפי משמעותית פחות.

## 11. QA / קריטריוני קבלה
- `tsc --noEmit` + `npm run build` עוברים.
- אין הופעות של "openai"/כתום זר.
- מעבר רציף ויזואלית מ-`/capabilities` ל-`/partners`: אותה טיפוגרפיה (`ghost-display`),
  אותו מקצב סקשנים, אותם כרטיסים שטוחים, אותו hero language.
- כל סקשן קיים עדיין מיוצג, כל ה-copy נשמר מילה במילה.
- אייקון Ghost ללא מעטפת; `ghost-ambient` ללא תפרים מרובעים; תקין ב-dark וב-light וב־3 רוחבי מסך.

## 12. סיכונים והחלטות שדורשות מימוש זהיר
- **תלות בין דפי שיווק:** אם נייבא מ-`capabilities/shared`, שינוי עתידי שם משפיע על partners.
  ההמלצה (שלב 2) להוציא ל-`marketing/shared` מנטרל זאת.
- **footer:** capabilities משתמש ב-`FinalCta` כ-footer; partners היום בעל footer דביק נפרד.
  צריך להחליט אם לשמר את ה-footer הדביק או להחליפו ב-`FinalCta` בלבד (החלטה #1).

## 13. החלטות פתוחות (דורשות אישור לפני קוד)
1. **Footer:** להחליף את ה-footer הדביק של partners ב-`FinalCta` בסגנון capabilities, או
   לשמר footer דביק קטן מתחת? (ברירת מחדל מוצעת: `FinalCta` גדול, ללא footer דביק.)
2. **Shared primitives:** לייבא מ-`capabilities/shared` (מהיר) או להוציא ל-`marketing/shared`
   משותף (נקי יותר, מעט יותר עבודה)? (ברירת מחדל מוצעת: להוציא ל-`marketing/shared`.)
3. **TrustedByStrip:** להוסיף רצועת ציטוטי שותפים? רק אם יש ציטוטים אמיתיים — אחרת לדלג.
4. **דו-לשוניות:** לקבע `en` בלבד (כמו היום), או להכין `data/partners.ts` כ-`Record<Locale,...>`
   לקראת תמיכה עתידית בעברית? (ברירת מחדל מוצעת: `en` בלבד, כמו המצב הקיים.)
