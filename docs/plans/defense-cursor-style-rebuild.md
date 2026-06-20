# תכנית: שינוי עיצובי של `/defense` (דף הבית) בהמשך לעיצוב `/capabilities`

מסמך תכנון. **לא בוצע עדיין שום שינוי קוד.** מטרת המסמך: לקחת את שפת העיצוב
שכבר נבנתה בעמוד [`/capabilities`](../../frontend/src/components/auth/WhatGhostCanDoPage.tsx)
(סגנון `cursor.com/product` בתרגום מונוכרומטי ל-Ghost — ראו
[`capabilities-cursor-style-rebuild.md`](./capabilities-cursor-style-rebuild.md))
ולהחיל אותה על **דף הבית** —
[`DefenseIntelligencePage.tsx`](../../frontend/src/components/auth/DefenseIntelligencePage.tsx)
(העמוד שמתחיל ב-"Your cameras see everything. Now question them.", מוצג כש-`screen === "defense"`).

המטרה: שדף הבית ירגיש **המשך טבעי ורציף** של `/capabilities` — אותה טיפוגרפיה,
אותו מקצב סקשנים, אותו ambient, אותם כרטיסים — מבלי לאבד את הזהות הביטחונית/טקטית
ואת כל התוכן הקיים.

מקורות:
- DNA ויזואלי: ה-helpers שכבר נוצרו ב-`index.css` (`.ghost-display`, `.ghost-link-arrow`) והקומפוננטות תחת `components/capabilities/`.
- מצב קיים: `DefenseIntelligencePage.tsx` (כ-2000 שורות, 11 סקשנים).

---

## 1. שפת הסגנון של `/capabilities` (מה שכבר קיים) → מה להחיל על `/defense`

| מאפיין | מה נקבע ב-`/capabilities` | מצב נוכחי ב-`/defense` | פעולה |
| --- | --- | --- | --- |
| כותרות גדולות | `.ghost-display` — `font-weight 400`, `letter-spacing -0.03em`, `line-height 1.02` | `font-semibold tracking-[-0.025em]` / `-0.035em` (משקל **bold**) | **לעבור ל-`.ghost-display`** בכל ה-H1/H2 — זה השינוי הכי משמעותי שיוצר את הרציפות. |
| כותרת-פרק (kicker) | mono uppercase מעל הכותרת, בלי קו: `01 // Talk` | `SectionLabel` = kicker + **קו אופקי** (`flex-1 h-px`) | להחליף ל-kicker בסגנון הפרקים (mono uppercase מעל כותרת `.ghost-display`, ללא קו). ראו החלטה #2. |
| accent | monochrome מלא; `ghost-accent` (לבן/שחור) ל-CTA; `.ghost-link-arrow` לקישורים | משתמש ב-`ghost-accent` (מונוכרום ✓) אבל גם ב-**`emerald-400`** (נקודת pulse בכרטיסי engine) ובכל ה-ambient הצבעוני | להסיר accenti צבע זרים (emerald). לאמץ `.ghost-link-arrow` לקישורי "פתח/עוד". ראו החלטה #1. |
| מקצב אנכי | סקשנים full-bleed, container `max-w-6xl`, `py-20/24`, **רקעים מתחלפים** `bg-ghost-bg` ↔ `bg-ghost-bg-secondary` | container אחיד `max-w-5xl`, `space-y-16/24`, **בלי** רקעים מתחלפים | לעבור ל-full-bleed עם `max-w-6xl`, רווחי `py-24`, ולסירוגין רקע משני להפרדת פרקים. ראו החלטה #3. |
| ambient | `ghost-ambient ghost-ambient--page` בצבעי ברירת-מחדל ניטרליים (מונוכרום) | `ghost-ambient` עם blobs **צבעוניים** (`HUE.steel/olive/petrol/charcoal/khaki`) — wash טקטי עשן | להחליט: מונוכרום מלא (רציפות) מול שמירת tint טקטי דק. ראו החלטה #4 (פיבוטלי). |
| כרטיסים | נקיים: `rounded-2xl border-ghost-border-subtle bg-ghost-surface/20`, hover-lift עדין | מעורבב: `EngineCard` viewfinder טקטי (טקסט `white/40`, emerald, scan-beam, tilt 3D) + כרטיסים נקיים | לאחד את גריד הכרטיסים החוזרים לסגנון הנקי; לשמר showpiece טקטי אחד בלבד. ראו החלטה #5. |
| דמו hero | קומפוזיציה חופפת: `DemoFrame` ראשי + frame מצלמה צף ב-`ghost-glass` מעל `ghost-ambient` | `LiveAppWindow` בודד (חלון מוצר חי, עשיר) ממורכז | לשמר את `LiveAppWindow` (נכס חזק), לעטוף ב-`ghost-glass`, ולשקול frame משני צף לרציפות. ראו החלטה #6. |

