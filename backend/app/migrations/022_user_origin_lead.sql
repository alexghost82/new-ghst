-- Every public trial started from "Talk to Ghost" now creates a brand-new
-- user named after the visitor (same shared demo API key). To let the
-- demo admin (8+0) list those accounts with their contact details, the
-- users table records where the account came from and the lead contact
-- captured by the trial gate.
--
--   origin:
--     'standard' -> a normal operator account created via the console.
--     'trial'    -> an account auto-created for a public trial session.
--
-- Additive columns — legacy rows default to 'standard' with no contact.
ALTER TABLE users ADD COLUMN origin TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE users ADD COLUMN lead_name TEXT;
ALTER TABLE users ADD COLUMN lead_email TEXT;
ALTER TABLE users ADD COLUMN lead_phone TEXT;
