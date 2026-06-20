# מסמך ארכיטקטורה מלא — Ghost

> מסמך זה מתאר את המערכת המלאה: ארכיטקטורה, שכבות, זרימות, מודלים של מידע,
> שירותים, ה-API, וה-UI. נכתב בעברית פשוטה אך מדויקת, כך שמתכנת או מנהל
> טכני שלא הכיר את הקוד יוכל להבין את המערכת מקצה לקצה.
>
> שמות קבצים, מחלקות, פונקציות, פקודות ושמות טכניים נשארים באנגלית כפי שהם
> בקוד. זהו מסמך הנדסי פנימי — הוא מתאר את הטכנולוגיה האמיתית מאחורי המוצר
> (שמולה, כלפי המשתמש, המערכת אוכפת "Tech-Probe Lockdown" וחושפת מותג Ghost
> בלבד — ראו סעיף 6.7).

---

## תוכן עניינים

1. [מבט-על](#1-מבט-על)
2. [מבנה הפרויקט בקבצים](#2-מבנה-הפרויקט-בקבצים)
3. [סטאק טכנולוגי](#3-סטאק-טכנולוגי)
4. [ה-Backend](#4-ה-backend)
   - 4.1. [נקודת הכניסה ו-Bootstrap](#41-נקודת-הכניסה-ו-bootstrap)
   - 4.2. [מסד נתונים — SQLite](#42-מסד-נתונים--sqlite)
   - 4.3. [מאגר וקטורי — ChromaDB](#43-מאגר-וקטורי--chromadb)
   - 4.4. [סכמות נתונים (Pydantic)](#44-סכמות-נתונים-pydantic)
   - 4.5. [שכבת ה-Storage](#45-שכבת-ה-storage)
   - 4.6. [שכבת ה-Services](#46-שכבת-ה-services)
   - 4.7. [שכבת ה-Routes — ה-API](#47-שכבת-ה-routes--ה-api)
5. [ה-Frontend](#5-ה-frontend)
   - 5.1. [שתי אפליקציות — אתר שיווקי ומערכת תפעולית](#51-שתי-אפליקציות--אתר-שיווקי-ומערכת-תפעולית)
   - 5.2. [שכבת ה-API Client](#52-שכבת-ה-api-client)
   - 5.3. [State Management — Zustand Stores](#53-state-management--zustand-stores)
   - 5.4. [Services — לוגיקה רקעית בדפדפן](#54-services--לוגיקה-רקעית-בדפדפן)
   - 5.5. [Components — רכיבי ה-UI](#55-components--רכיבי-ה-ui)
   - 5.6. [Utilities, Hooks ו-Data](#56-utilities-hooks-ו-data)
   - 5.7. [Design System](#57-design-system)
6. [מנועים מרכזיים — Deep Dive](#6-מנועים-מרכזיים--deep-dive)
   - 6.1. [Memory Engine — מנוע הזיכרון](#61-memory-engine--מנוע-הזיכרון)
   - 6.2. [Knowledge Engine — בסיס הידע](#62-knowledge-engine--בסיס-הידע)
   - 6.3. [Visual Memory — זיכרון חזותי](#63-visual-memory--זיכרון-חזותי)
   - 6.4. [Alert Engine — מנוע ההתראות](#64-alert-engine--מנוע-ההתראות)
   - 6.5. [Object Tracking Engine — YOLO מקומי + Collage](#65-object-tracking-engine--yolo-מקומי--collage)
   - 6.6. [Incident Management — ניהול אירועים](#66-incident-management--ניהול-אירועים)
   - 6.7. [Refusal Guard ו-Tech-Probe Lockdown](#67-refusal-guard-ו-tech-probe-lockdown)
   - 6.8. [Site Intelligence ו-Broadcast](#68-site-intelligence-ו-broadcast)
7. [זרימות End-to-End](#7-זרימות-end-to-end)
8. [אבטחה, פרטיות וקונפיגורציה](#8-אבטחה-פרטיות-וקונפיגורציה)
9. [פיתוח, ריצה ו-Deploy](#9-פיתוח-ריצה-ו-deploy)
10. [מילון מונחים מהיר](#10-מילון-מונחים-מהיר)

---

## 1. מבט-על

**Ghost** הוא ממשק AI פנימי המדמה "צופה לילה" שמסתכל יחד עם המפעיל על
מצלמות אבטחה ומתאר במילים אנושיות מה הוא רואה — וסביבו נבנתה פלטפורמת
מודיעין מלאה: זיהוי אובייקטים מקומי (YOLO), ניהול אירועים (Incidents),
דוחות Site Intelligence, שידור לאזור/קבוצת מצלמות (Broadcast), אונבורדינג
מודרך, פקודות קוליות, ואתר שיווקי ציבורי.

המערכת היא בעיקרה **Local-First**: כל המידע (משתמשים, שיחות, הודעות,
זיכרונות, בסיס ידע, אירועי התראה, אירועים מנוהלים, אובייקטים שזוהו, leads)
נשמר על דיסק. הקריאות החיצוניות היחידות הן ל-OpenAI (הסקת תשובות,
embeddings, פלט מובנה). זיהוי האובייקטים (YOLO) רץ **מקומית** על המכונה
(CPU/MPS) — הוא אינו תלוי בענן.

המערכת בנויה משלוש שכבות, ונפרסת בענן על Firebase Hosting (frontend) +
Cloud Run (backend כבד עם torch/YOLO + ChromaDB):

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND  ──  React 19 + Vite + TypeScript + Zustand          │
│  שני builds:                                                   │
│    • index.html  → אתר שיווקי ציבורי (SiteApp)                  │
│    • app.html    → המערכת התפעולית (App: chat/incidents/alerts) │
└──────────────────────┬─────────────────────────────────────────┘
                       │  REST + Server-Sent Events (SSE)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND   ──  FastAPI + Pydantic v2 + Uvicorn                 │
│                Routes → Services → Storage                     │
└──────┬───────────────────────┬──────────────────┬─────────────┘
       │                       │                  │
       ▼                       ▼                  ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  SQLite      │   │  ChromaDB        │   │  YOLO (ultralytics)│
│  18 migrations│   │  Embeddings      │   │  inference מקומי   │
│  משתמשים,    │   │  זיכרון + ידע    │   │  (CPU/MPS)         │
│  שיחות, הודעות,│   └──────────────────┘   │  person+vehicles  │
│  זיכרון, ידע,  │                          └──────────────────┘
│  התראות,      │
│  visual memory,│        ↕
│  incidents,    │
│  detection,    │   ┌──────────────────────────────────────────┐
│  leads, magic  │   │  OpenAI API                              │
│  tokens        │   │  • gpt-5 (vision ברירת מחדל, chat tier 4)│
└──────────────┘   │  • gpt-4o / gpt-5-mini / gpt-4o-mini      │
                    │    (accuracy tiers + alerts)             │
                    │  • text-embedding-3-small (embeddings)   │
                    └──────────────────────────────────────────┘
```

### מה המערכת יודעת לעשות

1. **צ'אט מרובה משתמשים** — כל משתמש עם כינוי ומפתח OpenAI משלו (מוצפן
   ב-Fernet).
2. **ניהול שיחות** — יצירה, מחיקה, שינוי כותרת, system prompt, ורמת דיוק
   (`accuracy_level` 1–4) לכל שיחה.
3. **תשובות בזרימה** — SSE-streaming מ-OpenAI לדפדפן.
4. **מנוע זיכרון** — חילוץ אוטומטי של עובדות/העדפות/הנחיות/ישויות לכל תור
   שיחה, עם embedding לאחזור סמנטי.
5. **בסיס ידע** — העלאת קבצים (PDF/DOCX/TXT/MD/JSON) או טקסט, חיתוך
   ל-chunks והזרקה לפי דמיון סמנטי.
6. **Vision** — שליחת פריים/קולאז' מהמצלמה ל-AI לתיאור הסצנה.
7. **Multi-Camera** — קישור כמה מצלמות לשיחה; כל הודעה מקבלת תשובה נפרדת
   לכל מצלמה.
8. **Visual Memory** — חילוץ ישויות (אנשים/רכבים) מתיאורי הסצנה ואיחודן
   לפי signature, כדי לענות "כמה אנשים ראית הלילה".
9. **Alert Mode** — ניטור מצלמה רציף מול חוקי התראה בטקסט חופשי; התאמה
   בביטחון גבוה → התראה real-time דרך SSE.
10. **Object Tracking Engine** — זיהוי YOLO מקומי של אנשים/רכבים בכל פריים,
    dedupe ויזואלי מקומי, צבירת crops ל-batch, ושליחת קולאז' אחד ל-Ghost
    Vision לפרופיל פורנזי עמוק (ראו 6.5).
11. **Incident Management** — כל התראה הופכת אוטומטית ל-"אירוע" מנוהל עם
    דירוג חומרה ע"י AI, סטטוסים, הקצאה, הערות, ראיות, סיכום AI, ו-chat
    חקירה ייעודי (ראו 6.6).
12. **Site Intelligence** — סריקת פריים בודד שמפיקה דוח מודיעיני פורמלי
    מובנה (PDF-ready), במקום תגובת צ'אט.
13. **Broadcast** — שאלה אחת שמשודרת לכל מצלמות אזור/קבוצה, תשובה נפרדת לכל
    מצלמה, ללא שמירה (ephemeral).
14. **קונטקסט זמני** — תיוג `[HH:MM]` לכל הודעה כדי לענות "מתי ראית X".
15. **רב-לשוני** — עברית (ברירת מחדל RTL) ואנגלית (LTR).
16. **Refusal Guard + Tech-Probe Lockdown** — שכבות הגנה שמיירטות סירובי
    AI ומונעות חשיפת הטכנולוגיה שמאחורי Ghost (ראו 6.7).
17. **Onboarding מודרך** — סיור צעד-אחר-צעד במערכת התפעולית.
18. **Voice** — קלט/פקודות קוליות ל-Composer.
19. **Magic-Link Login** — קישור התחברות חד-פעמי מוגבל-זמן.
20. **Trial Session** — גישת "8 דקות" ציבורית לאותו shell תפעולי, scoped לפי IP.
21. **Download Lead Capture** — לכידת פרטי מתעניין שמוריד מסמכים מהאתר
    השיווקי, כולל geolocation מ-IP.

---

## 2. מבנה הפרויקט בקבצים

```
ghst_rashi/
├── README.md
├── ARCHITECTURE_HE.md              ← המסמך הזה
├── MEMORY_PANEL_HE.md
├── omer_efforts.md                 ← יומן עבודות סוכן ה-AI
├── firebase.json                   ← Firebase Hosting + rewrites ל-Cloud Run
├── *.html / *.pdf                  ← נכסי שיווק (Defense Brief, OnePager, ...)
├── archmaster/                     ← תיעוד ארכיטקטורה ויזואלי
├── scripts/                        ← deploy-firebase.sh ועוד
│
├── backend/
│   ├── requirements.txt            ← תלויות Python (כולל ultralytics/torch)
│   ├── .env                        ← משתני סביבה (API key, master key, מודלים)
│   ├── data/
│   │   ├── ghost.db                ← SQLite
│   │   ├── chroma/                 ← ChromaDB persistence
│   │   ├── models/                 ← משקלי YOLO (yolov8n.pt, auto-download)
│   │   └── uploads/frames/         ← פריימים, crops (track-crops/), collages
│   └── app/
│       ├── main.py                 ← FastAPI bootstrap + lifespan + CORS
│       ├── config.py               ← Settings + accuracy tiers + YOLO knobs
│       ├── dependencies.py         ← singleton VectorStore
│       ├── migrations/             ← 001..018 קבצי SQL ממוספרים
│       ├── schemas/                ← Pydantic models (requests/responses)
│       ├── storage/                ← Repository layer (גישה ל-DB)
│       ├── services/               ← לוגיקה עסקית
│       └── routes/                 ← HTTP endpoints (FastAPI routers)
│
└── frontend/
    ├── package.json                ← תלויות npm
    ├── vite.config.ts              ← פורט 8888 (HTTPS) + 2 entries + proxy
    ├── tailwind.config.js
    ├── index.html                  ← entry לאתר השיווקי → src/site/main-site.tsx
    ├── app.html                    ← entry למערכת התפעולית → src/main.tsx
    └── src/
        ├── main.tsx                ← entry: App (מערכת תפעולית)
        ├── App.tsx                 ← shell תפעולי (chat / incidents / panels)
        ├── site/                   ← אתר שיווקי: main-site.tsx + SiteApp.tsx
        ├── index.css               ← Tailwind + global tokens
        ├── api/client.ts           ← קליינט HTTP + פרסור SSE
        ├── types/api.ts            ← טיפוסי ה-API
        ├── config/                 ← demoAccess.ts
        ├── data/                   ← capabilities.ts, useCases.ts (תוכן אתר)
        ├── hooks/                  ← useDocumentChrome, useVoiceComposer, ...
        ├── onboarding/             ← tourSteps.ts, useTourAnchor.ts
        ├── stores/                 ← Zustand stores
        ├── services/               ← לולאות רקע (Alert/Detection engines, SSE)
        ├── utils/                  ← i18n, sanitize, camera capture, groups
        ├── design/tokens.ts
        └── components/
            ├── auth/               ← אתר שיווקי + לוגין (Defense, Team, ...)
            ├── capabilities/demos/ ← דמואים אינטראקטיביים לאתר
            ├── sidebar/            ← רשימת שיחות + קבוצות (dnd-kit)
            ├── chat/               ← ChatArea, MessageBubble, LiveCameraStage…
            ├── composer/           ← תיבת כתיבה + voice + live cameras
            ├── incidents/          ← Board, Workspace, Timeline, KPI…
            ├── knowledge/          ← פאנל בסיס ידע
            ├── alerts/             ← AlertModePanel + AlertOverlay
            ├── onboarding/         ← Overlay, Hub, Launcher
            ├── settings/           ← הגדרות, system prompt, voice, magic-link
            └── shared/             ← ErrorBanner, ErrorBoundary, MemoryPanel
```

---

## 3. סטאק טכנולוגי

### Backend (Python 3.9+)

| ספרייה | תפקיד |
| --- | --- |
| `fastapi==0.115.6` | מסגרת ה-Web (REST + SSE) |
| `uvicorn[standard]==0.34.0` | ASGI server |
| `pydantic==2.10.4` / `pydantic-settings==2.7.1` | ולידציה + קונפיגורציה |
| `openai==1.59.3` | קליינט אסינכרוני ל-OpenAI |
| `chromadb==0.5.23` | מאגר וקטורי persistent |
| `cryptography==44.0.0` | Fernet להצפנת API keys |
| `python-multipart==0.0.18` | uploads (`UploadFile`) |
| `pdfplumber==0.11.4` / `python-docx==1.1.2` | חילוץ טקסט מ-PDF/DOCX |
| `tiktoken==0.8.0` | ספירת tokens |
| `aiosqlite==0.20.0` / `sse-starlette==2.2.1` | תשתית עתידית (לא בשימוש פעיל) |
| `python-dotenv==1.0.1` / `eval-type-backport==0.3.1` | טעינת `.env` + תאימות typing ל-3.9 |
| `ultralytics==8.4.53` | **YOLO מקומי** (lazy-loaded) לזיהוי אובייקטים |
| `pillow==11.3.0` / `numpy==2.0.2` | עיבוד תמונה ל-crop/collage/fingerprint |

### Frontend

| ספרייה | תפקיד |
| --- | --- |
| `react@19` + `react-dom@19` | UI framework |
| `vite@6` | Bundler + dev server (HTTP על localhost) |
| `typescript@5.7` | טיפוסים סטטיים |
| `tailwindcss@3.4` | CSS utilities |
| `zustand@5` | ניהול state גלובלי |
| `react-markdown@9` + `remark-gfm@4` | רינדור Markdown של תשובות |
| `react-syntax-highlighter@15` | הדגשת תחביר לבלוקי קוד |
| `lucide-react@0.469` | אייקונים |
| `@dnd-kit/core` + `@dnd-kit/sortable` | גרירה: קבוצות sidebar + לוח Incidents |
| `@mediapipe/tasks-vision` | זיהוי פנים בדפדפן ל-**face blur** + segmentation |
| `@tanstack/react-virtual` | וירטואליזציה של רשימות ארוכות |
| `gsap` + `lenis` | אנימציות וגלילה חלקה באתר השיווקי |

### AI / OpenAI Models

| מודל | שימוש |
| --- | --- |
| `gpt-5` | ברירת מחדל ל-vision (`GHOST_VISION_MODEL`), chat ב-accuracy tier 4, וניתוח collage tracking |
| `gpt-4o` / `gpt-5-mini` / `gpt-4o-mini` | accuracy tiers 2/3/1 לצ'אט (`model_for_accuracy`) |
| `gpt-4o-mini` | סריקת התראות (`alert_vision_model`, detail=low, timeout ~1.4s), חילוץ זיכרון, Visual Observations, severity scoring, incident summary |
| `text-embedding-3-small` | embeddings לחיפוש סמנטי |

> **רמות דיוק (accuracy tiers):** `config.model_for_accuracy(level)` ממפה
> `accuracy_level` per-conversation (1–4) למודל: 1→gpt-4o-mini, 2→gpt-4o,
> 3→gpt-5-mini, 4→`settings.vision_model` (ברירת מחדל gpt-5). כל המודלים
> תומכים vision כי כל תור עשוי לשאת תמונה.

### פריסה (Deployment)

- **Frontend** → Firebase Hosting (`frontend/dist`), project `ghst-rashi`.
- **Backend** → Cloud Run service `ghst-api` (region `us-central1`).
- `firebase.json` עושה rewrite של `/api/**` ו-`/uploads/**` ל-Cloud Run,
  `/app` → `app.html`, וכל השאר → `index.html` (האתר השיווקי).
- skill `rashi-deploy` (`.cursor/skills/rashi-deploy/`) מתזמר deploy מלא של
  שני הצדדים בפקודה "גו דיפלוי" / "go deploy".

---

## 4. ה-Backend

### 4.1. נקודת הכניסה ו-Bootstrap

**הקובץ:** `backend/app/main.py`

זרימת ה-startup (`lifespan`):

1. `settings.ensure_directories()` — יוצר `data/`, `chroma/`, `uploads/`,
   ו-`data/models/` (ל-YOLO).
2. `run_migrations()` — מריץ את כל קבצי ה-SQL ב-`app/migrations/`
   (001..018) לפי סדר, ומסמן ב-`_migrations`.
3. `set_vector_store(VectorStore(settings.chroma_path))` — מאתחל ChromaDB.

רישום הראוטרים תחת prefix `/api`: `health`, `users`, `conversations`,
`cameras`, `chat`, `knowledge`, `alerts`, `incidents`, `detection`,
`downloads`. בנוסף mount של `/uploads` ושל `/api/frames` (פריימים, crops,
collages) כספריות סטטיות.

**CORS** — מתיר `http://localhost:8765`, `localhost:8888` (HTTP+HTTPS),
ו-`https://ghst-rashi.web.app` / `.firebaseapp.com`. בפרודקשן ה-frontend
וה-API חולקים origin דרך rewrites של Firebase Hosting, כך ש-CORS משמש בעיקר
כרשת ביטחון (גישה ישירה ל-Cloud Run / preview channels).

**הקובץ:** `backend/app/config.py` — `Settings` מ-`.env` עם:

- `ghost_master_key` — מפתח Fernet (חובה לייצור).
- `vision_model` (ברירת מחדל `gpt-5`) + `vision_image_detail` (`high`).
- `alert_vision_model` / `_image_detail` / `_max_tokens` / `_timeout_seconds`
  — צינור התראות מכוון-latency (יעד ≤2.8s end-to-end).
- **YOLO:** `yolo_model_name`, `yolo_models_dir`, `yolo_confidence_threshold`,
  `yolo_crop_padding_px`, `yolo_inference_imgsz`.
- **Detection dedupe / batches:** `detection_dedupe_cooldown_seconds` (180),
  `detection_dedupe_centroid_bucket_px`, `detection_batch_target_default` (8),
  `detection_batch_target_max` (88), `detection_collage_tile_px` (224),
  `detection_collage_tile_padding_px`.
- **Visual dedupe gate:** `detection_visual_dedupe_enabled` + thresholds
  (HSV histogram cosine, dHash Hamming, ו-NCC מבני).
- `model_for_accuracy(level)` — מיפוי tier→model (ראו סעיף 3).

**הקובץ:** `backend/app/dependencies.py` — singleton ל-`VectorStore`.

### 4.2. מסד נתונים — SQLite

**הקובץ:** `backend/app/storage/database.py` — `get_db()` פותח חיבור לכל
בקשה עם `foreign_keys=ON`, `journal_mode=WAL`, ו-`row_factory=sqlite3.Row`.
`run_migrations()` רץ ב-startup.

**קבצי migrations:**

| קובץ | מה מוסיף |
| --- | --- |
| `001_initial.sql` | `users`, `conversations`, `messages` + אינדקסים |
| `002_memory_tables.sql` | `memory_items` |
| `003_knowledge_tables.sql` | `knowledge_sources` + `knowledge_chunks` |
| `004_message_image_path.sql` | עמודת `image_path` להודעות |
| `005_conversation_cameras.sql` | `conversation_cameras` + `camera_label` |
| `006_alert_tables.sql` | `alert_rules` + `alert_events` + `alert_mode_enabled` |
| `007_visual_memory.sql` | `visual_entities` + `visual_observations` |
| `008_incident_management.sql` | `incident_events` + `incident_activity` + `incident_notes` + `incident_evidence` + `conversations.incident_id` |
| `009_detection_tracking.sql` | `detection_events` + `detected_objects` + `conversations.tracking_enabled` |
| `010_detection_batches.sql` | `detection_pending_crops` + `detection_batches` + `conversations.detection_batch_target` + `detected_objects.batch_id/tile_index` |
| `011_visual_fingerprints.sql` | `fingerprint_json` + `object_type` ל-pending/detected (dedupe ויזואלי) |
| `012_magic_login_tokens.sql` | `magic_login_tokens` (קישור התחברות חד-פעמי) |
| `013_download_leads.sql` | `download_leads` (לכידת מתעניינים) |
| `014_detected_object_dedupe_signature.sql` | `detected_objects.dedupe_signature` |
| `015_download_lead_contact.sql` | `name` / `company` / `phone` ל-download leads |
| `016_conversation_origin_ip.sql` | `conversations.origin_ip` (scoping לפי IP ל-trial) |
| `017_conversation_lead_contact.sql` | `lead_name` / `lead_email` / `lead_phone` לשיחה |
| `018_conversation_accuracy_level.sql` | `conversations.accuracy_level` (1–4, ברירת מחדל 4) |

#### תיאור מקוצר של הטבלאות העיקריות

- **`users`** — `id`, `nickname`, `api_key_encrypted` (Fernet), `created_at`.
- **`conversations`** — מטא של שיחה: `title`, `system_prompt`,
  `message_count`, `alert_mode_enabled`, `tracking_enabled`,
  `detection_batch_target`, `accuracy_level`, `origin_ip`, `incident_id`,
  ו-`lead_name/email/phone`.
- **`messages`** — `role`, `content`, `token_estimate`, `sequence_number`,
  `image_path`, `camera_label`, `created_at`.
- **`memory_items`** — זיכרון מובנה (`fact`/`preference`/`instruction`/`entity`).
- **`knowledge_sources`** / **`knowledge_chunks`** — מסמכים + chunks (500
  tokens, overlap 50).
- **`conversation_cameras`** — אילו מצלמות (`device_id`) קשורות לשיחה.
- **`alert_rules`** / **`alert_events`** — חוקי התראה + אירועים שזוהו.
- **`visual_entities`** / **`visual_observations`** — Visual Memory (ראו 6.3).
- **`incident_events`** — אירוע מנוהל: `status` (new/handling/investigation/
  closed), `severity` (low/medium/high/critical), `assigned_to`, `summary`,
  `source_camera_label`, `preview_image_path`, `ai_reasoning`, `tags`,
  `handling_started_at`, `closed_at`. + טבלאות לוויין:
  `incident_activity` (timeline), `incident_notes`, `incident_evidence`.
- **`detection_events`** — מופע flush של batch (collage שנשלח ל-Vision).
- **`detected_objects`** — אובייקט שזוהה ופורופל: `object_type`,
  `tracking_id`, `signature`, פרטי person/vehicle, `deep_description`,
  `frame_path` (crop), `batch_id`, `tile_index`, `fingerprint_json`,
  `dedupe_signature`.
- **`detection_pending_crops`** — תור crops שטרם נשלחו ב-batch.
- **`detection_batches`** — היסטוריית batches (status/triggered_by/error).
- **`magic_login_tokens`** — token חד-פעמי, `expires_at`, `consumed_at`.
- **`download_leads`** — אימייל/טלפון/שם/חברה + IP + user-agent + geo + file.

### 4.3. מאגר וקטורי — ChromaDB

**הקובץ:** `backend/app/storage/vector_store.py`

שתי "קולקציות" לכל ישות: `memory_{conversation_id}` ו-`knowledge_{user_id}`.
פונקציות: `add/search/delete_memory`, `delete_conversation_memory`,
`add/search/delete_knowledge`. חיפוש מקבל `query_embedding` ומחזיר top-K עם
מסמך מקור ו-distance.

### 4.4. סכמות נתונים (Pydantic)

**`schemas/models.py`** — מודלים פנימיים (`User`, `Conversation`, `Message`,
`MemoryItem`, `KnowledgeSource`, `KnowledgeChunk`).

**`schemas/requests.py`** — כל ה-payloads הנכנסים, כולל:

- `CreateUserRequest`, `UpdateUserRequest`
- `CreateConversationRequest` (כולל lead contact), `UpdateConversationRequest`
  (כולל `accuracy_level`)
- `CameraFramePayload`, `SendMessageRequest` (`image_base64`,
  `camera_frames[]`, `locale`, `mode` ∈ {chat, site_intelligence})
- `BroadcastMessageRequest` (שידור ephemeral)
- `SaveCameraSetupRequest`
- `CreateKnowledgeSourceRequest`, `UpdateKnowledgeSourceRequest`
- Alerts: `CreateAlertRuleRequest`, `UpdateAlertRuleRequest`,
  `SetAlertModeRequest`, `AlertScanRequest` (כולל `device_id`/`camera_label`),
  `AcknowledgeAlertRequest`
- Incidents: `UpdateIncidentRequest`, `AssignIncidentRequest`,
  `AddIncidentNoteRequest`, `CloseIncidentRequest`, `InvestigateIncidentRequest`,
  `AddIncidentEvidenceRequest`
- Detection: `DetectionScanRequest`, `SetTrackingModeRequest`,
  `SetDetectionBatchTargetRequest`, `FlushDetectionBatchRequest`
- `TrackDownloadRequest` (lead capture)

**`schemas/responses.py`** — פורמט אחיד: `{"ok": true, "data": ...}` /
`{"ok": false, "error": {"code","message"}}`. `ok_response()`,
`error_response()`, ו-`GhostException` (יורש מ-`HTTPException`).

### 4.5. שכבת ה-Storage

| קובץ | תפקיד |
| --- | --- |
| `user_store.py` | CRUD משתמש + הצפנת API keys (Fernet) + `verify_user` + `get_user_api_key` |
| `conversation_store.py` | CRUD + `increment_message_count`; SELECT מצרף `camera_count`, `alert_mode_enabled`, `tracking_enabled`, `accuracy_level`; תמיכה ב-`origin_ip` scoping ו-lead contact |
| `message_store.py` | `create_message`, `list_messages`, `get_recent_messages`, `get_messages_since`, עדכון `image_path` |
| `memory_store.py` | CRUD זיכרון + `increment_access_count` + `get_stale_memories` |
| `knowledge_store.py` | CRUD מקורות + chunks |
| `camera_store.py` | `list_cameras`, `replace_cameras` (טרנזקציה), `delete_cameras` |
| `alert_store.py` | CRUD חוקים/אירועים + `set_alert_mode`, `get_alert_mode`, `acknowledge_event`, `list_alert_mode_conversations` |
| `visual_memory_store.py` | `insert_observation`, `upsert_entity` (איחוד לפי signature), `list_entities`, `list_recent_observations`, `get_summary` |
| `incident_store.py` | CRUD אירועים, `find_merge_candidate`, `update_incident_status/assignment/fields`, notes/evidence/activity, `get_kpi_stats`, `attach_conversation_to_incident` |
| `detection_store.py` | `insert_detection_event`, `insert_detected_object_with_batch`, `list_objects`/`list_events`, `get_summary`, `get/set_tracking_enabled`, dedupe lookups, `prune_detected_objects_to_limit` |
| `detection_batch_store.py` | pending crops queue + batches: `insert_pending_crop`, `count/list_pending_crops`, `delete_pending_crops`, `create/update_batch`, `get/set_batch_target`, `recent_visual_fingerprints` |
| `magic_link_store.py` | `create_magic_token`, `consume_magic_token` (חד-פעמי, TTL) |
| `download_lead_store.py` | `record_download`, `list_downloads`, `geolocate_ip` |
| `vector_store.py` | מעטפת על ChromaDB |

עיקרון חוזר: כל פונקציה מקבלת `db: sqlite3.Connection` כפרמטר ראשון;
הראוטר/השירות אחראי על פתיחה/סגירה דרך `try/finally`.

### 4.6. שכבת ה-Services

#### `openai_client.py`

מרכז את כל הקריאות ל-OpenAI:

- `_completion_kwargs(...)` — בונה את הארגומנטים ל-`chat.completions.create`,
  כולל טיפול במודלים שלא תומכים `temperature` (gpt-5 וכו' דרך
  `_supports_temperature`).
- `stream_chat_completion(messages, api_key, model=None, ...)` — סטרים
  אסינכרוני; ברירת מחדל מודל = `_vision_model()` (gpt-5).
- `alert_vision_scan(...)` — non-stream עם `ALERT_DETECTION_SCHEMA` (JSON
  schema), `detail=low`, timeout מ-config.
- `structured_vision_analysis(...)` — fallback ל-vision עם
  `VISION_ANALYSIS_SCHEMA` הקשיח.
- `get_embedding` / `get_embeddings` — `text-embedding-3-small`.
- `extract_memory(...)` — חילוץ זיכרון (gpt-4o-mini, JSON).
- `extract_visual_observations(...)` — חילוץ תצפיות חזותיות (JSON schema).
- `looks_like_refusal_text(text)` — בודק אם טקסט נראה כסירוב (שימוש ב-incidents).
- `score_incident_severity(...)` — דירוג חומרת אירוע (gpt-4o-mini, JSON).
- `summarize_incident(...)` — סיכום debrief לאירוע.
- `quick_object_check` / `deep_object_analysis` — שרידי צינור ה-tracking
  הישן (per-frame external vision). הוחלפו ע"י `tracking_collage_client`.

#### `vision_schema.py`

`VISION_ANALYSIS_SCHEMA` (fallback אחרי סירוב) + `render_scene_analysis_markdown(analysis)`
שממיר את ה-JSON ל-Markdown אנושי בלי כותרות סעיפים.

#### `prompt_builder.py`

- `GHOST_IDENTITY` — אישיות Ghost (צופה לילה, אנושי, לא מזהה זהויות, לא
  כותרות סעיפים, Anti-Generic, Temporal Awareness). כולל סעיף **"Classified
  — your own operation and technology"** שאוסר חשיפת המודלים/הספריות/ה-API
  שמפעילים את Ghost.
- `build_prompt(...)` — בונה את רשימת ה-messages: System (time header +
  identity + language instruction + system_prompt) → `## Relevant Memories`
  → `## Camera Observation Log` (`_render_observation_log`, budget 1500
  tokens) → `## Relevant Knowledge` → `## Object Tracking Log`
  (`_render_tracking_log`, budget 2500 tokens — מוזרק רק כשאין תמונה) →
  few-shot (כשיש תמונה) → היסטוריה עם `[HH:MM]` (budget 80k tokens) →
  ההודעה הנוכחית.
- `build_site_intelligence_prompt(image_base64)` — בונה prompt נפרד
  (`SITE_INTELLIGENCE_SYSTEM`) שמכריח דוח מודיעיני מובנה ארוך (כותרות,
  סעיפים, ≥600 מילים), עם few-shot של הפורמט המדויק. עוקף את `GHOST_IDENTITY`.

#### `chat_service.py`

הפונקציה הראשית **`handle_send_message(..., mode="chat")`** היא generator
אסינכרוני שמוציא event strings ב-SSE format. סדר ההחלטה:

1. ולידציה (שיחה + API key).
2. **Tech-Probe Lockdown (layer 2):** אם `_looks_like_tech_probe(content)` —
   חוסם לפני קריאה למודל, שומר את ההודעה, ומחזיר אזהרת אבטחה אדומה עם
   `_SECURITY_MARKER` (ראו 6.7).
3. אם `mode == "site_intelligence"` ויש תמונה → `_handle_site_intelligence_message`.
4. אם יש `camera_frames` → `_handle_multi_camera_message`.
5. אחרת זרימת טקסט/פריים יחיד: שמירת user message, שמירת פריים לדיסק (אם יש),
   שליפת היסטוריה (24h) + זיכרונות + ידע + visual observations/entities, וכן
   **`detected_objects`** (כשאין תמונה — מוזרקים כ-Object Tracking Log).
6. `build_prompt(...)` ואז `_stream_with_refusal_guard(...)`.
7. בסיום שומרים assistant message, שולחים `event: done`, ומריצים background
   tasks: `_background_memory_extraction` ו-(אם תמונה) `_background_visual_memory`.

**`_stream_with_refusal_guard(...)`** (Refusal Guard + Tech-Leak backstop):
- **תורי טקסט (ללא תמונה):** מבפר את **כל** התשובה (`_stream_text_guarded`),
  ואז: אם זוהה tech-leak → מחליף באזהרת אבטחה; אם זוהה סירוב → `_GHOST_REFUSAL_REPLACEMENT`;
  אחרת re-emit ב-chunks של 60 תווים (לשמר תחושת streaming).
- **תורי vision:** streaming עם sniff של 240 התווים הראשונים; בסירוב — fallback
  ל-`structured_vision_analysis` → `render_scene_analysis_markdown`.

פונקציות עזר נוספות:
- `_handle_multi_camera_message` — תור נפרד לכל מצלמה (כמתואר בגרסה הקודמת).
- `_handle_site_intelligence_message` — סריקה חד-פעמית, `max_tokens=8192`,
  בלי refusal guard/היסטוריה/זיכרון.
- `handle_broadcast_message(...)` — שידור ephemeral לכל מצלמה ללא שמירה
  (משמש את `/api/broadcast/messages`).

#### `memory_service.py`, `knowledge_service.py`, `file_parser.py`,
`visual_memory_service.py`

ללא שינוי מהותי: חילוץ/אחזור זיכרון, ingest/retrieval ידע, פרסור קבצים
וחיתוך ל-chunks, וחילוץ + איחוד ישויות חזותיות (ראו 6.1–6.3).

#### `alert_service.py` / `alert_queue.py` / `alert_broker.py`

- `scan_frame(...)` — בונה messages עם רשימת חוקים + תמונה (detail=low),
  מעביר ל-`AlertQueue` (token bucket + semaphore + dedup per-conversation +
  backoff), וקורא ל-`alert_vision_scan`. בהתאמה `confidence=high`: שומר event,
  מבזיק SSE דרך `AlertBroker`, שומר פריים ל-background, מוסיף הודעת assistant
  ייעודית, **ומתזמן `create_incident_from_alert`** של incident_service.
- `AlertQueue` — rate-limit + dedup (fast-path/slow-path/workers).
- `AlertBroker` — pub/sub פנים-תהליכי; כעת מפיץ שלושה סוגי payload:
  `alert_event`, `incident_event`, `incident_update`.

#### Object Tracking (מנוע חדש)

- `yolo_detector.py` — singleton lazy ל-`ultralytics.YOLO`. מקבל JPEG bytes,
  מריץ inference ב-thread, ומחזיר `YoloDetection[]` למחלקות מקובלות (person +
  כלי רכב). `crop_with_padding(...)` חותך bbox עם padding.
- `detection_service.py` — `scan_for_objects(...)`: מושהה אם השיחה ב-alert
  mode; מריץ YOLO; לכל זיהוי מחשב signature (camera+class+centroid bucket),
  מבצע dedupe מול pending+detected, ואז **dedupe ויזואלי מקומי**
  (`detection_visual_fingerprint`); ב-miss שומר crop ו-enqueue. כש-queue
  מגיע ל-target → `flush_batch`.
- `detection_visual_fingerprint.py` — fingerprint לכל crop (HSV histogram +
  dHash + thumbnail מבני), ו-`is_duplicate(...)` שמשווה NCC מבני (gate ראשי)
  או histogram-cosine + Hamming.
- `detection_collage.py` — `build_collage(...)` בונה רשת RTL של crops על קנבס
  לבן, עם badge של `tile_index` ו-timestamp לכל אריח.
- `tracking_collage_client.py` — `analyze_tracking_collage(...)` שולח את
  הקולאז' ל-Ghost Vision (gpt-5) עם `TRACKING_COLLAGE_SCHEMA` קשיח (פרופיל
  פורנזי per-tile, prompts עברית/אנגלית). לעולם לא זורק.
- `detection_batch_service.py` — `flush_batch(...)`: בונה collage, שומר ל-disk,
  יוצר `detection_batch`+`detection_event`, מנתח, ממפה כל tile ל-`detected_objects`,
  מנקה את ה-pending queue, ומבצע retention pruning ל-88 רשומות אחרונות.

#### `incident_service.py`

ראו 6.6. עיקריות: `create_incident_from_alert` (auto-merge בחלון 20s +
severity scoring), `transition_status`/`assign_incident`/`patch_incident`,
notes/evidence/close, `generate_incident_summary` (+schedule_summary),
`correlate_entities` (חיבור ל-Visual Memory לפי camera_label),
`ensure_investigation_conversation` (chat חקירה ייעודי), `fetch_kpi`. כל
מוטציה מפרסמת דרך ה-`AlertBroker`.

### 4.7. שכבת ה-Routes — ה-API

| Endpoint | מתודה | תיאור |
| --- | --- | --- |
| `/api/health` | GET | בריאות |
| `/api/users` | POST / GET | יצירה / רשימה |
| `/api/users/login` | POST | אימות (nickname + api_key) |
| `/api/users/{id}/magic-link` | POST | יצירת קישור התחברות חד-פעמי |
| `/api/users/login/magic` | POST | מימוש magic token → session |
| `/api/users/{id}` | PATCH | עדכון nickname/api_key |
| `/api/conversations` | POST / GET (`?user_id=&scope_ip=`) | יצירה / רשימה (scope לפי IP ל-trial) |
| `/api/conversations/{id}` | GET / PATCH / DELETE | קריאה / עדכון (כולל `accuracy_level`) / מחיקה (גם Chroma) |
| `/api/conversations/{id}/cameras` | GET / PUT / DELETE | setup מצלמות |
| `/api/conversations/{id}/messages` | POST | **שליחת הודעה — SSE** (chat / site_intelligence / multi-camera) |
| `/api/broadcast/messages` | POST | **שידור ephemeral** לכמה מצלמות (SSE) |
| `/api/conversations/{id}/messages` | GET | רשימת הודעות |
| `/api/conversations/{id}/memory` | GET | רשימת זיכרון |
| `/api/conversations/{id}/memory/{mid}` | DELETE | מחיקה (גם Chroma) |
| `/api/conversations/{id}/visual-memory` | GET | entities + observations + summary |
| `/api/knowledge/sources` | POST / GET | יצירה (file/text) / רשימה |
| `/api/knowledge/sources/{id}` | DELETE / PATCH | מחיקה / עדכון (reingest) |
| `/api/knowledge/sources/{id}/chunks` | GET | קריאת chunks |
| `/api/conversations/{id}/alerts/rules` | GET / POST | חוקים |
| `/api/alerts/rules/{id}` | PATCH / DELETE | עדכון/מחיקת חוק |
| `/api/conversations/{id}/alerts/mode` | PUT | הפעלת/כיבוי alert mode |
| `/api/conversations/{id}/alerts/scan` | POST | סריקת פריים (engine קורא בלולאה) |
| `/api/conversations/{id}/alerts/events` | GET | היסטוריית התראות |
| `/api/alerts/events/{id}/acknowledge` | POST | אישור התראה |
| `/api/alerts/queue/status` | GET | סטטוס ה-queue (debug) |
| `/api/users/{id}/alerts/stream` | **GET (SSE)** | push בזמן אמת: alert_event / incident_event / incident_update (keepalive 15s) |
| `/api/conversations/{id}/detection/scan` | POST | סריקת YOLO לפריים (engine בלולאה) |
| `/api/conversations/{id}/detection/mode` | GET / PUT | tracking on/off |
| `/api/conversations/{id}/detection/events` | GET | אירועי detection (batches) |
| `/api/conversations/{id}/detection/objects` | GET | אובייקטים שזוהו + summary |
| `/api/conversations/{id}/detection/batch` | GET | התקדמות תור crops + היסטוריה |
| `/api/conversations/{id}/detection/batch/target` | PUT | קביעת batch target (1..88) |
| `/api/conversations/{id}/detection/batch/flush` | POST | flush ידני של ה-batch |
| `/api/incidents` | GET (`?status=&severity=&assigned_to=&search=`) | רשימת אירועים |
| `/api/incidents/kpi` | GET | מדדי KPI (חלון שעות) |
| `/api/incidents/{id}` | GET / PATCH | קריאה מלאה / עדכון |
| `/api/incidents/{id}/assign` | POST | הקצאה |
| `/api/incidents/{id}/notes` | POST | הוספת הערה |
| `/api/incidents/{id}/evidence` | GET / POST | ראיות |
| `/api/incidents/{id}/close` | POST | סגירה (+סיכום AI אם אין resolution ידני) |
| `/api/incidents/{id}/timeline` | GET | timeline |
| `/api/incidents/{id}/correlated` | GET | ישויות מתואמות + מצלמות מומלצות |
| `/api/incidents/{id}/investigate` | POST | פתיחת chat חקירה ייעודי |
| `/api/incidents/{id}/summary` | POST | רענון סיכום AI |
| `/api/downloads/track` | POST | לכידת lead מהורדת מסמך (ציבורי) |
| `/api/downloads` | GET | ledger מתעניינים (תצוגה פנימית) |
| `/uploads/*` , `/api/frames/*` | static | קבצים + פריימים/crops/collages |

---

## 5. ה-Frontend

### 5.1. שתי אפליקציות — אתר שיווקי ומערכת תפעולית

ה-Vite בונה **שני entry points** (`vite.config.ts`):

- **`index.html` → `src/site/main-site.tsx` → `SiteApp.tsx`** — האתר השיווקי
  הציבורי (pre-login). מנהל state-machine של עמודים: `login` (Secure Access),
  `defense` (דף הבית — Defense Intelligence Brief), `security`
  (Information Security Architecture), `team`, `usecases`, `capabilities`
  (What Ghost Can Do), `drone` (LKM Drone), `talk` (Talk to Ghost — מתחיל
  Trial), `downloads` (Downloads Admin פנימי), `create`. כולל `LeadCapturePopup`
  שצף על עמודי תוכן, redemption של `?magic=<token>`, ו-hand-off ל-`/app.html`
  אחרי לוגין/trial.
- **`app.html` → `src/main.tsx` → `App.tsx`** — המערכת התפעולית
  (post-login). Auth-guard: ללא session — חזרה לאתר (`/`). ה-layout:
  `Sidebar` (נפתח/נסגר, רוחב מתכוונן), אזור מרכזי שמתחלף לפי `viewStore.mode`
  (`chat` / `incidents`), פאנלים צפים (Knowledge, Memory, Alert, Settings,
  SystemPrompt), `AlertOverlay` גלובלי, `IncidentWorkspace`/`IncidentCloseModal`,
  ו-Onboarding (Overlay/Hub/Launcher). מפעיל ב-mount את `startAlertEngine`,
  `startDetectionEngine`, `startAlertStream`, ו-`prewarmFaceBlur`.

> **הגדרות מוצר קבועות:** "דף הבית" = `DefenseIntelligencePage` (defense);
> "עמוד לוגין" = `LoginModal` (Secure Access). ראו `.cursor/rules/`.

### 5.2. שכבת ה-API Client

**`api/client.ts`** — `api` object עם כל הפונקציות. כל קריאה רגילה עוברת
`request<T>` שמחזיר `ApiResponse<T>`; כל הודעת שגיאה עוברת `sanitizeBrand()`.
`sendMessage(...)` ו-`broadcastMessage(...)` הם מקרים מיוחדים שמחזירים
`ReadableStream<ChatStreamEvent>` שעוטף את ה-SSE (token / user_message /
camera_start / camera_done / done). העלאות קבצים דרך `FormData`.

### 5.3. State Management — Zustand Stores

| Store | תפקיד עיקרי |
| --- | --- |
| `userStore` | משתמשים, `activeUserId`, `isAuthenticated`, `expiresAt`; `loginUser`, `loginWithMagicToken`, `startTrialSession`, `logout`, `clearExpiredSession` |
| `conversationStore` | שיחות + `activeConversationId` + CRUD + `accuracy_level` |
| `conversationGroupsStore` | קבוצות/אזורים בסיידבר (גרירה ב-dnd-kit) |
| `messageStore` | הודעות, streaming state, `sendMessage(...)` (SSE + sanitize refusal) |
| `broadcastStore` | scope פעיל לשידור + תוצאות per-camera |
| `knowledgeStore` | מקורות ידע + פעולות |
| `liveStore` | מצלמות פעילות/שמורות לשיחה, טוגל בורר מצלמות |
| `alertStore` | חוקים, `alertModeEnabled`, `activeAlert`, scanning; `submitScan`, `_receivePushedEvent`, `acknowledgeAlert` |
| `alertRuntimeStore` | מצב runtime של מנוע ההתראות (latency/health) |
| `detectionStore` | `trackingEnabled` per-conv, `submitScan`, `toggleTracking`, batch status |
| `incidentStore` | רשימת אירועים, פילטרים, KPI, `activeIncidentId`, פעולות + קליטת SSE |
| `onboardingStore` | סטטוס הסיור, chapter/step, hydrate, dismiss |
| `sidebarStore` | פתוח/סגור, רוחב, resizing |
| `siteSidebarStore` | מצב הסיידבר באתר השיווקי |
| `viewStore` | `mode` ∈ {chat, incidents} |
| `voiceStore` | מצב קלט קולי ל-Composer |
| `languageStore` | `locale` (`he`/`en`), `dir`, `toggle()` |
| `themeStore` | `theme` (`dark`/`light`) — localStorage |

### 5.4. Services — לוגיקה רקעית בדפדפן

- **`cameraStreamManager.ts`** — ניהול מצלמות persistent ומשותף עם refcounting
  + ring buffer של 3 פריימים; `snapshotLatest()` מיידי. כל הצרכנים (live
  preview, alert engine, detection engine) חולקים session אחד של `getUserMedia`.
- **`faceBlur.ts`** — `prewarmFaceBlur()` + `blurFacesInCanvas(canvas)` עם
  MediaPipe FaceDetector; כל פריים שעוזב את הדפדפן עובר טשטוש פנים מקומי.
- **`objectSegmenter.ts`** — segmentation בדפדפן (MediaPipe) לעיבוד ויזואלי.
- **`alertEngine.ts`** — לולאת alert per-conversation: בוחר מצלמה, snapshot →
  downscale → JPEG → `alertStore.submitScan`. `SCAN_INTERVAL_MS` קצר; gating
  per-conversation.
- **`alertLatencyTracker.ts`** — מדידת latency end-to-end של התראות.
- **`alertCameraTest.ts`** — בדיקת תקינות מצלמה למצב התראה.
- **`detectionEngine.ts`** — לולאת tracking per-camera: snapshot →
  `blurFacesInCanvas` → motion gate (luma) → JPEG (עד 2560px, quality 1.0) →
  `detectionStore.submitScan` → `/detection/scan`. **מושהה כל עוד alert mode
  פעיל באיזושהי שיחה** (עדיפות להתראות). auto-disable אחרי 6 כשלים רצופים.
- **`alertStream.ts`** — EventSource יחיד ל-`/api/users/{id}/alerts/stream`;
  מנתב `alert_event` → alertStore, ו-`incident_event`/`incident_update` →
  incidentStore. reconnect עם backoff מעריכי.

### 5.5. Components — רכיבי ה-UI

```
components/
├── auth/                     ← אתר שיווקי + לוגין
│   ├── DefenseIntelligencePage.tsx   (דף הבית)
│   ├── SecurityArchitecturePage.tsx
│   ├── UseCasesPage.tsx / WhatGhostCanDoPage.tsx / TeamPage.tsx
│   ├── DroneDetectionPage.tsx / TalkToGhostPage.tsx
│   ├── DownloadsAdminPage.tsx        (תצוגת leads פנימית)
│   ├── LoginModal.tsx (Secure Access) / TerminalLoginModal.tsx
│   ├── CreateUserModal.tsx / LeadCapturePopup.tsx / TrialLeadGate.tsx
│   ├── SiteSidebar.tsx / SplashScreen.tsx / CRT.tsx
├── capabilities/demos/       ← דמואים אינטראקטיביים (Alerts, Broadcast,
│                                ChatThread, Composer, LiveCamera, Memory,
│                                Sidebar, SiteIntelligence, SystemPrompt)
├── sidebar/                  ← Sidebar + ConversationList/Item + Groups tree
│                                (AreaNode/GroupNode, AddToGroupModal, dnd-kit)
├── chat/                     ← ChatArea, ChatHeader, MessageList, MessageBubble,
│                                LoadingIndicator, CameraSelector,
│                                LiveCameraStage, BroadcastChatArea
├── composer/Composer.tsx     ← כתיבה + שליחה + live cameras + voice
├── incidents/                ← IncidentBoard/Column/Card, IncidentWorkspace,
│                                Timeline, Notes, Evidence, KPIBar, Filters,
│                                InvestigationChat, CloseModal, SeverityBadge
├── knowledge/                ← KnowledgePanel + Source items + Upload/Edit
├── alerts/                   ← AlertModePanel + AlertOverlay
├── onboarding/               ← OnboardingOverlay / Hub / Launcher
├── settings/                 ← SettingsPanel, SystemPromptEditor, UserSelector,
│                                VoiceCommandSection, QuickLoginLinkSection
└── shared/                   ← ErrorBanner, ErrorBoundary, MemoryPanel
```

מפתחות חשובים:

- **`MessageBubble`** — מזהה הודעות מיוחדות: alert (prefix `⚠️ התראה זוהתה!`)
  עם כרטיס ייעודי, ו-security-block (prefix `[[GHOST_SECURITY_BLOCK]]`) עם
  כרטיס אדום של "מידע מסווג". להודעות רגילות — Markdown + code highlighting.
- **`MessageList`** — auto-scroll + "Jump to latest" + מציאת תמונת המקור.
- **`Composer`** — צילום אוטומטי (`captureMultiFrame`) במצב Live + קלט קולי.
- **`IncidentBoard` / `IncidentWorkspace`** — לוח אירועים (קנבן עם dnd-kit)
  + מגירת עבודה עם timeline, ראיות, הערות, סיכום AI, ו-chat חקירה.
- **`AlertOverlay`** — overlay אדום מהבהב בכל המסך כשיש `activeAlert`.

### 5.6. Utilities, Hooks ו-Data

- **`utils/sanitize.ts`** — `sanitizeBrand()` (החלפת "OpenAI"→"Ghost") +
  `sanitizeRefusal(text, locale)` (שכבת הגנה 2).
- **`utils/textDirection.ts`** — `detectDirection(text)`.
- **`utils/i18n.ts`** — מילון `he`/`en` + `useT()`.
- **`utils/cameraCapture.ts`** — `captureFrame` (פריים יחיד, warmup) ו-
  `captureMultiFrame` (collage של 3 פריימים, מטשטש פנים). מזין את Site
  Intelligence ואת ה-Composer.
- **`utils/conversationGroups.ts` / `conversationOrder.ts`** — לוגיקת קבוצות
  וסדר בסיידבר.
- **`hooks/`** — `useDocumentChrome` (סנכרון dir/lang/theme), `useVoiceComposer`,
  `useAccessChord` (קיצור מקלדת נסתר), `useConversationCameraThumbnail`.
- **`data/capabilities.ts`, `data/useCases.ts`** — תוכן עמודי האתר.
- **`config/demoAccess.ts`** — שליטה בגישה לדמואים.
- **`onboarding/tourSteps.ts`, `useTourAnchor.ts`** — הגדרת צעדי הסיור.

### 5.7. Design System

**`design/tokens.ts`** — קונסטנטות צבעים/ספייסינג/רדיוסים/טיפוגרפיה,
מתואמות ל-CSS variables ב-`index.css`. **`tailwind.config.js`** — צבעי Ghost,
גופן `Inter`, ו-utilities (`max-w-chat`, `w-sidebar`). ברירת מחדל **dark
mode** מינימליסטי; light זמין דרך `themeStore`.

---

## 6. מנועים מרכזיים — Deep Dive

### 6.1. Memory Engine — מנוע הזיכרון

חילוץ אוטומטי (background, gpt-4o-mini) של פריטי זיכרון מתור שיחה → שמירה
ב-`memory_items` + embedding ב-Chroma. בשיחה הבאה `retrieve_relevant`
מאחזר top-5 לפי דמיון סמנטי ומזריק תחת `## Relevant Memories`. מחיקת שיחה
מוחקת גם את הקולקציה ב-Chroma.

### 6.2. Knowledge Engine — בסיס הידע

העלאת קובץ/טקסט → `file_parser` → `chunk_text` (500 tokens, overlap 50) →
embeddings → SQLite + Chroma. ב-`handle_send_message` נשלף top-5 ומוזרק תחת
`## Relevant Knowledge`. עדכון טקסט קיים: `re_ingest_text`.

### 6.3. Visual Memory — זיכרון חזותי

אחרי כל תיאור סצנה, `extract_visual_observations` (gpt-4o-mini, JSON schema)
מפיק תצפיות; `_build_signature` מחשב חתימה דטרמיניסטית ו-`upsert_entity` מאחה
ישויות חוזרות (אותו אדם בכמה מצלמות) ל-`visual_entities`. ב-`build_prompt`,
`_render_observation_log` מזריק את `## Camera Observation Log` (ground truth,
budget 1500 tokens). נצרך גם ב-`MemoryPanel` וב-`/visual-memory`.

### 6.4. Alert Engine — מנוע ההתראות

ניטור רציף של מצלמה מול חוקי טקסט חופשי. `alertEngine.ts` (frontend) דוגם
פריימים → `/alerts/scan`; `alert_service.scan_frame` מעביר ל-`AlertQueue`
(token bucket + semaphore + dedup + backoff) ול-`alert_vision_scan`
(gpt-4o-mini, JSON schema, detail=low). בהתאמה `confidence=high`: נוצר event,
מובזק SSE דרך `AlertBroker`, נשמר פריים, נוספת הודעת assistant, **ומתוזמן
אירוע מנוהל** (`create_incident_from_alert`). יעד latency end-to-end ≤2.8s.

> **עדיפות:** כל עוד alert mode פעיל באיזושהי שיחה — מנוע ה-tracking הכבד
> (YOLO + gpt-5 collage) מושהה לחלוטין, גם ב-frontend (`detectionEngine.syncLoops`)
> וגם ב-backend (`scan_for_objects` מחזיר `paused_for_alert`), כדי לא להתחרות
> על חשבון ה-OpenAI ועל המצלמה.

### 6.5. Object Tracking Engine — YOLO מקומי + Collage

**מטרה:** לעקוב באופן רציף אחר אנשים ורכבים, להפיק לכל אחד פרופיל פורנזי
עמוק, ולמלא Object Tracking Log שמאפשר ל-Ghost לענות "מי עבר / אילו רכבים
ראינו / באיזו שעה" גם כשהמצלמה לא פעילה.

**זרימה per-frame:**

```
detectionEngine.ts (frontend, loop per camera)
   snapshot → face blur → motion gate (luma) → JPEG(≤2560px, q=1.0)
        │
        ▼ POST /detection/scan
detection_service.scan_for_objects(db, ...)
   ├─ paused אם alert mode פעיל
   ├─ YOLO inference מקומי (ultralytics, thread)  → YoloDetection[]
   ├─ לכל זיהוי:
   │   signature = camera::class::centroid_bucket
   │   dedupe מול pending + detected (cooldown 180s)
   │   crop_with_padding (in-memory)
   │   compute_fingerprint (HSV hist + dHash + thumb)
   │   is_duplicate? (NCC מבני ≥0.80  OR  hist-cosine + Hamming)  → skip
   │   else: שמירת crop PNG + insert_pending_crop
   └─ אם pending_count ≥ target → flush_batch
        │
        ▼ detection_batch_service.flush_batch(...)
   build_collage(RTL, tiles עם badge tile_index + timestamp)
   create_batch + create detection_event (collage frame)
   analyze_tracking_collage → gpt-5 + TRACKING_COLLAGE_SCHEMA (פרופיל per-tile)
   לכל tile → insert_detected_object_with_batch (person/vehicle profile)
   delete_pending_crops + retention pruning (≤88 רשומות)
```

**הזרקה לפרומפט:** ב-`build_prompt`, כשאין תמונה בתור הנוכחי,
`_render_tracking_log(detected_objects)` מזריק `## Object Tracking Log`
(budget 2500 tokens) עם שעה, סוג, מאפיינים, פעילות, לוחית, ומצלמה.

**API:** `/detection/{scan,mode,events,objects,batch,batch/target,batch/flush}`.
ה-`MemoryPanel` מציג את ההתקדמות (`N / X` collected) ואת ה-"send now".

### 6.6. Incident Management — ניהול אירועים

**מטרה:** להפוך כל התראה לאירוע מנוהל מלא עם מחזור חיים אופרטיבי.

- **יצירה:** `create_incident_from_alert` נקרא מ-`alert_service` אחרי כל
  event. תחילה **auto-merge** — אם יש אירוע פתוח מאותה מצלמה בחלון 20s,
  ההתראה החדשה מתמזגת אליו כראיה (במקום ליצור כפילות). אחרת: severity scoring
  ע"י AI (gpt-4o-mini → low/medium/high/critical + reasoning + tags), יצירת
  `incident_events` עם סטטוס `new`, רישום activity, וצירוף הפריים כראיה.
- **מחזור חיים:** סטטוסים `new → handling → investigation → closed`; הקצאה
  למשתמש; הערות; ראיות (snapshot/alert/observation/entity); סגירה עם
  resolution ידני **או** סיכום AI (`generate_incident_summary`).
- **קורלציה:** `correlate_entities` מחבר את האירוע ל-Visual Memory לפי
  `camera_label` ומציע מצלמות נוספות לבדיקה.
- **חקירה:** `ensure_investigation_conversation` יוצר שיחת chat ייעודית עם
  system prompt ממוקד-אירוע.
- **Real-time:** כל מוטציה מפרסמת `incident_event` / `incident_update` דרך
  `AlertBroker` → אותו SSE stream של ההתראות → `incidentStore`. ה-UI:
  `IncidentBoard` (קנבן), `IncidentWorkspace`, `IncidentKPIBar`.

### 6.7. Refusal Guard ו-Tech-Probe Lockdown

**Refusal Guard (דו-שכבתי)** — מיירט תשובות סירוב גנריות:
- **Backend (`chat_service`):** `_REFUSAL_PATTERNS` (regex EN+HE). תורי טקסט
  מבופרים במלואם ונבדקים; תורי vision עם sniff של 240 תווים + fallback
  ל-`structured_vision_analysis`. ההחלפה: `_GHOST_REFUSAL_REPLACEMENT`.
- **Frontend (`utils/sanitize.ts`):** `sanitizeRefusal` כרשת ביטחון
  ב-`messageStore` לפני שמירה.

**Tech-Probe Lockdown (תלת-שכבתי)** — הטכנולוגיה שמאחורי Ghost מסווגת. כל
ניסיון לחשוף "איך אתה עובד / איזה מודל / מי בנה אותך / YOLO / OpenAI / GPT
..." נחסם:
1. **System prompt** — סעיף "Classified" ב-`GHOST_IDENTITY`.
2. **Input detector** — `_looks_like_tech_probe(content)` חוסם **לפני**
   קריאה למודל, ושולח אזהרת אבטחה אדומה עם `_SECURITY_MARKER`
   (`[[GHOST_SECURITY_BLOCK]]`).
3. **Output backstop** — `_looks_like_tech_leak` סורק את התשובה המלאה; אם
   דלף שם מודל/ספרייה/ספק — כל התשובה מוחלפת באזהרה.

הדפוסים מכסים עברית ואנגלית, שמות ספקים/מודלים (open ai, gpt, llm/vlm),
ומחסניות vision/tracking/OCR (yolo, deep sort, byte track, opencv, pytorch
וכו'). ה-`MessageBubble` מרנדר את ההודעה החסומה ככרטיס אדום של "מידע מסווג".

### 6.8. Site Intelligence ו-Broadcast

- **Site Intelligence** — `mode="site_intelligence"` ב-`SendMessageRequest`
  מפעיל את `_handle_site_intelligence_message`: סריקת פריים בודד עם
  `build_site_intelligence_prompt` (system prompt נפרד שמכריח דוח מודיעיני
  מובנה ≥600 מילים, כותרות וסעיפים), `max_tokens=8192`, ללא refusal
  guard/היסטוריה/זיכרון. הפלט מתאים לייצוא PDF. ב-frontend מופעל מכפתור
  "סריקת סביבה".
- **Broadcast** — `/api/broadcast/messages` → `handle_broadcast_message`:
  שאלה אחת מפוזרת לכל מצלמות ה-scope, תשובה נפרדת לכל מצלמה דרך אותם events
  של ה-SSE, **ללא שמירה** (אין שיחה, הודעות, visual memory או פריימים על
  דיסק). ה-UI: `BroadcastChatArea` + `broadcastStore`.

---

## 7. זרימות End-to-End

### 7.1. Login / Trial / Magic-Link

- **Login רגיל:** `SiteApp` (login) → `api.loginUser(nickname, apiKey)` →
  `verify_user` (decrypt + compare) → session ב-`userStore` → navigation
  ל-`/app.html`.
- **Magic-link:** `POST /users/{id}/magic-link` מחזיר `?magic=<token>`.
  ה-`SiteApp` מזהה את ה-param ב-boot, קורא `loginWithMagicToken` →
  `/users/login/magic` (`consume_magic_token`, חד-פעמי) → hand-off לאפליקציה.
- **Trial:** `TalkToGhostPage` (אחרי lead gate) → `startTrialSession` →
  login ל-agent דמו, סימון session כ-trial (`expiresAt` ~8 דק'), scope לפי
  IP (`scope_ip=1` ב-`list_conversations`). אותו shell תפעולי בדיוק.

### 7.2. שליחת הודעת טקסט / פריים

`Composer` → `messageStore.sendMessage` (optimistic) → `POST /messages` (SSE)
→ `handle_send_message`: tech-probe check → build_prompt (memories + visual
log + knowledge + tracking log) → `_stream_with_refusal_guard` → tokens →
`done` → background memory/visual extraction. עם פריים: `captureMultiFrame`
(collage), שמירה לדיסק, few-shot + `image_url` (detail=high).

### 7.3. Multi-Camera

`Composer` מזהה Live עם >1 מצלמות → `captureMultiFrame` לכל מצלמה →
`camera_frames[]` → `_handle_multi_camera_message`: הודעת user אחת, תור נפרד
לכל מצלמה (`camera_start`/`token`/`camera_done`), visual memory per-camera.

### 7.4. Alert Mode → Incident

Toggle ב-`AlertModePanel` → `PUT /alerts/mode` → `detectionEngine` משהה את
לולאות ה-tracking → `alertEngine` דוגם פריימים → `/alerts/scan` →
`AlertQueue` → `alert_vision_scan`. `confidence=high`: event + הודעת
assistant + `AlertBroker.publish(alert_event)` + `create_incident_from_alert`
→ `incident_event`. ה-SSE מזין את `AlertOverlay` (מיידי) ואת `IncidentBoard`.

### 7.5. Object Tracking

תואר במלואו ב-6.5: לולאת `detectionEngine` → YOLO מקומי → dedupe → תור crops
→ flush ל-collage → `gpt-5` profiling → `detected_objects` → Object Tracking
Log בפרומפט.

### 7.6. Site Intelligence / Broadcast

ראו 6.8.

### 7.7. "מתי ראית..." — קונטקסט זמני

`_current_time_header()` + prefix `[HH:MM]` לכל הודעה היסטורית + סעיף
"Temporal Awareness" ב-`GHOST_IDENTITY` + שעות מדויקות ב-Camera Observation
Log ו-Object Tracking Log.

---

## 8. אבטחה, פרטיות וקונפיגורציה

### הצפנה ואימות
- **API keys** של OpenAI מוצפנים ב-Fernet (`users.api_key_encrypted`); המפתח
  `ghost_master_key` מ-`.env` (חובה ערך תקני בייצור).
- אין session/JWT. ה-`user_id` הוא bearer token שקוף בכל בקשה; גישה לשיחה
  נבדקת ב-`get_conversation(id, user_id=...)`.
- **Magic-link** — token חד-פעמי מוגבל-זמן (`magic_login_tokens`), נצרך פעם
  אחת; כשלים ממופים ל-401 גנרי.
- **Trial** — session מוגבל-זמן (`expiresAt`), והשיחות scoped לפי `origin_ip`
  (נגזר server-side מ-`X-Forwarded-For`/peer, לא ניתן לזיוף).

### Tech-Probe Lockdown
- שלוש שכבות שמונעות חשיפת המודלים/הספריות/ה-API שמפעילים את Ghost (ראו 6.7).
  כל ניסיון נחסם ומתועד; כלפי המשתמש נחשף מותג Ghost בלבד.

### Branding
- המילה "OpenAI" אסורה ב-UI; כל טקסט דינמי מ-Backend עובר `sanitizeBrand()`.
  מפתח API נקרא "Ghost API Key". (מסמך הנדסי זה מתעד את הטכנולוגיה האמיתית.)

### פרטיות
- **Face blur** מקומי (MediaPipe) על כל פריים שעוזב את הדפדפן (Composer + שני
  המנועים).
- **Local-First** — כל המידע ב-`backend/data/`; מחיקת שיחה אטומית (SQLite
  CASCADE + Chroma); YOLO רץ מקומית.
- **Download leads** — נלכדים מהאתר השיווקי עם IP + geolocation; נחשפים רק
  בתצוגה הפנימית `/downloads`.

### תקשורת ופריסה
- dev: backend על `127.0.0.1:8000`, frontend על `:8888` (HTTPS, proxy ל-`/api`).
- prod: Firebase Hosting + Cloud Run (`ghst-api`), origin משותף דרך rewrites;
  CORS כרשת ביטחון.

### שפה
- ברירת מחדל עברית RTL; כל בקשה כוללת `locale`. `prompt_builder` אוכף תשובה
  בשפת הממשק דרך `_LANGUAGE_INSTRUCTION`.

---

## 9. פיתוח, ריצה ו-Deploy

### הקמת Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt        # כולל ultralytics/torch ל-YOLO

cp .env.example .env
# ערוך .env — GHOST_MASTER_KEY (חובה!), OPENAI_API_KEY (אופציונלי default),
# GHOST_VISION_MODEL (ברירת מחדל gpt-5) וכו'.

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

המיגרציות (001..018) רצות אוטומטית ב-startup. משקלי YOLO יורדים אוטומטית
ל-`data/models/` בקריאה הראשונה.

### הקמת Frontend

```bash
cd frontend
npm install            # postinstall מעתיק את ה-MediaPipe WASM
npm run dev            # vite על http://localhost:8888
```

ה-Vite פותח proxy אוטומטי ל-backend (`/api` → `:8000`). שני builds:
`index.html` (אתר שיווקי) ו-`app.html` (מערכת תפעולית). `npm run build`
מריץ `tsc -b && vite build` ומפיק `dist/` לפריסה.

### Deploy לענן

- `firebase deploy` (project `ghst-rashi`) מעלה את `frontend/dist` ל-Hosting;
  `/api/**` ו-`/uploads/**` מנותבים ל-Cloud Run service `ghst-api`
  (us-central1) דרך rewrites ב-`firebase.json`.
- ה-backend הכבד (torch/YOLO + ChromaDB + SSE) רץ כ-container ב-Cloud Run.
- skill `rashi-deploy` מתזמר את כל הזרימה ("גו דיפלוי"); `scripts/deploy-firebase.sh`
  עוטף את צד ה-Hosting.

### Cursor Skills פעילים בפרויקט

- `8go-restart` / `open-in-cursor-browser` — ריסטארט/פתיחה של סביבת dev
  (backend 8000, frontend 8888) בדפדפן Cursor.
- `rashi-deploy` — דיפלוי מלא ל-Firebase + Cloud Run.
- `omer-efforts-tracker` — תיעוד כל משימה ב-`omer_efforts.md`.

### Logging
- loggers ייעודיים: `ghost`, `ghost.chat`, `ghost.detection`, `ghost.yolo`,
  `ghost.detection.batch`, `ghost.incident_service`, `ghost.tracking_collage`,
  `ghost.alert_*`, `ghost.store.*`, `ghost.openai`. רמת ברירת מחדל `INFO`.

---

## 10. מילון מונחים מהיר

| מונח | משמעות בפרויקט |
| --- | --- |
| **Ghost** | המוצר / אישיות ה-AI (צופה לילה) |
| **Conversation** | יחידת שיחה — הודעות, מצלמות, ידע, זיכרון, חוקי התראה, accuracy_level |
| **Accuracy Level** | רמת דיוק (1–4) per-conversation שממפה למודל chat |
| **Memory** | פיסת מידע מובנית שחולצה אוטומטית מתור שיחה |
| **Knowledge / Chunk** | מסמך שהועלה / חתיכת 500 tokens — יחידת retrieval |
| **Visual Observation / Entity** | תצפית בודדת / ישות חזותית מאוחדת לפי signature |
| **Alert Rule / Event** | חוק התראה בטקסט חופשי / מופע זיהוי שלו |
| **Alert Mode** | טוגל per-conversation לניטור מצלמה רציף |
| **Object Tracking** | זיהוי YOLO מקומי + dedupe + collage batch → פרופיל פורנזי |
| **Pending Crop / Batch / Collage** | crop בתור / קבוצת crops / רשת RTL שנשלחת ל-Vision |
| **Visual Fingerprint** | HSV histogram + dHash + thumbnail מבני ל-dedupe מקומי |
| **Incident** | אירוע מנוהל שנוצר מהתראה (severity, status, assignment, evidence) |
| **Site Intelligence** | סריקת פריים בודד → דוח מודיעיני פורמלי (PDF-ready) |
| **Broadcast** | שידור ephemeral של שאלה לכל מצלמות אזור/קבוצה |
| **Live Mode** | מצב בו ה-Composer מצלם פריים אוטומטית בכל שליחה |
| **collage** | פריים-מורכב מכמה צילומים (מצלמה: 3 פריימים; tracking: רשת crops) |
| **Face Blur** | טשטוש פנים מקומי (MediaPipe) לפני שפריים עוזב את הדפדפן |
| **SSE** | Server-Sent Events — tokens / alert_event / incident_event/_update |
| **Refusal Guard** | שתי שכבות שמיירטות סירובי AI ומחליפות בהודעת Ghost |
| **Tech-Probe Lockdown** | שלוש שכבות שמונעות חשיפת הטכנולוגיה שמאחורי Ghost |
| **Magic-Link** | קישור התחברות חד-פעמי מוגבל-זמן |
| **Trial Session** | גישת ~8 דקות ציבורית, scoped לפי IP |
| **Download Lead** | מתעניין שנלכד בהורדת מסמך מהאתר השיווקי |
| **Fernet / Chroma / Embedding** | הצפנת API keys / מסד וקטורי / וקטור סמנטי |
| **YOLO (ultralytics)** | מודל זיהוי אובייקטים מקומי (CPU/MPS), lazy-loaded |

---

> **סיכום בשורה אחת:** Ghost הוא פלטפורמת מודיעין מצלמות מקומית — צ'אט-AI
> שמתאר סצנות, עם זיכרון סמנטי, בסיס ידע, זיכרון חזותי, מנוע התראות בזמן אמת,
> מנוע tracking מקומי (YOLO + collage), ניהול אירועים מלא, דוחות Site
> Intelligence ושידור — ועם אתר שיווקי ציבורי, הכל נפרס על Firebase + Cloud
> Run, עם OpenAI כתלות החיצונית היחידה ו-Tech-Probe Lockdown ששומר את
> הטכנולוגיה מסווגת כלפי המשתמש.
