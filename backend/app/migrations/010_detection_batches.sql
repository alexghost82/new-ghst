-- Local YOLO tracking — adds the pending crop queue and finalized batch
-- metadata used by the collage-based deep analysis pipeline.
--
-- Important: the existing ``detection_events`` and ``detected_objects``
-- tables defined by ``009_detection_tracking.sql`` are NOT mutated. We
-- only ADD new tables and a couple of nullable columns on
-- ``detected_objects`` so old rows remain valid.

CREATE TABLE IF NOT EXISTS detection_pending_crops (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    crop_path TEXT NOT NULL,
    bbox_json TEXT NOT NULL DEFAULT '{}',
    camera_device_id TEXT,
    camera_label TEXT,
    captured_at TEXT,
    yolo_class TEXT NOT NULL,
    yolo_confidence REAL NOT NULL DEFAULT 0.0,
    dedupe_signature TEXT NOT NULL,
    frame_path TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detection_pending_conv_time
    ON detection_pending_crops(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_detection_pending_dedupe
    ON detection_pending_crops(conversation_id, dedupe_signature, created_at DESC);

CREATE TABLE IF NOT EXISTS detection_batches (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    collage_path TEXT,
    target_count INTEGER NOT NULL,
    crop_count INTEGER NOT NULL DEFAULT 0,
    triggered_by TEXT NOT NULL DEFAULT 'auto',
    status TEXT NOT NULL DEFAULT 'pending',
    sent_at TEXT,
    completed_at TEXT,
    response_json TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detection_batches_conv_time
    ON detection_batches(conversation_id, created_at DESC);

-- Per-conversation batch target so the operator can tune the cadence
-- (clamped 1..detection_batch_target_max in the API layer).
ALTER TABLE conversations ADD COLUMN detection_batch_target INTEGER NOT NULL DEFAULT 8;

-- Optional links from detected_objects back to the batch + tile so the
-- UI/chat can group per-collage. NULL on legacy rows.
ALTER TABLE detected_objects ADD COLUMN batch_id TEXT;
ALTER TABLE detected_objects ADD COLUMN tile_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_detected_objects_batch
    ON detected_objects(batch_id);
