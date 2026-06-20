# Stream + Scroll Hardening — Browser QA Report

תאריך: 2026-06-17 · סוכן: Cursor (cursor-ide-browser) · משתמש: `omerghost` · בילד מקומי (`localhost:8888` + backend `:8000`)

## הקשר

ולידציה בדפדפן ל-PR של הקשחת אזור הצ'אט (streaming / Stop / refusal / scroll). הבדיקה בוצעה
אוטומטית ע"י הסוכן בדפדפן של Cursor, עם אימות ויזואלי (screenshots) ומדידות CDP.

## סיכום תוצאות

| # | תרחיש | תוצאה | הערות |
|---|--------|-------|-------|
| — | טעינת קונסולה מחוברת (magic-login דרך `/?magic=`) | PASS | RTL shell, סיידבר שיחות, `omerghost` מחובר |
| — | פתיחת שיחה חדשה + composer | PASS | empty-state "איך אפשר לעזור?", composer פעיל |
| 2a | כפתור Stop מופיע בזמן streaming | PASS | בלחיצת שליחה: כפתור השליחה הופך ל-"עצור תגובה", ה-textarea ננעל ("...ממתין לתשובה") — wiring של Composer Stop עובד |
| — | נתיב שגיאה בשליחה כושלת | PASS | מפתח API לא תקין → באנר שגיאה **ממותג Ghost** ("מפתח ה-Ghost API ... אינו תקין"), **ללא** "OpenAI"; ה-composer חזר להיות פעיל (teardown נקי, אין error gנרי) |
| 1 | Scroll-up בזמן stream | BLOCKED | דורש תשובת מודל זורמת |
| 2b | Stop שומר partial | BLOCKED | דורש תשובת מודל זורמת |
| 3 | מעבר שיחה mid-stream | BLOCKED | דורש תשובת מודל זורמת |
| 4 | autoScroll אחרי scroll-up | BLOCKED | דורש תשובת מודל זורמת |
| 5 | סירוב (best-effort) | BLOCKED | דורש תשובת מודל זורמת |
| 6 | Incident chat (משטח 3) | BLOCKED | דורש תשובת מודל זורמת |

## החוסם

לאף אחד מהמשתמשים המקומיים אין **מפתח Ghost API תקף** — שליחת הודעה מחזירה מיד:

> "מפתח ה-Ghost API שמוגדר אינו תקין או שפג תוקף. עדכן מפתח Ghost API תקין בהגדרות כדי להמשיך."

ללא קריאת מודל אין זרימת טוקנים, ולכן לא ניתן להריץ בדפדפן את התרחישים התלויים-streaming
(1–6). זהו חוסם **סביבה**, לא פגם בקוד.

מה כן אומת תוך כדי כך, ורלוונטי ישירות ל-PR:
- **Stop wiring** — כפתור Stop מופיע ומחליף את כפתור השליחה בזמן streaming, וה-composer ננעל.
- **נתיב teardown/שגיאה** — שליחה כושלת מסתיימת בניקוי מצב נקי + הודעת שגיאה ממותגת Ghost
  בלי דליפת "OpenAI" ובלי טקסט סירוב גנרי.

## כיסוי משלים (CI — רץ ועובר)

הערובות המהותיות מכוסות בבדיקות אוטומטיות שרצות ב-CI (אינן תלויות-מודל):
- `frontend` vitest — **69 בדיקות עוברות**, כולל:
  - `streamDisplayGuard.test.ts` — מגן הצגת סירוב live (כולל פתיח-סירוב חלקי).
  - `sanitize.test.ts` — דפוסי refusal EN+HE + מיתוג.
  - `chatStreamConsumer.test.ts` — commit/abort-partial/multi-camera/refusal.
  - `messageStore.test.ts` (store-level) — stream נקי, refusal→Ghost, **Stop שומר partial אחד**,
    **fetchMessages נדחה בזמן streaming ולא דורס**.
  - `chatScrollUtils.test.ts` — פין/ניתוק autoScroll, scroll-up מול pin תכנותי.
- `backend` smoke — `test_refusal_guard_smoke.py` (**7/7**): מוכיח שנתיב הטקסט **לעולם** לא
  משדר טקסט סירוב, גם כשסירוב מופיע אחרי prefix נקי (`sent>0`).

## כדי להשלים את התרחישים החיים (פעולת מפעיל)

להגדיר מפתח Ghost API תקף למשתמש מקומי (דרך Settings → Ghost API Key), ואז להריץ שוב את
תרחישים 1–6. לחלופין להריץ דרך זרימת ה-trial שמשתמשת ב-`GHOST_DEMO_API_KEY` בצד שרת.
