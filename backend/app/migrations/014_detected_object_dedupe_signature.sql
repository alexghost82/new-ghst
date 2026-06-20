-- Cross-flush local dedupe — persist the YOLO ``camera::class::centroid``
-- dedupe signature on detected_objects.
--
-- The existing ``detected_objects.signature`` column is overwritten by the
-- Vision ``tracking_signature`` (e.g. ``black_hoodie_male``) during a batch
-- flush, so ``find_recent_object_dedupe`` could never match the local YOLO
-- signature once crops left the pending queue. This new column preserves the
-- original local signature so the 3-minute "same region" suppression keeps
-- working AFTER a flush, with no extra API calls.
--
-- Additive nullable column — legacy rows remain valid.

ALTER TABLE detected_objects ADD COLUMN dedupe_signature TEXT;

CREATE INDEX IF NOT EXISTS idx_objects_dedupe_signature
    ON detected_objects(conversation_id, camera_device_id, dedupe_signature, timestamp_utc);
