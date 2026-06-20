# תכנית: בנייה מחדש של `/capabilities` בסגנון `cursor.com/product`

מסמך תכנון. לא בוצע עדיין שום שינוי קוד. מטרת המסמך: לקחת את שפת העיצוב של
`cursor.com/product` (כפי שחולצה מהאתר החי) ולעצב מחדש את עמוד
[`/capabilities`](../../frontend/src/components/auth/WhatGhostCanDoPage.tsx)
תוך שמירה מלאה על מערכת העיצוב של Ghost (monochrome, tokens קיימים, חוקי המותג).

מקורות:
- תמלול תוכן: `product-0.md` (הועלה).
- DNA ויזואלי: נחלץ ישירות מ-`cursor.com/product` (getComputedStyle + colorScheme).

---

## 1. שפת הסגנון החדש (Cursor DNA) → תרגום ל-Ghost

| מאפיין | Cursor (מקור) | תרגום ל-Ghost |
| --- | --- | --- |
| רקע | warm near-black `rgb(20,18,11)`, light text `rgb(237,236,236)` | להשתמש ב-tokens הקיימים: `--ghost-bg` (dark `#0a0a0a`/`33 33 33`, light `#fff`). **לא** לייבא את הגוון החם. |
| טיפוגרפיה | `CursorGothic` geometric grotesque, **weight 400 גם בכותרות גדולות** | להשאיר את ה-stack הקיים (`sans`), אבל **לעבור לכותרות במשקל regular/medium עם tracking שלילי הדוק** — זה הליבה של ה"סגנון החדש". |
| H1 | `clamp` ~36–64px, `letter-spacing -0.02em`, weight 400 | `text-[clamp(2.5rem,6vw,4.5rem)]`, `font-normal`, `tracking-[-0.03em]` |
| כותרת פרק (group) | `26px`, weight 400, `-0.0125em` | `text-[clamp(1.75rem,3vw,2.5rem)]`, `font-normal`, `tracking-[-0.02em]` |
| כותרת תת-יכולת | `16px`, weight 400 | `text-[18px]`, `font-medium`, `tracking-[-0.01em]` |
| body | `16px / 24px` | קיים (`text-[16px] leading-relaxed text-ghost-text-secondary`) |
| accent | כתום `#F54E00` ב-`Learn more →` | **monochrome בלבד** — קישור "Learn more →" ב-`text-ghost-text-primary` עם underline-on-hover (חוק מותג: אין צבע מותג זר). ראו "החלטה פתוחה #1". |
| מקצב אנכי | section padding ~67px (full-bleed) | סקשנים full-bleed עם container פנימי `max-w-6xl`, רווח אנכי `py-20`/`py-24`, רקעים מתחלפים (`bg-ghost-bg` ↔ `bg-ghost-bg-secondary`). |
| דמואים | פאנלים גדולים מעוגלים על רקע subtle | קיים — `DemoFrame` עם `rounded-2xl border bg-ghost-surface/20`. נרחיב לקומפוזיציות hero. |

---

## 2. מצב קיים מול יעד

**קיים** (`WhatGhostCanDoPage.tsx`):
- Hero טקסטואלי בלבד (kicker pill + title + subtitle + note).
- רשימה שטוחה של 9 יכולות (`CAPABILITIES`), כל אחת = grid דו-טורי: טקסט sticky (כותרת + הסבר + steps ממוספרים) + `DemoFrame`.
- Footer CTA יחיד.

**יעד** (סגנון Cursor):
- Hero קולנועי עם **קומפוזיציית דמו חיה** (חלונות חופפים) מעל רקע `ghost-ambient`.
- היכולות מקובצות ל-**פרקים תמטיים** עם כותרת-פרק גדולה, וכל פרק מכיל מספר תת-יכולות (כותרת קטנה + שורת תיאור + `Learn more →` + דמו).
- סקשנים נוספים בהשראת המקור: "Trusted by operators" (ציטוטים), "Recent highlights", רצועת "Changelog", ו-CTA סופי "Try Ghost now".

---

## 3. ארכיטקטורת מידע חדשה — קיבוץ 9 היכולות ל-4 פרקים

מיפוי מוצע (מכסה את כל 9 הקיימות, ללא שינוי תוכן ה-copy):

