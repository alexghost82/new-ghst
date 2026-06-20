# פאנל הזכרון של Ghost — איך זה עובד מאחורי הקלעים

מסמך זה מסביר בפשטות ולעומק את כל תהליך העבודה מאחורי **פאנל הזכרון** (`MemoryPanel`),
על שלוש הכרטיסיות שלו: **Tracking (טרקינג)**, **Observations (תצפיות)**, ו-**Facts (עובדות)**.
המסמך מתאר את הקוד הקיים בלבד — לא נעשה בו שום שינוי קוד.

> מקור האמת בקוד: `frontend/src/components/shared/MemoryPanel.tsx` (ה-UI),
> ושכבות ה-backend תחת `backend/app/services/` ו-`backend/app/storage/`.

---

## 1. תמונת על — שלוש כרטיסיות, שלושה מנגנונים שונים לגמרי

הפאנל נראה כמו רכיב אחד עם שלוש לשוניות, אבל **כל לשונית מוזנת ממקור מידע אחר לחלוטין**.
זו נקודת המפתח להבנת המערכת:

| כרטיסייה | מה מוצג | מאיפה המידע מגיע | מי "כותב" אליה |
| --- | --- | --- | --- |
| **Tracking** | אנשים / רכבים / אובייקטים שזוהו בפריים של המצלמה, עם תמונות תקריב | זרם וידאו חי → זיהוי YOLO מקומי → ניתוח Vision על קולאז' | מנוע הטרקינג הרץ ברקע בדפדפן (`detectionEngine.ts`) |
| **Observations** | תיאורים מילוליים של ישויות (אדם/רכב/סביבה/אובייקט) שחולצו מתשובות ה-AI | טקסט התשובה של ה-AI בצ'אט (אחרי שניתח פריים) | חילוץ LLM ברקע אחרי כל תשובת AI עם תמונה (`visual_memory_service.py`) |
| **Facts** | עובדות / העדפות / הוראות / ישויות מהשיחה הטקסטואלית | טקסט השיחה (הודעת משתמש + תשובת AI) | חילוץ LLM ברקע אחרי כל הודעה (`memory_service.py`) |

ההבדל המהותי:
- **Tracking** מבוסס **ראייה ממוחשבת מקומית (YOLO)** + שליחת אצווה (batch) ל-Vision. הוא "רואה" בעצמו.
- **Observations** ו-**Facts** הם **חילוץ מובנה (structured extraction)** מטקסט שכבר נוצר. הם "קוראים" טקסט קיים והופכים אותו לרשומות מובנות.

ה-`MemoryPanel` עצמו רק **קורא ומציג** את שלושת המקורות. הוא לא יוצר מידע — הוא צרכן.

```68:68:frontend/src/components/shared/MemoryPanel.tsx
type Tab = "tracking" | "observations" | "facts";
```

טעינת הנתונים בכל כרטיסייה (שלושה `useEffect` נפרדים):
- `api.getMemoryItems(...)` → כרטיסיית **Facts**.
- `api.getVisualMemory(...)` → כרטיסיית **Observations** (מחזיר `observations` + `entities`).
- `fetchObjects(...)` + `fetchBatchStatus(...)` מתוך `detectionStore` → כרטיסיית **Tracking**.

---

## 2. כרטיסיית Tracking — המסלול המלא מהמצלמה ועד הכרטיסייה

זה המנגנון המורכב ביותר. נפרק אותו לשלבים לפי "מי עושה מה".

### 2.1 שלב הדפדפן — לולאת הזיהוי (`detectionEngine.ts`)

כשמדליקים את מתג ה-Tracking בכרטיסייה, נקרא `toggleTracking` ב-`detectionStore`, שמסמן
את השיחה כ-`trackingEnabled`. מנוע הזיהוי הוא **singleton** שמריץ **לולאה אחת לכל מצלמה מחוברת**.

לכל לולאה (`runCameraLoop`) יש מחזור קבוע:

1. **רכישת זרם המצלמה** דרך `cameraStreamManager.acquire` — מנגנון refcount שמשתף את אותו
   `getUserMedia` עם מנוע ההתראות, התצוגה החיה, וכל צרכן אחר (כדי לא לפתוח את המצלמה פעמיים).
