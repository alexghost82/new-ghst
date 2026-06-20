-- Per-conversation performance/quality knobs the operator can tune from the
-- "Advanced settings" section. These sit alongside ``accuracy_level`` (migration
-- 018) and let the operator trade response speed against depth/detail without
-- touching any internal/technical configuration.
--
--   response_length: how long the reply may run before it must wrap up. Maps to
--     the model's output cap via ``app/config.py::max_tokens_for_length``.
--       'short'  -> brief answers, fastest
--       'medium' -> balanced
--       'long'   -> full detail (previous behaviour)
--
--   image_detail: how finely a camera frame is examined.
--       'low'  -> faster, coarse pass
--       'high' -> sharp, full-tile pass (previous behaviour)
--
-- Additive columns — legacy rows default to the previous behaviour ('long' /
-- 'high') so there is zero change for existing conversations.
ALTER TABLE conversations ADD COLUMN response_length TEXT NOT NULL DEFAULT 'long';
ALTER TABLE conversations ADD COLUMN image_detail TEXT NOT NULL DEFAULT 'high';