1. **"פשוט מדברים עם המצלמה"** — `chat` (01), `cameras` (02)
2. **"בנוי למאות מצלמות"** — `organize` (03), `broadcast` (08)
3. **"מלמדים אותו, והוא זוכר"** — `systemPrompt` (04), `memory` (05)
4. **"מבין את כל הסצנה — עבר והווה"** — `siteScan` (06), `history` (07), `alerts` (09)

כל פרק מקבל: `id`, `kicker` (mono label), `title` (כותרת-פרק גדולה), `intro` (משפט אחד), ורשימת capability ids.

---

## 4. שינויים ב-Design System

### 4.1 `frontend/src/index.css`
- להוסיף utility class `.ghost-display` לכותרות הסגנון החדש:
  ```css
  .ghost-display { font-weight: 400; letter-spacing: -0.03em; line-height: 1.02; }
  ```
- (אופציונלי) `.ghost-link-arrow` עבור קישורי "Learn more →" עם underline-on-hover ו-`group-hover` על החץ.
- שימוש חוזר ב-`ghost-ambient`, `ghost-glass`, `ghost-alert-dot` הקיימים.

### 4.2 `frontend/tailwind.config.js`
- אין חובה לשנות tokens. אם נרצה preset מהיר, אפשר להוסיף `fontSize` בשם `display`. עדיף inline `clamp`.

> חוקי מותג נאכפים: אין כתום `#F54E00`, אין מסגרת/מעטפת סביב אייקון Ghost, כל טקסט דינמי דרך `sanitizeBrand`/`sanitizeRefusal`. העמוד מוצג תמיד באנגלית (כפי שכבר מקובע ב-`WhatGhostCanDoPage`).

---

## 5. שינויים ב-Data Model — `frontend/src/data/capabilities.ts`
- להוסיף טיפוס `CapabilityChapter` ומערך `CHAPTERS` שמקבץ את ה-ids לפי סעיף 3.
- להשאיר את `CAPABILITIES` ו-`PAGE_CHROME` הקיימים כמקור התוכן (לא משנים את ה-copy של 9 היכולות).
- להוסיף ל-`PAGE_CHROME` מחרוזות חדשות: `learnMore`, וכותרות/intro של 4 הפרקים, וכותרות הסקשנים החדשים (`trustedBy`, `highlights`, `changelog`, ה-CTA הסופי) — `en` + `he`.
- (אם נוסיף ציטוטים/highlights) מערכי תוכן חדשים: `OPERATOR_QUOTES`, `HIGHLIGHTS`, `CHANGELOG_ITEMS` — תוכן Ghost אמיתי בלבד, לפי `ghost-manifesto`/`ghost-copywriting` (בלי "וידאו אנליטיקס", בלי דוגמאות גנריות).

---

## 6. קומפוננטות

מבנה מוצע (פיצול קבצים כדי לשמור על קומפוננטות קטנות):

```
components/capabilities/
  CapabilitiesHero.tsx        # hero קולנועי + קומפוזיציית דמו
  ChapterSection.tsx          # כותרת-פרק + רשימת FeatureBlock
  FeatureBlock.tsx            # תת-יכולת: title + one-liner + Learn more → + DemoFrame
  TrustedByStrip.tsx          # ציטוטים של מפעילים/שותפים
  HighlightsGrid.tsx          # 3 כרטיסי "מה חדש"
  ChangelogStrip.tsx          # רצועת עדכונים קומפקטית
  FinalCta.tsx                # "Try Ghost now" + הורדת field guide
  demos/ ...                  # קיימים, ללא שינוי לוגי
```

- `WhatGhostCanDoPage.tsx` הופך ל-**מרכיב הרכבה** שמייבא את החדשים ושומר על: `SiteSidebar`, נעילת locale ל-`en`, `scrollRef`, `LeadCapturePopup`.
- `Reveal`, `SectionLabel`, `DemoFor`, `DemoFrame` — להוציא ל-`components/capabilities/shared.tsx` לשימוש חוזר.

---

## 7. Hero חדש (`CapabilitiesHero`)
- שתי שורות כותרת ב-`.ghost-display` עם `clamp` גדול; תת-כותרת ב-`text-ghost-text-secondary`.
- שני CTA: ראשי (`Download the field guide`, מפעיל `LeadCapturePopup`) + משני (`Request access`).
- מתחת: קומפוזיציית דמו — שני-שלושה `DemoFrame` חופפים (למשל `DemoChatThread` + `DemoLiveCameraStage`) עם `ghost-glass` ו-offsets, מעל `ghost-ambient ghost-ambient--page`.
- ב-mobile: הקומפוזיציה קורסת לדמו בודד.

