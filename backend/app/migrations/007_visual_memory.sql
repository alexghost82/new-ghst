CREATE TABLE IF NOT EXISTS visual_entities (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    signature TEXT NOT NULL,
    canonical_description TEXT NOT NULL,
    visual_attributes TEXT NOT NULL DEFAULT '{}',
    cameras_seen TEXT NOT NULL DEFAULT '[]',
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    times_seen INTEGER NOT NULL DEFAULT 1,
    last_match_confidence REAL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS visual_observations (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    entity_id TEXT REFERENCES visual_entities(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    camera_label TEXT,
    camera_device_id TEXT,
    description TEXT NOT NULL,
    visual_attributes TEXT NOT NULL DEFAULT '{}',
    position_in_frame TEXT,
    direction TEXT,
    activity TEXT,
    confidence REAL NOT NULL DEFAULT 0.7,
    semantic_tags TEXT NOT NULL DEFAULT '[]',
    image_path TEXT,
    observed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visual_obs_conv_time
    ON visual_observations(conversation_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_obs_entity ON visual_observations(entity_id);
CREATE INDEX IF NOT EXISTS idx_visual_obs_message ON visual_observations(message_id);
CREATE INDEX IF NOT EXISTS idx_visual_entities_conv_sig
    ON visual_entities(conversation_id, signature);
CREATE INDEX IF NOT EXISTS idx_visual_entities_conv_type
    ON visual_entities(conversation_id, entity_type);
