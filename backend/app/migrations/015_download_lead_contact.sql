-- Extend the download lead ledger with the richer contact details captured
-- by the public "Ghost Capabilities Brief" popup.
--
-- The original gate only recorded an email. The capabilities popup also
-- collects the visitor's full name, company / organization, and an optional
-- mobile phone (the visitor may unlock with an email OR a phone number).
--
-- All three are additive nullable columns so legacy rows remain valid.
ALTER TABLE download_leads ADD COLUMN name TEXT;
ALTER TABLE download_leads ADD COLUMN company TEXT;
ALTER TABLE download_leads ADD COLUMN phone TEXT;

CREATE INDEX IF NOT EXISTS idx_download_leads_phone
    ON download_leads(phone, created_at DESC);