---

## 2. מצב קיים מול יעד (מבט-על)

**קיים** (`DefenseIntelligencePage.tsx`) — 11 סקשנים בתוך `<main className="max-w-5xl">`:
1. Hero (kicker pill + H1 דו-שורתי bold + subtitle + 2 CTA + trust chips) + `LiveAppWindow`.
2. Technology — תמונה + H2 + 4× `EngineCard` (viewfinder טקטי).
3. The Gap — H2 + פסקה.
4. Doctrine — 3 כרטיסי שכבות.
5. Capabilities — 6 כרטיסים.
6. Watch — H2 + `WatchDefineCard` + `AlertCard` + legend.
7. Data Flow / Pipeline — 4 שלבים ב-`ghost-glass`.
8. Deployment — 5 כרטיסים.
9. Compliance — 4 שורות.
10. Built For — chips.
11. Use Cases by sector — 9 כרטיסי sector + CTA.
12. In Practice — רשימת prompts ב-`ghost-glass`.
13. CTA סופי "Request operational access" + footer classification.

**יעד** (המשך של `/capabilities`):
- אותו hero קולנועי אבל בטיפוגרפיית `.ghost-display`, עם דמו עטוף `ghost-glass`.
- כל הכותרות ב-`.ghost-display`; כל ה-kickers בסגנון הפרקים (mono מעל כותרת).
- מקצב פרקים עם רקעים מתחלפים שמפריד בין "קבוצות נושא" (כמו 4 הפרקים ב-capabilities).
- כרטיסים נקיים ואחידים; פלטת ambient מונוכרומטית (או tint דק מאוד) — לפי החלטה #4.
- **כל התוכן והסקשנים נשמרים** — זה refactor עיצובי, לא חיתוך תוכן.

---

## 3. שינויים ב-Design System

