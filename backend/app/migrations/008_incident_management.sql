CREATE TABLE IF NOT EXISTS incident_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
    alert_event_id TEXT REFERENCES alert_events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'new'
        CHECK(status IN ('new','handling','investigation','closed')),
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK(severity IN ('low','medium','high','critical')),
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    source_camera_label TEXT,
    preview_image_path TEXT,
    confidence TEXT,
    ai_reasoning TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    handling_started_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
);

CREATE TABLE IF NOT EXISTS incident_activity (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incident_events(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    actor TEXT,
    content TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_notes (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incident_events(id) ON DELETE CASCADE,
    author TEXT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_evidence (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incident_events(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    image_path TEXT,
    observation_id TEXT,
    entity_id TEXT,
    alert_event_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

ALTER TABLE conversations ADD COLUMN incident_id TEXT REFERENCES incident_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_user_status
    ON incident_events(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity
    ON incident_events(user_id, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned
    ON incident_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_camera_time
    ON incident_events(user_id, source_camera_label, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_activity
    ON incident_activity(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_incident_notes
    ON incident_notes(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_incident_evidence
    ON incident_evidence(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_incident
    ON conversations(incident_id);
