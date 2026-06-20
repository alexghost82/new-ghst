-- Object Tracking Engine — persists detection events and per-object
-- deep profiles produced by the frontend detection loop. Independent of
-- the existing alert_events / visual_observations stack so the rich
-- profile JSON can evolve without touching either of those.

CREATE TABLE IF NOT EXISTS detection_events (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    camera_device_id TEXT,
    camera_label TEXT,
    timestamp_utc TEXT NOT NULL,
    captured_at TEXT,
    frame_path TEXT,
    scene_context TEXT NOT NULL DEFAULT '{}',
    object_count INTEGER NOT NULL DEFAULT 0,
    quick_check_signature TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS detected_objects (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES detection_events(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    entity_id TEXT REFERENCES visual_entities(id) ON DELETE SET NULL,
    tracking_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    object_type TEXT NOT NULL,
    gender_estimation TEXT,
    age_range TEXT,
    clothing_summary TEXT,
    carried_items TEXT NOT NULL DEFAULT '[]',
    distinctive_identifiers TEXT NOT NULL DEFAULT '[]',
    vehicle_type TEXT,
    manufacturer TEXT,
    model_name TEXT,
    color_primary TEXT,
    color_secondary TEXT,
    license_plate_partial TEXT,
    vehicle_identifiers TEXT NOT NULL DEFAULT '[]',
    position_description TEXT,
    activity_description TEXT,
    deep_description TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.7,
    security_relevance_score REAL,
    full_profile TEXT NOT NULL DEFAULT '{}',
    camera_device_id TEXT,
    camera_label TEXT,
    frame_path TEXT,
    timestamp_utc TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detection_events_conv_time
    ON detection_events(conversation_id, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_detection_events_camera_time
    ON detection_events(conversation_id, camera_device_id, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_detected_objects_conv_time
    ON detected_objects(conversation_id, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_detected_objects_event
    ON detected_objects(event_id);
CREATE INDEX IF NOT EXISTS idx_detected_objects_camera_sig
    ON detected_objects(conversation_id, camera_device_id, signature, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_detected_objects_tracking
    ON detected_objects(conversation_id, tracking_id);

ALTER TABLE conversations ADD COLUMN tracking_enabled INTEGER NOT NULL DEFAULT 0;
