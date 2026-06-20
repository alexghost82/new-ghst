-- Fast Path / Enrichment Path — extend detected_objects so a card can be
-- created immediately from local YOLO + dedup (the "Fast Path"), before the
-- heavy Ghost Vision collage analysis (the "Enrichment Path") runs.
--
-- All columns are additive + nullable / defaulted so legacy rows stay valid:
--   * Existing rows were all produced by Vision, so ``source`` defaults to
--     'vision' and ``enrichment_status`` stays NULL (treated as already
--     enriched by the UI).
--   * ``seen_count`` lets a duplicate detection bump an existing card
--     ("seen again now") instead of spawning a new one.
--   * ``retry_count`` / ``next_retry_at`` / ``last_error`` let a failed
--     Vision enrichment be retried later WITHOUT discarding the crop.
--
-- ``detection_pending_crops.object_id`` links a queued crop back to the fast
-- card it created, so the Vision enrichment can UPDATE that exact row by id
-- instead of inserting a duplicate detected_objects row.

ALTER TABLE detected_objects ADD COLUMN source TEXT DEFAULT 'vision';
ALTER TABLE detected_objects ADD COLUMN enrichment_status TEXT;
ALTER TABLE detected_objects ADD COLUMN seen_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE detected_objects ADD COLUMN last_seen_at TEXT;
ALTER TABLE detected_objects ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE detected_objects ADD COLUMN next_retry_at TEXT;
ALTER TABLE detected_objects ADD COLUMN last_error TEXT;

ALTER TABLE detection_pending_crops ADD COLUMN object_id TEXT;

CREATE INDEX IF NOT EXISTS idx_objects_enrichment
    ON detected_objects(conversation_id, enrichment_status, timestamp_utc);
