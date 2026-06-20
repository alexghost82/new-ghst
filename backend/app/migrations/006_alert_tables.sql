CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_conv ON alert_rules(conversation_id);

CREATE TABLE IF NOT EXISTS alert_events (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    matched_description TEXT NOT NULL,
    ai_description TEXT NOT NULL,
    frame_path TEXT,
    confidence TEXT NOT NULL DEFAULT 'high',
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_events_conv ON alert_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_rule ON alert_events(rule_id);

ALTER TABLE conversations ADD COLUMN alert_mode_enabled INTEGER NOT NULL DEFAULT 0;
