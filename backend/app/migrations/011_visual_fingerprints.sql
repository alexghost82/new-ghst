-- Local visual deduplication gate (8 minute window).
--
-- Adds the columns required to store HSV histogram + dHash fingerprints
-- on both the pending crop queue and the canonical detected_objects
-- table. The companion service module
-- ``app.services.detection_visual_fingerprint`` produces the JSON
-- payload stored in ``fingerprint_json``.
--
-- Both ALTER TABLEs are additive (nullable columns), so legacy rows
-- created by migration 010 remain valid.

ALTER TABLE detection_pending_crops ADD COLUMN fingerprint_json TEXT;
ALTER TABLE detection_pending_crops ADD COLUMN object_type TEXT;
ALTER TABLE detected_objects ADD COLUMN fingerprint_json TEXT;

CREATE INDEX IF NOT EXISTS idx_pending_visual_dedup
    ON detection_pending_crops(conversation_id, camera_device_id, object_type, created_at);

CREATE INDEX IF NOT EXISTS idx_objects_visual_dedup
    ON detected_objects(conversation_id, camera_device_id, object_type, timestamp_utc);
