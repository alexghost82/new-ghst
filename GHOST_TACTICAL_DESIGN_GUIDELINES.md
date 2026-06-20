# GHOST — Tactical Design Guidelines (קו עיצוב מבצעי-צבאי)

> מסמך הנחיות עצמאי למסירה לסוכן בפרויקט חדש (סביבת תוכנה נפרדת).
> המטרה: לבנות תוכנה חדשה **בדיוק בקו העיצובי של Ghost** ("אתה מותג" + שאר עמודי הפרויקט),
> אך מכוּונת **טקטית בלבד — לשימוש מבצעי צבאי בסביבת לחימה**.
>
> כל הערכים כאן נלקחו ישירות מהמוצר המרונדר של Ghost. **אין צורך לגשת לפרויקט המקור** — הכול מוכן-להעתקה כאן.
> שפת הקוד/הטוקנים/התוויות נשארת אנגלית. שפת ה-UI לאופרטור: עברית RTL כברירת מחדל (ראה §7).

---

## 0. איך משתמשים בקובץ הזה

1. הזרק את **§4 (Tailwind config)** ו-**§5 (CSS variables)** כבסיס הפרויקט — אלה מקור האמת לצבע/פונט/מידות.
2. בנה כל קומפוננטה דרך הטוקנים בלבד (`ghost-*`). **לעולם לא** hex קשיח ל-UI.
3. הצמד את אייקון Ghost שסופק (`ghost-icon.png`) לפי §9 — עירום, עם `invert` ב-dark.
4. לפני מסירת כל שינוי — עבור על הצ'קליסט ב-§11.
5. זה פרויקט **מבצעי בלבד** (אין אתר תדמית/שיווק). לכן השתמש בעיקר בקו ה"קונסול התפעולי" של Ghost, עם ההתאמות הטקטיות ב-§3.

---

## 1. ה-DNA בשני משפטים

Ghost הוא **ממשק ChatGPT-style מונוכרומי** (שחור-אפור-לבן, טוקני `ghost-*`) עם שכבת **"tactical intel brief"**:
תוויות מונו אופרקייס באנגלית (`Ghost // Console`, `LIVE SIGNAL`), רקעי אווירה מעושנים (steel/olive/petrol),
זכוכית מעושנת, וגבולות עדינים. **צבע הוא פונקציונלי בלבד**: lime (`ghost-success`) ל-live/מחובר/הושלם,
red (`ghost-error`) להתראות/alert/שגיאות/שניות בשעון. שום צבע דקורטיבי.

---

## 2. עשרת חוקי הזהב

1. **מונוכרום קודם.** רקעים, טקסט, גבולות וכפתורי CTA ראשיים — תמיד מסקאלת האפורים. ה-accent הוא לבן ב-dark ושחור ב-light (`bg-ghost-accent text-ghost-bg`).
2. **צבע = משמעות מבצעית.** `ghost-success` (lime) רק ל-live/מחובר/הושלם; `ghost-error` (red) רק להתראות/alert mode/שגיאות/שניות השעון. אסור צבע דקורטיבי.
3. **תמיד דרך טוקנים.** אין hex קשיח לרכיבי UI — רק `ghost-bg`, `ghost-surface`, `ghost-text-primary/secondary/muted`, `ghost-border-subtle` וכו'. (חריג מותר: `#0a0a0a` למשטחים כפויי-dark.)
4. **תווית מונו אופרקייס = חתימת המותג.** `font-mono text-[9px]–[11px] tracking-[0.16em]–[0.28em] uppercase text-ghost-text-muted`, אנגלית, בפורמט `Ghost // X` או `LABEL · LABEL`.
5. **כותרות display:** `font-weight: 400`, `letter-spacing: -0.03em`, `line-height: ~1.02`, גודל `clamp()`. שורת המשך ב-`text-ghost-text-muted`.
6. **גבולות עדינים, משטחים שקופים.** `border border-ghost-border-subtle` (לעיתים `/60`), `bg-ghost-surface/20–/60`. רדיוסים: `rounded-xl`/`rounded-2xl` לכרטיסים, `rounded-full` ל-pills/CTA.
7. **תנועה עדינה וקצרה.** reveal עם `cubic-bezier(0.16,1,0.3,1)` ~600ms; hover `-translate-y-0.5`; מעברי theme 200ms. בלי bounce, בלי אנימציות צעקניות. **כבד `prefers-reduced-motion`.**
8. **תמונות/וידאו = VISINT.** פריימים מתחילים grayscale קר ועוברים לצבע ב-hover (~320ms), עם watermark Ghost ו-badge מונו.
9. **שפה לפי תפקיד.** UI לאופרטור: עברית RTL (Heebo). תוויות מונו טקטיות, timestamps, קואורדינטות, שמות מצלמות, קוד — תמיד אנגלית `dir="ltr"`.
10. **אייקון Ghost עירום.** הטייל המעוגל כפי שהוא, `object-contain`, `invert` ב-dark. בלי מסגרת/רקע/ring/חיתוך מחדש.