2. **צילום פריים** טרי מהזרם (`snapshotLatest`).
3. **טשטוש פנים** על הקנבס (`blurFacesInCanvas`) — לפני הכול, כדי שגם בדיקת התנועה וגם
   ההעלאה יראו את אותם בייטים מצונזרים.
4. **שער תנועה (motion gate)**: מחושב ממוצע בהירות (luma) על חיתוך מרכזי קטן. אם ההפרש
   מהפריים הקודם קטן מ-`MOTION_LUMA_THRESHOLD` (2.8) — הפריים מדולג. זה חוסך 70-80%
   מהקריאות כשהמצלמה רואה תמונה סטטית.
5. **קידוד JPEG** באיכות מקסימלית (`JPEG_QUALITY = 1.0`), כשהצלע הארוכה מוגבלת ל-2560px.
6. **שליחה** ל-backend דרך `submitScan` → `POST /conversations/:id/detection/scan`.
7. **שינה** של `SCAN_INTERVAL_MS` (800ms) ואז שוב.

```33:34:frontend/src/services/detectionEngine.ts
/** Period between scans for a single camera. */
const SCAN_INTERVAL_MS = 800;
```

מנגנון הגנה: אם לולאה נכשלת `AUTO_DISABLE_FAILURE_THRESHOLD` (6) פעמים ברצף — הטרקינג
נכבה אוטומטית לשיחה, כדי שהמשתמש יקבל אות ברור במקום כשל שקט.

### 2.2 שלב ה-backend לכל פריים — `scan_for_objects` (`detection_service.py`)

זה הלב של הזיהוי. לכל פריים שמגיע:

