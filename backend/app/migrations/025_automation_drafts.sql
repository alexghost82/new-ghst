-- "Automation drafts": the staging record behind the conversational
-- alert/task builder. When an operator describes an alert or a task in free
-- language from the composer, the parsed structured fields are stored here as
-- a 'draft'. An assistant chat message carries the
-- [[GHOST_AUTOMATION_DRAFT:<id>]] marker so the in-thread widget can render
-- the editable draft. On confirm the draft is materialised into the existing
-- alert_rules / scheduled_tasks pipelines and its status flips to 'created'.
--
-- Fully additive — nothing here touches the alert or task tables' behaviour.

CREATE TABLE IF NOT EXISTS automation_drafts (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    -- 'alert' -> a standing alert rule; 'task' -> a scheduled task.
    kind TEXT NOT NULL CHECK (kind IN ('alert', 'task')),
    -- 'draft'    : awaiting operator review/edit/confirm.
    -- 'created'  : confirmed and materialised into a rule/task.
    -- 'dismissed': discarded by the operator.
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'created', 'dismissed')),
    -- Structured fields extracted by the model (canonical per-kind shape).
    payload_json TEXT NOT NULL DEFAULT '{}',
    -- The operator's original free-language request, kept for context/audit.
    source_text TEXT NOT NULL DEFAULT '',
    -- The assistant chat message that hosts the draft widget marker.
    message_id TEXT,
    -- Set once confirmed: the id of the rule/task this draft produced.
    created_task_id TEXT,
    created_rule_id TEXT,
    -- Whether confirm also activated the automation (armed/active) vs saved only.
    activated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_drafts_conv ON automation_drafts(conversation_id);