---

## 3. התאמות טקטיות לסביבת לחימה (החלק הקריטי לפרויקט הזה)

הקו של Ghost כבר "טקטי" באופיו — מונוכרום, יבש, מודיעיני. בפרויקט מבצעי-צבאי **מחזקים** את העקרונות הבאים:

- **Dark הוא ברירת המחדל ובדרך-כלל היחיד.** סביבת לחימה / חדר בקרה / שטח לילה. אם אין צורך אמיתי ב-light mode — אל תבנה אותו. השתמש ב-`.ghost-force-dark` כדי לנעול dark על כל ה-subtree.
- **חתימה ויזואלית נמוכה.** אסור glow צבעוני, אסור משטחים בהירים גדולים, אסור אפקטים מבזיקים. מסך כהה, ניגודיות מבוקרת, בלי "לזרוח" בחושך.
- **Glanceability — קריאוּת במבט חטוף.** סטטוס קריטי חייב להיקרא ב-0.5 שניות: dot צבע (lime/red) + תווית מונו קצרה. אסור להסתיר סטטוס מבצעי מאחורי טקסט ארוך.
- **צבע פונקציונלי בלבד, בקפדנות מוחלטת.** lime = מערכת חיה/מחוברת/משימה תקינה. red = איום/alert/כשל/חריגה. **שום שימוש אחר.** אופרטור חייב לסמוך על כך שאדום פירושו "שים לב עכשיו".
- **אישור אנושי לכל פעולה מבצעית.** כל פעולה בעלת השלכה (סימון איום, שיגור התראה, שינוי מצב) דורשת אישור מפורש — אסור one-click שקט לפעולה קריטית.
- **`prefers-reduced-motion` הוא חובה, לא רשות.** בשטח, תנועה מסיחה. כל אנימציה דקורטיבית חייבת להיכבות תחת reduced-motion (ראה הדוגמאות ב-§7).
- **טקסט תכליתי, יבש, מבצעי.** משפטים קצרים. בלי סימני קריאה, בלי אימוג'ים, בלי buzzwords, בלי שיווק. תוויות מצב באנגלית מונו; הסברים לאופרטור בעברית RTL קצרה.
- **קונטקסט מבצעי בלבד בכל קופי/דוגמה.** הקשר תמיד: ביטחון, בטיחות, תפעול, חירום. לא "אדם/רכב" כסובייקט יבש — אלא מצב מבצעי בעל משמעות.
- **אזורי סיכון מובחנים.** הפרד ויזואלית בין מצב תצוגה רגיל לבין מצב alert/חירום: ב-alert mode מותר לצבוע אלמנטי סטטוס ב-`ghost-error`, אך הרקע נשאר כהה ומאופק.

---

