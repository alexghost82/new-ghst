-- Tag every conversation with the IP it was created from.
--
-- The public "Talk to Ghost" trial shares a single ``ghostdemo`` agent across
-- the whole network. To keep each visitor's work private while still letting
-- the admin (8+0 chord) review everything, we stamp the origin IP on creation
-- and filter the conversation list by it for trial sessions only.
--
-- Additive nullable column — legacy rows (origin_ip NULL) remain valid and are
-- simply excluded from IP-scoped listings.
ALTER TABLE conversations ADD COLUMN origin_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_user_ip
    ON conversations(user_id, origin_ip);
