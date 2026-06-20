CREATE TABLE IF NOT EXISTS conversation_cameras (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_cameras ON conversation_cameras(conversation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_camera_device
    ON conversation_cameras(conversation_id, device_id);

ALTER TABLE messages ADD COLUMN camera_label TEXT;