## 4. Tailwind config (העתק-הדבק)

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: { xs: "475px" },
      colors: {
        ghost: {
          bg: "rgb(var(--ghost-bg) / <alpha-value>)",
          "bg-secondary": "rgb(var(--ghost-bg-secondary) / <alpha-value>)",
          sidebar: "rgb(var(--ghost-sidebar) / <alpha-value>)",
          surface: "rgb(var(--ghost-surface) / <alpha-value>)",
          "surface-hover": "rgb(var(--ghost-surface-hover) / <alpha-value>)",
          "text-primary": "rgb(var(--ghost-text-primary) / <alpha-value>)",
          "text-secondary": "rgb(var(--ghost-text-secondary) / <alpha-value>)",
          "text-muted": "rgb(var(--ghost-text-muted) / <alpha-value>)",
          "border-subtle": "rgb(var(--ghost-border-subtle) / <alpha-value>)",
          accent: "rgb(var(--ghost-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--ghost-accent-hover) / <alpha-value>)",
          bronze: "rgb(var(--ghost-bronze) / <alpha-value>)",
          error: "rgb(var(--ghost-error) / <alpha-value>)",
          success: "rgb(var(--ghost-success) / <alpha-value>)",
        },
      },
      width: { sidebar: "260px", panel: "320px" },
      maxWidth: { chat: "768px" },
      fontSize: {
        body: ["16px", { lineHeight: "1.75" }],
        small: ["14px", { lineHeight: "1.5" }],
        title: ["16px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      fontFamily: {
        sans: ['ui-sans-serif','-apple-system','BlinkMacSystemFont','"Segoe UI"','Roboto','"Helvetica Neue"','Arial','"Apple Color Emoji"','sans-serif'],
        mono: ['"IBM Plex Mono"','ui-monospace','"Cascadia Code"','Menlo','Consolas','monospace'],
        he:   ['"Heebo"','"Assistant"','ui-sans-serif','-apple-system','BlinkMacSystemFont','"Segoe UI"','Arial','sans-serif'],
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s infinite ease-in-out both",
        "splash-in": "splashIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 80%, 100%": { transform: "scale(0.4)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
```

---

## 5. CSS variables — base layer (העתק-הדבק)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --ghost-bg: 33 33 33;
    --ghost-bg-secondary: 24 24 24;
    --ghost-sidebar: 23 23 23;
    --ghost-surface: 47 47 47;
    --ghost-surface-hover: 58 58 58;
    --ghost-text-primary: 236 236 236;
    --ghost-text-secondary: 180 180 180;
    --ghost-text-muted: 118 118 118;
    --ghost-border-subtle: 58 58 58;
    --ghost-accent: 236 236 236;
    --ghost-accent-hover: 255 255 255;
    --ghost-bronze: 180 180 180;
    --ghost-error: 239 68 68;     /* red  — alert / threat / failure only */
    --ghost-success: 163 230 53;  /* lime — live / connected / nominal only */

    --ghost-heading-alt: #f5f5f5;
    --ghost-text-strong: #ffffff;
    --ghost-text-em: #d4d4d4;
    --ghost-code-bg: #1e1e1e;
    --ghost-scrollbar-thumb: #3a3a3a;
    --ghost-scrollbar-hover: #4a4a4a;
  }

  /* Lock the dark palette on a subtree regardless of theme (default for a
     combat-environment build). */
  .ghost-force-dark {
    --ghost-bg: 33 33 33;
    --ghost-bg-secondary: 24 24 24;
    --ghost-sidebar: 23 23 23;
    --ghost-surface: 47 47 47;
    --ghost-surface-hover: 58 58 58;
    --ghost-text-primary: 236 236 236;
    --ghost-text-secondary: 180 180 180;
    --ghost-text-muted: 118 118 118;
    --ghost-border-subtle: 58 58 58;
    --ghost-accent: 236 236 236;
    --ghost-accent-hover: 255 255 255;
    --ghost-bronze: 180 180 180;
    --ghost-error: 239 68 68;
    --ghost-success: 163 230 53;
  }

  /* Optional — only if you actually need a light mode. Usually omit in a
     tactical build. */
  html[data-theme="light"] {
    --ghost-bg: 255 255 255;
    --ghost-bg-secondary: 249 249 249;
    --ghost-sidebar: 249 249 249;
    --ghost-surface: 244 244 244;
    --ghost-surface-hover: 236 236 236;
    --ghost-text-primary: 13 13 13;
    --ghost-text-secondary: 110 110 110;
    --ghost-text-muted: 155 155 155;
    --ghost-border-subtle: 229 229 229;
    --ghost-accent: 13 13 13;
    --ghost-accent-hover: 0 0 0;
    --ghost-bronze: 110 110 110;
    --ghost-error: 220 38 38;
    --ghost-success: 101 163 13;
  }

  html[data-theme="dark"] .ghost-brand-icon { filter: invert(1); }

  body {
    margin: 0;
    background: rgb(var(--ghost-bg));
    color: rgb(var(--ghost-text-primary));
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
      Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background-color 200ms ease, color 200ms ease;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--ghost-scrollbar-thumb); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--ghost-scrollbar-hover); }
  * { scrollbar-width: thin; scrollbar-color: var(--ghost-scrollbar-thumb) transparent; }
}
```

### פלטה מהירה (dark = ברירת מחדל)

| Token | Dark | Light |
|---|---|---|
| `ghost-bg` | #212121 | #ffffff |
| `ghost-bg-secondary` | #181818 | #f9f9f9 |
| `ghost-sidebar` | #171717 | #f9f9f9 |
| `ghost-surface` | #2f2f2f | #f4f4f4 |
| `ghost-text-primary` | #ececec | #0d0d0d |
| `ghost-text-secondary` | rgb(180 180 180) | rgb(110 110 110) |
| `ghost-text-muted` | rgb(118 118 118) | rgb(155 155 155) |
| `ghost-border-subtle` | rgb(58 58 58) | rgb(229 229 229) |
| `ghost-accent` | #ececec | #0d0d0d |
| `ghost-error` (red) | rgb(239 68 68) | rgb(220 38 38) |
| `ghost-success` (lime) | rgb(163 230 53) | rgb(101 163 13) |

**Blobs אמביינט (לא צבעי accent — רק אווירה):** steel `rgb(96 116 132)`, olive `rgb(104 116 78)`, petrol `rgb(56 92 96)`, charcoal `rgb(58 66 70)`, khaki `rgb(120 106 72)` — תמיד `blur` ענק + שקיפות נמוכה + `mix-blend-mode: screen`.

---

## 6. טיפוגרפיה

| Class | Stack | שימוש |
|---|---|---|
| `font-sans` | ui-sans-serif, -apple-system, Segoe UI, Roboto… | ברירת מחדל לכל הטקסט |
| `font-mono` | "IBM Plex Mono", Cascadia, Menlo, Consolas | תוויות חתימה, קוד, שעון, קואורדינטות |
| `font-he` | "Heebo", "Assistant" | UI עברי לאופרטור |

- **Body:** 16px, line-height 1.6, antialiased.
- **Display (כותרות):** `font-weight: 400`, `letter-spacing: -0.03em`, `line-height: ~1.02`, גודל `clamp(2.5rem,6vw,4.5rem)` עד `clamp(1.75rem,3.4vw,2.5rem)`. שורת המשך ב-`text-ghost-text-muted`. ב-RTL מבטלים tracking שלילי ועוברים ל-Heebo.
- **כותרות משנה:** `text-[15.5px]–[28px] font-medium/semibold tracking-[-0.01em]`–`[-0.03em]`.

### תווית מונו אופרקייס (חתימת המותג — השתמש בכל מקום שמסמן סטטוס/אזור)

```
font-mono text-[9px]–[11px] tracking-[0.16em]–[0.28em] uppercase text-ghost-text-muted
```

דוגמאות: `Ghost // Console`, `Ghost // Session`, `LIVE SIGNAL`, `IDENTITY PROTECTED`, `01 // …`.
Eyebrow + hairline: `font-mono text-[11px] tracking-[0.24em] uppercase` + `flex-1 h-px bg-ghost-border-subtle`.

---

## 7. רכיבי חתימה — CSS מוכן-להעתקה

### 7.1 תווית מונו (React snippet)

```tsx
<span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted" dir="ltr">
  Ghost // Console
</span>
```

### 7.2 רקע אווירה — `ghost-ambient` (blobs נודדים + dot-grid)

```css
.ghost-ambient {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
  -webkit-mask-image: radial-gradient(100% 100% at 50% 45%, #000 28%, transparent 82%);
  mask-image: radial-gradient(100% 100% at 50% 45%, #000 28%, transparent 82%);
}
.ghost-ambient__grid {
  position: absolute; inset: 0;
  background-image: radial-gradient(rgb(var(--ghost-text-muted) / 0.18) 1px, transparent 1px);
  background-size: 30px 30px;
  -webkit-mask-image: radial-gradient(120% 78% at 50% 0%, #000 0%, transparent 72%);
  mask-image: radial-gradient(120% 78% at 50% 0%, #000 0%, transparent 72%);
  opacity: 0.55;
}
.ghost-ambient__blob {
  position: absolute; border-radius: 9999px;
  filter: blur(96px); opacity: 0.55; mix-blend-mode: screen; will-change: transform;
}
@keyframes ghostAmbientDrift1 { 0%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(40px,30px,0) scale(1.12)} 100%{transform:translate3d(0,0,0) scale(1)} }
@keyframes ghostAmbientDrift2 { 0%{transform:translate3d(0,0,0) scale(1.05)} 50%{transform:translate3d(-46px,24px,0) scale(0.9)} 100%{transform:translate3d(0,0,0) scale(1.05)} }
@keyframes ghostAmbientDrift3 { 0%{transform:translate3d(0,0,0) scale(0.95)} 50%{transform:translate3d(28px,-34px,0) scale(1.16)} 100%{transform:translate3d(0,0,0) scale(0.95)} }
.ghost-ambient__blob--1 { animation: ghostAmbientDrift1 22s ease-in-out infinite; }
.ghost-ambient__blob--2 { animation: ghostAmbientDrift2 27s ease-in-out infinite; }
.ghost-ambient__blob--3 { animation: ghostAmbientDrift3 31s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ghost-ambient__blob { animation: none !important; } }
```

שימוש: blob אחד `background: rgb(96 116 132)` (steel), שני olive, שלישי petrol — כולם בשקיפות נמוכה.

### 7.3 זכוכית מעושנת — `ghost-glass`

```css
.ghost-glass {
  background: linear-gradient(180deg, rgb(16 18 18 / 0.26), rgb(10 12 12 / 0.38));
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    inset 0 0 0 1px rgb(255 255 255 / 0.015),
    0 18px 50px -28px rgb(0 0 0 / 0.7);
}
```

### 7.4 כותרת display + קישור-חץ

```css
.ghost-display { font-weight: 400; letter-spacing: -0.03em; line-height: 1.02; }
.ghost-display:dir(rtl) { letter-spacing: 0; font-family: "Heebo","Assistant",ui-sans-serif,system-ui,sans-serif; }

.ghost-link-arrow {
  display: inline-flex; align-items: center; gap: 0.375rem;
  color: rgb(var(--ghost-text-primary)); font-size: 14px; line-height: 1;
  text-decoration: none; transition: opacity 200ms ease;
}
.ghost-link-arrow > span:first-child { text-underline-offset: 3px; text-decoration: underline transparent; transition: text-decoration-color 200ms ease; }
.ghost-link-arrow:hover > span:first-child { text-decoration-color: currentColor; }
.ghost-link-arrow svg { transition: transform 200ms ease; }
.ghost-link-arrow:hover svg { transform: translateX(2px); }
[dir="rtl"] .ghost-link-arrow svg { transform: scaleX(-1); }
[dir="rtl"] .ghost-link-arrow:hover svg { transform: scaleX(-1) translateX(2px); }
```

### 7.5 פריים VISINT (grayscale קר → צבע ב-hover)

עיקרון: כל פריים מצלמה/וידאו מתחיל `filter: grayscale(1)` עם גוון קר, ועובר ל-`grayscale(0)` ב-hover תוך ~320ms עם `cubic-bezier(0.22,1,0.36,1)`. עליו watermark Ghost ב-`mix-blend-mode: screen` ו-badge מונו עם שם המצלמה.

### 7.6 כפתורים

```tsx
/* CTA ראשי — accent מלא */
<button className="h-12 px-6 rounded-full bg-ghost-accent text-ghost-bg font-medium hover:bg-ghost-accent-hover transition-colors">
  …
</button>

/* CTA משני — זכוכית */
<button className="h-12 px-6 rounded-full ghost-glass text-ghost-text-primary border border-ghost-border-subtle">
  …
</button>
```

---

## 8. Motion — ערכים מדויקים

| אנימציה | פרמטרים |
|---|---|
| Reveal (IntersectionObserver) | opacity/transform 600ms `cubic-bezier(0.16,1,0.3,1)`, y=14px, threshold 0.12 |
| `splash-in` | 1.2s `cubic-bezier(0.16,1,0.3,1)`, scale 0.9→1 |
| `fade-in` | 160ms ease-out, translateY(4px) |
| `pulse-dot` | 1.4s infinite (typing/live dots) |
| Theme transition | background/color 200ms ease |
| Hover כרטיסים | `hover:-translate-y-0.5` |

עיקרון: עקומות `cubic-bezier(0.16,1,0.3,1)` או `(0.22,1,0.36,1)`, משכים קצרים, **בלי bounce**.
**חובה:** עטוף כל אנימציה דקורטיבית ב-`@media (prefers-reduced-motion: reduce) { animation: none !important; }`.

---

## 9. אייקון Ghost (הנכס המצורף)

- שם הנכס: `ghost-icon.png` — טייל מעוגל על רקע בהיר.
- מציגים אותו **עירום** תמיד: `object-contain`, ללא מסגרת/רקע/ring/חיתוך מחדש.
- ב-dark מוסיפים `invert` (כי הקובץ בהיר): הטייל הופך לבן/רוח שחורה והרקע נטמע ברקע הכהה.
- קומפוננטה מומלצת:

```tsx
export default function GhostIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/ghost-icon.png"
      alt="Ghost"
      width={size}
      height={size}
      className={`ghost-brand-icon object-contain ${className}`}
    />
  );
}
```

ה-CSS `html[data-theme="dark"] .ghost-brand-icon { filter: invert(1); }` (כבר ב-§5) דואג להיפוך אוטומטי.
באזור כפוי-dark (כמו מסך login) השתמש ב-`invert` קשיח ישירות במקום להסתמך על ה-theme.

**אסור בהחלט:** `border`, `bg-*`, `ring-*`, `shadow-*`, glow, או `overflow-hidden rounded-full object-cover` סביב האייקון.

---

## 10. אסור / Forbidden

- צבעי מותג חדשים, גרדיאנטים צבעוניים, accent כחול/סגול/כתום/ירוק-דקורטיבי.
- שימוש ב-lime או red לקישוט (רק לסטטוס מבצעי אמיתי).
- פונטים מעבר ל: system sans, IBM Plex Mono, Heebo/Assistant.
- צללים כבדים, glow צבעוני, borders עבים, רדיוסים לא עקביים, אפקטים מבזיקים/צעקניים.
- עטיפת אייקון Ghost במסגרת/רקע/ring, או אי-היפוך ב-dark.
- אנגלית בתוך ה-UI העברי (חוץ מהתוויות המונו החתומות ומונחים טכניים/קואורדינטות).
- אימוג'ים, סימני קריאה, וטון שיווקי/buzzwords בקופי מבצעי.
- כל הצגת מותג של ספק AI חיצוני (אם יש שכבת AI) — תמיד "Ghost".

---

## 11. צ'קליסט לפני מסירת כל שינוי

```
- [ ] כל הצבעים מטוקני ghost-* (חריג מאושר בלבד: #0a0a0a / blobs אמביינט)
- [ ] lime/red מופיעים אך ורק במשמעות סטטוס מבצעי (live / alert)
- [ ] תוויות מונו: uppercase, tracking 0.16–0.28em, אנגלית, dir="ltr"
- [ ] גבולות border-subtle + משטחי surface שקופים, רדיוסים עקביים
- [ ] dark הוא ברירת המחדל; חתימה ויזואלית נמוכה (בלי לזרוח בחושך)
- [ ] סטטוס קריטי קריא במבט חטוף (dot + תווית קצרה)
- [ ] RTL נכון ל-UI העברי; LTR לתוויות/timestamps/קואורדינטות/קוד
- [ ] אנימציות עדינות בעקומות הקיימות, וכבות תחת prefers-reduced-motion
- [ ] אייקון Ghost עירום + invert ב-dark
- [ ] הקופי יבש-מבצעי-מודיעיני, ללא אימוג'ים/סימני קריאה/שיווק
- [ ] פעולה מבצעית קריטית דורשת אישור אנושי מפורש
```

---

## 12. מיקרו-קופי מבצעי — תבניות

| מצב | טקסט (אנגלית מונו) |
|---|---|
| כותרת קונסול | `Ghost // Console` |
| סשן פעיל | `Ghost // Session` |
| מסך כניסה | `Ghost // Access` · `Secure Access` |
| אות חי | `LIVE SIGNAL` |
| זהות מוגנת | `IDENTITY PROTECTED` |
| מצב מוגבל | `RESTRICTED` |

עברית לאופרטור: משפטים קצרים, תכליתיים. דוגמה: "איך אפשר לעזור?" / "אין אות ממצלמה" / "נדרש אישור לפעולה".
טון: יבש, בטוח, מודיעיני. הקשר תמיד מבצעי (ביטחון / בטיחות / תפעול / חירום).
```