### 3.1 `frontend/src/index.css`
- **אין צורך ב-tokens/utilities חדשים** — `.ghost-display` ו-`.ghost-link-arrow` כבר קיימים (נוספו במסגרת `/capabilities`).
- אם נבחר tint טקטי דק (החלטה #4, אופציה B): להוסיף וריאנט `ghost-ambient--tactical` עם blobs בעוצמה/רוויה נמוכה מאוד, במקום ה-HUE הנוכחי החזק. אחרת — להסיר את ה-blobs הצבעוניים ולהשתמש ב-`ghost-ambient--page` כברירת מחדל (כמו ב-hero של capabilities).

### 3.2 `frontend/tailwind.config.js`
- אין שינוי. הכל מבוסס tokens קיימים (`bg-ghost-bg`, `bg-ghost-bg-secondary`, `ghost-surface`, `ghost-border-subtle`, `ghost-accent`).

> חוקי מותג נאכפים: monochrome מלא (אין emerald/HUE צבעוני זר), אייקון Ghost ללא מעטפת (כבר תקין ב-`MockSidebar` עם `object-contain rounded`), העמוד נשאר `en`/`ltr` כפי שמקובע, אין מונחי "video analytics"/דוגמאות גנריות (ה-copy הקיים כבר עומד ב-`ghost-manifesto`).

---

## 4. החלת הטיפוגרפיה — מעבר ל-`.ghost-display` (השינוי המרכזי)

זהו ה"לב" של הרציפות. בכל מופע של כותרת גדולה:

- **H1 (hero):** מ-`text-[clamp(1.75rem,7vw,3.25rem)] font-semibold tracking-[-0.035em]`
  → `ghost-display text-[clamp(2.5rem,6vw,4.5rem)]` (תואם ל-H1 של capabilities). שתי השורות
  ("Your cameras see everything." / "Now question them.") נשמרות, השנייה ב-`text-ghost-text-muted`.
- **H2 של סקשנים:** מ-`text-[clamp(1.375rem,4.5vw,2rem)] font-semibold tracking-[-0.025em]`
  → `ghost-display text-[clamp(1.75rem,3.4vw,2.5rem)]` (תואם לכותרת-פרק של `ChapterSection`).
- **H3 בכרטיסים:** משאירים `font-medium`/`font-semibold` קטן (תואם ל-`FeatureBlock` שמשתמש ב-`font-medium text-[18px]`). ליישר ל-`text-[18px] font-medium tracking-[-0.01em]`.
- **CTA סופי:** H2 הגדול בסגנון "Try Ghost now" — `ghost-display text-[clamp(2.25rem,5vw,3.75rem)]`.

> תוצאה: כל הכותרות עוברות ממשקל bold דחוס למשקל regular עם tracking שלילי הדוק — בדיוק החתימה של `/capabilities`.

---

## 5. אחידות kickers וסקשנים

- **kicker:** להחליף את `SectionLabel` (kicker + קו) בבלוק בסגנון `ChapterSection`:
  ```
  <div className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
    Technology // The Engine Behind Ghost
  </div>
  <h2 className="ghost-display mt-4 ...">…</h2>
  ```
  (אפשר להוסיף מספור `01 //` … `09 //` לסקשנים כדי לחזק את אפקט ה"פרקים").
- **מקצב רקעים:** לעטוף סקשנים נבחרים ב-full-bleed עם רקע משני, כדי ליצור הפרדת "פרקים"
  כמו ב-capabilities (Highlights/TrustedBy/Changelog התחלפו ב-`bg-ghost-bg-secondary`).
  הצעה: רקע משני ל-Doctrine, Data Flow, Compliance (סקשנים "מבניים"), רקע ראשי לשאר.
- **רוחב container:** `max-w-5xl` → `max-w-6xl` ליישור עם capabilities.

---

## 6. Hero חדש (`/defense`)

- H1 ב-`.ghost-display` (clamp גדול), שתי שורות, שורה שנייה `text-ghost-text-muted`.
- תת-כותרת ב-`text-ghost-text-secondary max-w-2xl`.
- שני CTA — נשמרים: "Request access" (ראשי, `bg-ghost-accent`) + "View the architecture" (משני, `ghost-glass`). אפשר ליישר את המשני ל-`ghost-glass` (כמו hero של capabilities) במקום `border + bg-surface`.
- trust chips (`Agentless` וכו') — נשמרים, אולי מתחת ל-CTA כמו עכשיו.
- **דמו:** `LiveAppWindow` נשמר כמרכזי, אבל נעטף ב-`ghost-glass` ויונח מעל `ghost-ambient ghost-ambient--page` (כמו ה-hero של capabilities). אופציונלי: frame מצלמה משני צף בפינה (כמו `CapabilitiesHero`) — אבל ל-`LiveAppWindow` כבר יש `CameraViewport` פנימי, אז ייתכן שעדיף לוותר כדי לא להעמיס. ראו החלטה #6.
- שמירה על "ghost portal" transition (`goHome`) — לא קשור לעיצוב, נשאר.

---

## 7. החלטה מרכזית: ambient — מונוכרום מול tint טקטי

זו ההחלטה הכי משפיעה על "רציפות מול זהות":

- **אופציה A — מונוכרום מלא (רציפות מקסימלית):** להסיר את כל ה-`HUE`/`BAND`/`PAGE_BLOBS` הצבעוניים
  ולהשתמש ב-`ghost-ambient ghost-ambient--page` בצבעי ברירת מחדל ניטרליים, **בדיוק כמו ב-`/capabilities`**. הכי רציף; מאבד מעט מהאופי הטקטי-עשן.
- **אופציה B — tint טקטי דק:** לשמר wash טקטי אבל בעוצמה/רוויה **נמוכה בהרבה** (וריאנט חדש `ghost-ambient--tactical`), כך שמרגיש כמו "אותה משפחה" עם נופך ביטחוני. פשרה.
- **המלצה:** מכיוון שהבקשה היא "המשך טבעי של `/capabilities`" → **אופציה A** (מונוכרום), עם אפשרות להשאיר blob בודד דק מאוד ב-hero בלבד.

---

## 8. כרטיסים — אחידות מול showpiece טקטי

- **גרידים חוזרים** (Doctrine, Capabilities, Deployment, Watch-legend): לאחד לסגנון הכרטיס הנקי של capabilities
  (`rounded-2xl border-ghost-border-subtle bg-ghost-surface/20`, hover-lift עדין, אייקון בריבוע `rounded-lg border`).
  להסיר `group-hover:text-ghost-accent` אם רוצים מונוכרום שקט (ghost-accent מונוכרום, אז זה לגיטימי — החלטת טעם).
- **`EngineCard` (viewfinder טקטי):** הכי "רועש" ושונה מ-capabilities (טקסט `white/40`, emerald pulse, scan-beam, tilt 3D). אפשרויות:
  - להמיר לכרטיס הנקי (רציפות מלאה), **או**
  - לשמר אותו כ-**showpiece בודד** (למשל רק בסקשן Technology) ולנקות את שאר הגרידים — נותן רגע "וואו" טקטי אחד מבלי לשבור את המקצב.
  - בכל מקרה: להחליף `emerald-400` בנקודת status מונוכרומטית (`bg-ghost-text-muted`) או ב-`ghost-alert-dot`.
- **כרטיסי Use-Cases / Watch / Alert / CameraViewport:** אלה תלויי-תוכן (תמונות CCTV, REC). נשמרים פונקציונלית; רק הטיפוגרפיה והמסגרת מיושרות.

---

## 9. מיפוי פעולות מפורט לפי סקשן

| # | סקשן | שינוי עיקרי |
| --- | --- | --- |
| 1 | Hero | H1→`.ghost-display` clamp גדול; דמו ב-`ghost-glass` מעל `ghost-ambient--page`; CTA משני→`ghost-glass`. |
| 2 | Technology | kicker חדש; H2→`.ghost-display`; `EngineCard`→showpiece או כרטיס נקי (החלטה #5); הסרת emerald. |
| 3 | The Gap | kicker חדש; H2→`.ghost-display`. |
| 4 | Doctrine | kicker חדש; כרטיסים→סגנון נקי; אופציונלי רקע משני full-bleed. |
| 5 | Capabilities | kicker חדש; כרטיסים→סגנון נקי. |
| 6 | Watch | kicker; H2→`.ghost-display`; `WatchDefineCard`/`AlertCard` — יישור מסגרת/טיפוגרפיה בלבד. |
| 7 | Data Flow | kicker; H2→`.ghost-display`; ה-`ghost-glass` כבר תואם; אופציונלי רקע משני. |
| 8 | Deployment | kicker; כרטיסים→סגנון נקי. |
| 9 | Compliance | kicker; שורות נשמרות; הסרת `group-hover:text-ghost-accent` אם בוחרים מונוכרום שקט; אופציונלי רקע משני. |
| 10 | Built For | kicker; chips נשמרים. |
| 11 | Use Cases | kicker; H2→`.ghost-display`; כרטיסי sector נשמרים (תלויי-תמונה); CTA→`.ghost-link-arrow`/`ghost-glass`. |
| 12 | In Practice | kicker; `ghost-glass` נשמר. |
| 13 | CTA סופי | H2→`.ghost-display` גדול (סגנון "Try Ghost now"); CTA נשמר. footer classification נשמר. |

---

## 10. שיתוף קוד עם `/capabilities` (הימנעות מכפילות)

- `Reveal` ו-`SectionLabel` כבר מופיעים גם ב-`/capabilities` (ב-`components/capabilities/shared.tsx`) וגם
  כעותקים פנימיים ב-`DefenseIntelligencePage`. **הזדמנות:** לייבא את `Reveal` מ-`shared.tsx`
  ולמחוק את ההעתק המקומי (פחות קוד, התנהגות זהה).
- אם נחליט על kicker אחיד — אפשר לחלץ `ChapterHeading` (kicker + `.ghost-display` H2) ל-`shared.tsx`
  ולהשתמש בו בשני העמודים.
- **סייג:** `DefenseIntelligencePage` ענק; כדי לצמצם סיכון, השינוי יתבצע **in-place** (אותו קובץ),
  בלי פיצול דרמטי לקבצים — רק החלפות טיפוגרפיה/kicker/wrapper. פיצול קומפוננטות הוא אופציונלי ובסיכון גבוה יותר.

---

## 11. רספונסיביות, RTL, לוקליזציה
- העמוד מקובע `en`/`ltr` (`dir="ltr"`) — נשמר.
- כל ה-`clamp` כבר רספונסיביים; מעבר ל-clamp של capabilities שומר על רספונסיביות.
- שמירה על `ps-/pe-` (logical properties) כפי שנהוג.
- breakpoints של הגרידים נשמרים (`sm/lg`).

## 12. אנימציות
- `Reveal` (IntersectionObserver fade-up) נשמר — מכבד `prefers-reduced-motion`.
- `animate-splash-in` ב-hero — נשמר (אפשר ליישר ל-`Reveal` כמו ב-capabilities, אבל לא חובה).
- `ghost-portal` transition — נשמר.
- אם מסירים `EngineCard`: גם ה-tilt/scan-beam יורדים (פחות "רעש" — תואם לשקט של capabilities).

---

## 13. שלבי ביצוע + הערכת זמן

| שלב | תיאור | סיכון |
| --- | --- | --- |
| 0 | אישור החלטות פתוחות (סעיף 15) | — |
| 1 | טיפוגרפיה: כל ה-H1/H2/H3 → `.ghost-display` + clamp תואם | נמוך |
| 2 | kickers: החלפת `SectionLabel` לכותרת-פרק (mono מעל כותרת) | נמוך |
| 3 | מקצב: `max-w-6xl`, `py-24`, רקעים מתחלפים full-bleed לסקשנים נבחרים | בינוני |
| 4 | ambient: מעבר למונוכרום (`ghost-ambient--page`) או tint דק | בינוני |
| 5 | כרטיסים: איחוד גרידים לסגנון נקי; טיפול ב-`EngineCard`/emerald | בינוני |
| 6 | Hero: דמו ב-`ghost-glass`, CTA משני, (אופציונלי) frame צף | בינוני |
| 7 | ניקוי: ייבוא `Reveal` מ-`shared.tsx`, מחיקת כפילות | נמוך |
| 8 | QA: `tsc` + `npm run build` + בדיקה ויזואלית dark/light, 1440/768/390 | — |

עלות בן-אדם משוערת: ~4–7 שעות. בסוכן: משמעותית פחות.

## 14. QA / קריטריוני קבלה
- `tsc --noEmit` + `npm run build` עוברים.
- כל הכותרות ב-`.ghost-display` (regular weight, tracking הדוק) — נראה כמו אותה משפחה כמו `/capabilities`.
- אין צבע זר (emerald/HUE) אם נבחר מונוכרום; כל ה-CTA ב-`ghost-accent` המונוכרומטי.
- כל 11 הסקשנים + כל התוכן נשמרים ופועלים (כולל `LiveAppWindow`, `AlertCard`, use-cases, footer).
- נראה תקין ב-dark וב-light, ב-3 רוחבי מסך; `ghost-ambient` ללא תפרים מרובעים; אייקון Ghost ללא מעטפת.
- מעבר חלק ויזואלי בין `/defense` ל-`/capabilities` (אותה טיפוגרפיה, מקצב, ambient).

## 15. החלטות פתוחות (לאישור לפני ביצוע)

1. **Accent:** מונוכרום מלא (להסיר emerald, להשאיר `ghost-accent` בלבד) — **מומלץ**. ✅/❌
2. **kicker:** לעבור לסגנון כותרת-פרק (mono מעל כותרת, בלי קו) — **מומלץ**. אופציונלי להוסיף מספור `01 //`…`09 //`.
3. **מקצב סקשנים:** `max-w-6xl` + רקעים מתחלפים (`bg-ghost-bg-secondary`) להפרדת פרקים — **מומלץ**.
4. **ambient (פיבוטלי):** A) מונוכרום מלא כמו capabilities **(מומלץ לרציפות)** מול B) tint טקטי דק.
5. **כרטיסי `EngineCard`:** A) להמיר לכרטיס נקי (רציפות מלאה) מול B) לשמר כ-showpiece בודד טקטי בסקשן Technology.
6. **דמו hero:** A) `LiveAppWindow` בלבד ב-`ghost-glass` **(מומלץ)** מול B) להוסיף frame מצלמה משני צף.

> **סטטוס: אושר ובוצע.** ההחלטות שננעלו: (1) monochrome מלא — הוסר emerald; (4) ambient
> מונוכרומטי כמו capabilities (dot-grid ב-hero + רקעי סקשנים מתחלפים); (5) `EngineCard` הומר
> לכרטיס נקי. בנוסף: כל הכותרות → `.ghost-display`, kickers בסגנון פרק, `max-w-6xl`, CTA משני → `ghost-glass`.
