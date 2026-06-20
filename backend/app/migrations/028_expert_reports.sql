-- "Expert reports": the persisted output of a Ghost Expert advisory session.
-- When the operator finishes the interrogation and Ghost generates the
-- recommendation set, the 8 tasks + 8 alerts are stored here as JSON so the
-- downloadable PDF card survives a page refresh and the "set up as drafts"
-- action can materialise them on demand. An assistant chat message carries the
-- [[GHOST_EXPERT_REPORT:<id>]] marker so the in-thread report card renders.
--
-- Fully additive — nothing here changes alert or task behaviour. Tasks/alerts
-- created from a report go through the existing pipelines as INACTIVE drafts.

CREATE TABLE IF NOT EXISTS expert_reports (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    -- Short human-readable summary of the analysed environment.
    summary TEXT NOT NULL DEFAULT '',
    -- Canonical recommendation payload: { tasks: [...], alerts: [...] }.
    payload_json TEXT NOT NULL DEFAULT '{}',
    -- The assistant chat message that hosts the report card marker.
    message_id TEXT,
    -- Set once the operator materialises the recommendations as drafts.
    applied INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expert_reports_conv ON expert_reports(conversation_id);