---

## 8. סקשנים חדשים (בהשראת המקור)
- **TrustedByStrip** — 3–6 ציטוטים קצרים ממפעילים/שותפים (תוכן Ghost; אם אין ציטוטים אמיתיים — לדלג, להחלטת המשתמש).
- **HighlightsGrid** — 3 כרטיסים "מה חדש" (יכולות/מאמרים), grid עם hover עדין.
- **ChangelogStrip** — רשימת עדכונים קומפקטית עם תאריך.
- **FinalCta** — חוזר על ה-footer CTA הקיים, בעיצוב הגדול של "Try Cursor now.".

> אם המשתמש מעדיף scope מינימלי — אפשר לבנות רק Hero + Chapters + FinalCta, ולדלג על TrustedBy/Highlights/Changelog (סעיף 11, שלב אופציונלי).

---

## 9. רספונסיביות, RTL ולוקליזציה
- העמוד מקובע ל-`en`/`ltr` (קיים) — נשמר.
- Breakpoints: grid דו-טורי → טור יחיד ב-`<lg`; כותרות `clamp` כבר רספונסיביות; קומפוזיציית ה-hero קורסת ב-`<md`.
- שמירה על `ps-/pe-` (logical properties) כפי שכבר נהוג בקובץ.

## 10. אנימציות
- שימוש חוזר ב-`Reveal` (IntersectionObserver, fade-up) הקיים — לכבד `prefers-reduced-motion`.
- `ghost-ambient` blobs (כבר מושבתים תחת reduced-motion).
- hover עדין על `Learn more →` ועל כרטיסי highlights בלבד.

---

## 11. שלבי ביצוע + הערכת זמן

| שלב | תיאור | סיכון |
| --- | --- | --- |
| 0 | אישור החלטות פתוחות (סעיף 13) | — |
| 1 | Design tokens: `.ghost-display` + helpers ב-`index.css` | נמוך |
| 2 | Data: `CHAPTERS` + מחרוזות `PAGE_CHROME` חדשות | נמוך |
| 3 | חילוץ `shared.tsx` (Reveal/DemoFrame/...) | נמוך |
| 4 | `FeatureBlock` + `ChapterSection` | בינוני |
| 5 | `CapabilitiesHero` (קומפוזיציית דמו) | בינוני-גבוה |
| 6 | הרכבה מחדש של `WhatGhostCanDoPage` | בינוני |
| 7 | (אופציונלי) TrustedBy / Highlights / Changelog / FinalCta | בינוני |
| 8 | QA ויזואלי בדפדפן Cursor (light+dark, 1440/768/390) | — |

עלות בן-אדם משוערת: ~6–10 שעות פיתוח. בסוכן: צפי משמעותית פחות.

## 12. QA / קריטריוני קבלה
- `npm run build` + `tsc --noEmit` עוברים.
- אין הופעות של "openai"/כתום זר; כל טקסט דינמי עובר sanitize.
- העמוד נראה תקין ב-dark וב-light, וב-3 רוחבי מסך.
- כל 9 היכולות עדיין מיוצגות (בתוך הפרקים), הדמואים פועלים.
- אייקון Ghost ללא מעטפת; `ghost-ambient` ללא תפרים מרובעים.

## 13. החלטות שננעלו

> **סטטוס: בוצע** — העמוד נבנה מחדש בסגנון Cursor (monochrome), עבר `tsc` + `npm run build`, ואומת ויזואלית ב-dark וב-light בדפדפן Cursor.

1. **Accent:** ✅ **monochrome מלא** — לבן/שחור בלבד. אין accent זר, אין כתום. קישורי "Learn more →" ב-`text-ghost-text-primary` עם underline-on-hover.
2. **קיבוץ לפרקים:** ✅ **לקבץ ל-4 פרקים תמטיים** (סעיף 3), בסגנון Cursor.
3. **Scope:** ✅ **עמוד מלא** — כולל TrustedBy / Highlights / Changelog / FinalCta (סעיף 8 על כל חלקיו, שלב 7 הופך לחובה ולא אופציונלי).
