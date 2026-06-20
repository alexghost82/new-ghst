-- Lead ledger for the public Security Architecture document gate.
--
-- Every time a visitor unlocks the enterprise architecture PDF by
-- entering their email, we record a row here so the team can track who
-- pulled the confidential document, from where, and how often.
--
-- Fields:
--   * email       - the address the visitor typed into the download gate
--   * file        - which document was downloaded (forward-compatible)
--   * ip          - best-effort client IP (honours X-Forwarded-For)
--   * user_agent  - raw browser UA string captured at download time
--   * country / region / city - reverse-geo of the IP (best effort, may be NULL)
--   * latitude / longitude    - approximate coordinates of the IP (best effort)
--   * created_at  - precise ISO-8601 timestamp of the download
CREATE TABLE IF NOT EXISTS download_leads (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    file        TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT,
    country     TEXT,
    region      TEXT,
    city        TEXT,
    latitude    REAL,
    longitude   REAL,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_download_leads_created
    ON download_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_download_leads_email
    ON download_leads(email, created_at DESC);
