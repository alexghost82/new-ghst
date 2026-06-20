-- Attach the lead contact (name / email / phone) of the visitor who opened a
-- conversation from the public site.
--
-- The "Talk to Ghost" trial is gated behind a lead form (full name + work
-- email + mobile phone). The visitor's details are stamped on every
-- conversation they create during the trial so the admin (8+0 chord) can see
-- WHO opened each conversation directly in the chat header, instead of a
-- generic title.
--
-- Additive nullable columns — legacy rows (NULL contact) remain valid and the
-- UI simply falls back to the conversation title for them.
ALTER TABLE conversations ADD COLUMN lead_name TEXT;
ALTER TABLE conversations ADD COLUMN lead_email TEXT;
ALTER TABLE conversations ADD COLUMN lead_phone TEXT;