1. **פענוח** ה-JPEG ל-bytes. אם נכשל → `status: "no_motion"`.
2. **הרצת YOLO מקומי** (`detect_objects`) — מודל `yolov8n.pt` שנטען בעצלתיים (lazy) בתהליך עבודה
   נפרד כדי לא לחסום את ה-event loop. מסנן רק את המחלקות הרלוונטיות:
   `person, bicycle, car, motorcycle, bus, truck` (סף ביטחון `0.35`), וממפה אותן ל-enum
   הפנימי (`car`/`bus` → `vehicle` וכו').
3. אם אין זיהויים → `status: "no_objects"`.
4. **לכל זיהוי ששרד**, מחושבת **חתימת dedupe** (`_dedupe_signature`):
   `camera + class + centroid-bucket`. ה-centroid מחולק ל"דליים" של 64px, כך שאובייקט שעומד
   במקום מקבל את אותה חתימה ולא ממלא את התור שוב ושוב.

```77:93:backend/app/services/detection_service.py
def _dedupe_signature(
    *,
    camera_device_id: str | None,
    yolo_class: str,
    detection: YoloDetection,
    bucket_px: int,
) -> str:
    """``camera + class + centroid bucket`` — keeps a stationary subject
    from being enqueued repeatedly while still allowing genuine motion
    (different bucket) to refill the collage."""

    bucket = max(1, int(bucket_px))
    cx, cy = detection.centroid
    bx = int(cx // bucket)
    by = int(cy // bucket)
    cam = camera_device_id or "no_cam"
    return f"{cam}::{yolo_class}::{bx}_{by}"
```

5. **שני שערי dedupe לפי חתימה** (חלון cooldown של 12 שניות):
   - האם כבר קיים crop ממתין באותה חתימה? (`find_recent_pending_crop_signature`)
   - האם כבר נשמר אובייקט באותה חתימה? (`find_recent_object_dedupe`)
   אם כן — נספר כ-duplicate ומדולג.
6. **חיתוך (crop)** סביב ה-bbox עם padding קטן (8px), **בזיכרון בלבד** (עדיין לא נכתב לדיסק).
7. **טביעת אצבע ויזואלית (visual fingerprint)** — `detection_visual_fingerprint.py`. זהו שער
   ה-dedupe החכם, **ללא שום קריאת API**. מחושבים שלושה מרכיבים מהתמונה החתוכה:
   - `hist` — היסטוגרמת צבע HSV (72 ערכים) — תופסת את התפלגות הצבע הדומיננטי (לבוש/צבע רכב).
   - `dhash` — perceptual hash של 64 ביט — תופס את המבנה הגס (צללית).
   - `thumb` — תמונה ממוזערת אפורה 16x16 להשוואת מבנה פיקסלים ישירה (NCC).

   crop נחשב **אותו אובייקט** אם **או** ה-NCC המבני ≥ 0.80 (השער העיקרי — תופס סובייקט
   סטטי גם כשהתאורה זזה קצת), **או** קוסינוס ההיסטוגרמה ≥ 0.92 **וגם** מרחק האמינג של
   ה-dhash ≤ 12. זה מה שמכווץ אדם שעומד במקום ל-crop בודד בתוך חלון ה-dedupe.
8. אם עבר את כל השערים — ה-crop **נכתב לדיסק** כ-PNG, ונכנס לתור `detection_pending_crops`
   (`insert_pending_crop`) יחד עם ה-bbox, מטא-דאטה של המצלמה, החתימה, וה-fingerprint.

### 2.3 שלב האצווה — `flush_batch` (`detection_batch_service.py`)

ה-crops לא נשלחים ל-Vision אחד-אחד. הם **נצברים בתור** עד שמגיעים ל-target.

מתי נשלחת אצווה?
- **אוטומטית**: ברגע ש-`pending_count >= target_count` (ברירת מחדל 8, ניתן לכוון 1..88
   לכל שיחה). זה קורה בתוך אותו `scan_for_objects`.
- **ידנית**: בלחיצה על "שלח עכשיו" בכרטיסייה (`flushBatchNow` → `POST .../detection/batch/flush`).

מה קורה ב-`flush_batch` (תחת מנעול per-conversation כדי למנוע flush כפול):

1. שולפים את כל ה-crops הממתינים.
2. **בונים קולאז'** (`build_collage` ב-`detection_collage.py`): קנבס לבן, כל crop הופך לאריח
   ריבועי 224px עם letterboxing, מסודרים **מימין-לשמאל (RTL)** — אריח 0 בפינה הימנית-עליונה.
   על כל אריח מצויר **באדג' שחור עם מספר ה-`tile_index`** בפינה הימנית-עליונה, וחותמת זמן
   `HH:mm` בפינה השמאלית-עליונה.
3. הקולאז' נשמר לדיסק כ-PNG, ונוצרת רשומת `detection_batches` בסטטוס `sending`.
4. **שליחה ל-Vision** (`analyze_tracking_collage` ב-`tracking_collage_client.py`) עם prompt
   "פרופיילר פורנזי" + סכמת JSON קשיחה (`strict: true`). המודל מחזיר מערך `tiles`, רשומה
   לכל אריח, עם `tile_index`, `object_type`, `tracking_signature`, `deep_description`,
   `activity_description`, ופרופיל מלא (`person_profile` / `vehicle_profile`).
   ה-prompt העברי מחייב במפורש שכל שדות הטקסט יהיו **בעברית** (מלבד ערכי enum ו-snake_case).
5. **מיפוי חזרה**: לכל tile מה-Vision מאתרים את ה-placement לפי `tile_index`, ומשם את ה-crop
   המקורי (ומטא-דאטה של המצלמה). כל tile נשמר כשורת `detected_objects` (`_persist_tile`):
   - אם `tracking_signature` תואם אובייקט קיים בחלון ה-cooldown → משתמשים מחדש ב-`tracking_id`
     שלו (כך אותו אדם/רכב נשמר תחת אותה זהות).
   - ה-`frame_path` של השורה מצביע ל-URL ציבורי של ה-crop (`/api/frames/...`), וזו התמונה
     הממוזערת שתוצג בכרטיסייה.
6. **ניקוי תור**: שורות ה-`pending_crops` נמחקות (אבל קובצי ה-PNG של ה-crops **נשארים** —
   הם עכשיו התמונות הממוזערות שה-UI מציג).
7. **שמירה (retention)**: נשמרות רק 88 שורות `detected_objects` האחרונות לכל שיחה; ישנות
   יותר נמחקות יחד עם קובץ ה-crop שלהן, כדי שהדיסק לא יגדל לנצח.

### 2.4 שלב התצוגה — מה הכרטיסייה מציגה ומאיפה

`MemoryPanel` קורא מ-`detectionStore`:
- `detectedObjects` — שורות ה-`detected_objects` (נטענות דרך `fetchObjects`).
- `batchStatus` — `pending_count / target_count` + ההיסטוריה (נטען דרך `fetchBatchStatus`,
   ומתרענן כל 2.5 שניות כשהטרקינג דלוק).

ב-UI מוצגים:
- **מתג On/Off** (מושבת אם אין מצלמה מוגדרת — `trackingRequiresCamera`).
- **פס התקדמות אצווה** + שדה לכוונון גודל האצווה (1..88) + כפתור "שלח עכשיו".
- **חיפוש וסינון** (`all / person / vehicle / other`) — מסננים את `detectedObjects` בצד הלקוח
   בלבד (`filteredDetections`), כולל חיפוש חופשי על תיאור, לבוש, צבע, יצרן, לוחית וכו'.
- **שורות קומפקטיות** עם תמונה ממוזערת, סוג, זמן (HH:mm:ss), מצלמה, תיאור עמוק, פעילות,
   לוחית חלקית, וסימני זיהוי בולטים.

> נקודה חשובה: כל הזיכרון הזה הוא **per-conversation**. כל שיחה מנהלת תור crops, אצוות,
> ואובייקטים משלה. החלפת שיחה פעילה מחליפה את כל המידע שמוצג.

---

## 3. כרטיסיית Observations — חילוץ מובנה מתשובות ה-AI

בניגוד ל-Tracking, כאן אין YOLO ואין מצלמה ישירה. המקור הוא **טקסט התשובה של ה-AI**
אחרי שניתח פריים בצ'אט.

### 3.1 מתי נוצרות תצפיות

בכל פעם שה-AI מסיים תשובה על הודעה **שכללה תמונה** (`chat_service.py`), נורה task ברקע:

```234:245:backend/app/services/chat_service.py
    if image_base64:
        asyncio.create_task(
            _background_visual_memory(
                conversation_id=conversation_id,
                message_id=assistant_msg["id"],
                assistant_text=full_response,
                camera_label=None,
                camera_device_id=None,
                image_path=user_msg.get("image_path"),
                observed_at=assistant_msg["created_at"],
                api_key=api_key,
            )
        )
```

זה קורה גם בזרימת **ריבוי מצלמות** (`_handle_multi_camera_message`), שם כל מצלמה מקבלת
task נפרד עם ה-`camera_label` וה-`device_id` שלה. ה-task רץ **ברקע** ועל DB connection נפרד,
כך שכשל בחילוץ לעולם לא שובר את זרם ה-SSE שכבר חזר ללקוח.

### 3.2 איך מחלצים — `extract_observations` (`visual_memory_service.py`)

1. אם הטקסט הוא תבנית ה"סירוב המוחלף" של Ghost — מדלגים (אין מה לחלץ).
2. נשלחת קריאת LLM (`extract_visual_observations`, מודל `gpt-4o-mini`, `temperature=0`) עם
   סכמת JSON קשיחה. המודל מחזיר מערך `observations`, כל אחת עם `entity_type`
   (`person`/`vehicle`/`environment`/`object`), `description`, `visual_attributes`,
   `position_in_frame`, `direction`, `activity`, `confidence`, `semantic_tags`.
3. לכל תצפית:
   - מחשבים **חתימה קנונית** (`_build_signature`) שמעדיפה מאפיינים ויזואליים יציבים
     (צבע + תת-סוג + שיער פנים), כך שאותו אדם/רכב שנצפה שוב מתמזג לישות אחת.
   - **upsert לישות** (`upsert_entity` → טבלת `visual_entities`): אם החתימה קיימת — מעדכנים
     את `times_seen`, מוסיפים את המצלמה ל-`cameras_seen`, ממזגים `visual_attributes`,
     ומשדרגים את התיאור הקנוני רק אם החדש מפורט יותר (ארוך יותר). אם לא קיימת — נוצרת ישות חדשה.
   - **שמירת התצפית הגולמית** (`insert_observation` → טבלת `visual_observations`), מקושרת
     ל-`entity_id` ול-`message_id`.

### 3.3 איך הכרטיסייה מציגה

`api.getVisualMemory` מחזיר `observations` + `entities`. ה-UI:
- **מקבץ תצפיות לפי סוג** (`observationsByType`): אנשים / רכבים / סביבה / אובייקטים.
- לכל תצפית מציג תיאור, צ'יפים של מאפיינים (`attributeChips`), מצלמה, שעה, ותמונה אם קיימת.
- אם הישות המקושרת נראתה יותר מפעם אחת או בכמה מצלמות — מוצג "נראה X פעמים · נצפה במצלמות...".

זה המנגנון שמאפשר ל-Ghost לענות דטרמיניסטית על שאלות כמו "איזו מצלמה ראתה את הסדאן הלבן?".

---

## 4. כרטיסיית Facts — זיכרון מהשיחה הטקסטואלית

זהו זיכרון ה-RAG הקלאסי של השיחה, נפרד לחלוטין מהראייה.

### 4.1 מתי וכיצד נוצרות עובדות

אחרי **כל** הודעה (לא רק עם תמונה), נורה task ברקע `_background_memory_extraction` →
`extract_and_save` (`memory_service.py`):

```26:48:backend/app/services/memory_service.py
    items = await extract_memory(user_message, assistant_message, api_key)
    if not items:
        return []

    saved = []
    for item in items:
        record = create_memory_item(
            db,
            conversation_id=conversation_id,
            item_type=item["type"],
            content=item["content"],
        )
        try:
            embedding = await get_embedding(item["content"], api_key)
            vector_store.add_memory(
                conversation_id=conversation_id,
                memory_id=record["id"],
                content=item["content"],
                embedding=embedding,
            )
        except Exception:
            logger.exception("Failed to embed memory %s", record["id"])
        saved.append(record)
```

1. `extract_memory` (LLM, `gpt-4o-mini`) מחלץ פריטים מסוג `fact` / `preference` / `instruction`
   / `entity` מתוך הודעת המשתמש + תשובת ה-AI.
2. כל פריט נשמר בטבלת ה-memory, **וגם** מוטמע (`embedding`) ונכנס ל-vector store —
   כדי שניתן יהיה לאחזר אותו סמנטית בהמשך.

### 4.2 תצוגה ומחיקה

הכרטיסייה מציגה כל פריט עם תג סוג, ציון רלוונטיות (`relevance_score`), ותוכן.
מחיקה (`handleDelete`) היא אופטימית: מוסרת מה-UI מיד, ואז קוראת `api.deleteMemoryItem`
(שמוחקת גם מה-vector store).

יש גם ניקוי אוטומטי של פריטים ישנים (`cleanup_stale`).

---

## 5. איך הזיכרון "חוזר" אל ה-AI (הצריכה)

שמירת הזיכרון לבדה לא מספיקה — הוא צריך לחזור אל ה-prompt כדי שה-AI ישתמש בו. זה קורה
ב-`prompt_builder.py`:

- **Tracking**: כאשר אין תמונה חדשה בהודעה, נבנה בלוק **"Object Tracking Log"**
  (`_render_tracking_log`) מתוך שורות `detected_objects` — טבלה אותוריטטיבית של כל אדם/רכב/
  אובייקט שזוהה, עם שעה, מאפיינים, פעילות, לוחית ומצלמה. ה-header אומר במפורש למודל:
  "לעולם אל תגיד שאין לך מידע זה אם יש רשומות למטה".
- **Observations** + **Facts**: מוזרקים כ-context (תצפיות ויזואליות, ישויות, ופריטי זיכרון
  רלוונטיים שאוחזרו סמנטית).

כלומר: הזיכרון נכתב ברקע אחרי כל אינטראקציה, ונקרא חזרה אל ה-prompt באינטראקציה הבאה.

---

## 6. סכמת מסד הנתונים (הטבלאות שמאחורי הכרטיסיות)

| טבלה | שייכת ל | תפקיד |
| --- | --- | --- |
| `detection_pending_crops` | Tracking | תור ה-crops הזמני שממתין ל-flush |
| `detection_batches` | Tracking | מטא-דאטה של כל אצווה שנשלחה (קולאז', סטטוס, שגיאה) |
| `detection_events` | Tracking | אירוע זיהוי לכל אצווה (מצביע לקולאז') |
| `detected_objects` | Tracking | השורות שמוצגות בכרטיסייה — פרופיל מלא לכל אובייקט |
| `visual_observations` | Observations | תצפית גולמית לכל ישות שחולצה מתשובת AI |
| `visual_entities` | Observations | ישויות מאוחדות (dedup לפי חתימה) עם `times_seen` ו-`cameras_seen` |
| טבלת ה-memory + vector store | Facts | פריטי עובדה/העדפה/הוראה + embeddings לאחזור סמנטי |

נקודות חשובות בסכמה:
- `detected_objects` ו-`visual_observations` הן **שתי מערכות נפרדות לגמרי** — האחת ממנוע
   ה-YOLO, השנייה מחילוץ הטקסט. הן לא חולקות שורות.
- `detected_objects.batch_id` + `tile_index` מקשרים שורה חזרה לקולאז' שלה.
- מחיקת שיחה (`ON DELETE CASCADE`) מוחקת את כל הזיכרון התלוי בה.

---

## 7. טבלת ערכי ברירת מחדל (מתוך `config.py`)

| הגדרה | ערך | משמעות |
| --- | --- | --- |
| `SCAN_INTERVAL_MS` | 800ms | תדירות סריקה לכל מצלמה (frontend) |
| `MOTION_LUMA_THRESHOLD` | 2.8 | סף שער התנועה (frontend) |
| `yolo_confidence_threshold` | 0.35 | סף ביטחון מינימלי לזיהוי YOLO |
| `yolo_crop_padding_px` | 8 | padding סביב ה-crop |
| `detection_dedupe_cooldown_seconds` | 12 | חלון dedupe לפי חתימה |
| `detection_dedupe_centroid_bucket_px` | 64 | גודל "דלי" המרכז לחתימה |
| `detection_batch_target_default` | 8 | יעד crops ל-flush אוטומטי |
| `detection_batch_target_max` | 88 | מקסימום crops באצווה + מגבלת retention |
| `detection_collage_tile_px` | 224 | גודל אריח בקולאז' |
| `detection_visual_dedupe_structure_threshold` | 0.80 | סף NCC מבני (שער ה-fingerprint העיקרי) |
| `detection_visual_dedupe_hist_threshold` | 0.92 | סף קוסינוס היסטוגרמת צבע |
| `detection_visual_dedupe_hash_threshold` | 12 | סף מרחק האמינג של dhash |
| `vision_model` | `gpt-5` | מודל ה-Vision לניתוח הקולאז' |

---

## 8. סיכום בשורה אחת לכל כרטיסייה

- **Tracking** = "Ghost רואה בעצמו": מצלמה → YOLO מקומי → dedupe חכם → תור crops → קולאז'
  אחד ל-Vision → פרופילים מובנים. כבד-חישוב, רץ ברקע בלולאה.
- **Observations** = "Ghost מסכם מה שאמר על תמונה": אחרי כל תשובת AI עם פריים, LLM מחלץ
  ישויות ויזואליות ומאחד אותן (אדם/רכב/סביבה/אובייקט).
- **Facts** = "Ghost זוכר מה דובר": אחרי כל הודעה, LLM מחלץ עובדות/העדפות/הוראות ושומר
  אותן עם embeddings לאחזור סמנטי.

שלושתם נכתבים **ברקע ובאופן אסינכרוני** (לעולם לא חוסמים את הצ'אט), נשמרים **per-conversation**,
ו**מוזרקים חזרה אל ה-prompt** באינטראקציה הבאה כדי לתת ל-Ghost זיכרון מתמשך.
