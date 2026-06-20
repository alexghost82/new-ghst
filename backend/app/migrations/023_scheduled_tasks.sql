-- "Tasks" (משימות): per-conversation scheduled automatic messages.
-- A task is a prompt that the browser-side task engine sends into the
-- conversation on a schedule (one-time / fixed interval / daily at a fixed
-- time). Each task owns trigger phrases; when Ghost's reply to a task message
-- semantically matches a trigger, either a critical task alert is fired
-- through the existing alert mechanism, or a downloadable report is stored.
--
-- All changes here are additive — the existing alert pipeline keeps working
-- unchanged (legacy alert rows default to source='camera' / source='manual').

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'interval', 'daily')),
    -- 'once': absolute UTC ISO timestamp of the single run.
    run_at TEXT,
    -- 'interval': minutes between runs (server enforces a floor of 5).
    interval_minutes INTEGER,
    -- 'daily': "HH:MM" wall-clock time in Asia/Jerusalem.
    daily_time TEXT,
    include_camera INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_conv ON scheduled_tasks(conversation_id);

CREATE TABLE IF NOT EXISTS task_triggers (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    phrase TEXT NOT NULL,
    alert_kind TEXT NOT NULL DEFAULT 'critical' CHECK (alert_kind IN ('critical', 'report')),
    is_active INTEGER NOT NULL DEFAULT 1,
    -- Hidden, always-inactive shadow row in alert_rules so task alert events
    -- can satisfy alert_events.rule_id (NOT NULL FK) and ride the existing
    -- alert pipeline end-to-end (SSE, overlay, acknowledge).
    alert_rule_id TEXT REFERENCES alert_rules(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_triggers_task ON task_triggers(task_id);

CREATE TABLE IF NOT EXISTS task_reports (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    trigger_id TEXT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id TEXT,
    task_name TEXT NOT NULL DEFAULT '',
    prompt_text TEXT NOT NULL DEFAULT '',
    matched_phrase TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    reply_text TEXT NOT NULL DEFAULT '',
    frame_path TEXT,
    camera_label TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_reports_conv ON task_reports(conversation_id);
CREATE INDEX IF NOT EXISTS idx_task_reports_task ON task_reports(task_id);

-- 'manual' = operator-created rule shown in the alerts panel.
-- 'task'   = hidden shadow rule backing a task trigger (always is_active=0).
ALTER TABLE alert_rules ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- 'camera' = fired by the camera alert scan loop (legacy behaviour).
-- 'task'   = fired by a task trigger match on Ghost's reply.
ALTER TABLE alert_events ADD COLUMN source TEXT NOT NULL DEFAULT 'camera';
ALTER TABLE alert_events ADD COLUMN task_id TEXT;
ALTER TABLE alert_events ADD COLUMN trigger_id TEXT;
