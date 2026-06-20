-- Owner / Super-Admin panel foundation.
--
-- Introduces a SEPARATE admin identity model (admin_users) that is fully
-- decoupled from the operator ``users`` table. Operators authenticate with the
-- existing nickname + API-key "trust-the-client" model; admins authenticate
-- with email + password + TOTP 2FA and short-lived JWTs. The two never mix.
--
-- Also lays down the cross-cutting telemetry tables the panel reads from:
-- audit_log (every sensitive admin action), usage_events (product usage),
-- llm_usage (real OpenAI token/cost capture) and error_events (global failures).

-- ----------------------------------------------------------------------------
-- Admin identities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id                 TEXT PRIMARY KEY,
    email              TEXT NOT NULL UNIQUE,
    password_hash      TEXT NOT NULL,
    display_name       TEXT NOT NULL DEFAULT '',
    -- RBAC role: owner | admin | support | finance | viewer
    role               TEXT NOT NULL DEFAULT 'viewer',
    -- Lifecycle: active | suspended
    status             TEXT NOT NULL DEFAULT 'active',
    -- TOTP 2FA. Secret is stored Fernet-encrypted (never plaintext). totp_enabled
    -- flips to 1 only after the admin confirms a first valid code.
    totp_secret_encrypted TEXT,
    totp_enabled       INTEGER NOT NULL DEFAULT 0,
    -- Brute-force throttle on the password step.
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until       TEXT,
    last_login_at      TEXT,
    created_by         TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ----------------------------------------------------------------------------
-- Refresh tokens (rotating). Access JWTs are short-lived and stateless; refresh
-- tokens are persisted as a salted hash so logout / revocation is possible and
-- a leaked DB does not yield usable tokens.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
    id          TEXT PRIMARY KEY,
    admin_id    TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    user_agent  TEXT,
    ip          TEXT,
    issued_at   TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    revoked_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_refresh_admin ON admin_refresh_tokens(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_refresh_hash ON admin_refresh_tokens(token_hash);

-- ----------------------------------------------------------------------------
-- Audit log — every sensitive admin action, append-only.
-- actor_admin_id is nullable so pre-auth events (failed logins by unknown
-- email) can still be recorded with the attempted identity in actor_label.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id             TEXT PRIMARY KEY,
    actor_admin_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
    actor_label    TEXT,
    action         TEXT NOT NULL,
    target_type    TEXT,
    target_id      TEXT,
    status         TEXT NOT NULL DEFAULT 'success',
    reason         TEXT,
    before_json    TEXT,
    after_json     TEXT,
    ip             TEXT,
    user_agent     TEXT,
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);

-- ----------------------------------------------------------------------------
-- Usage events — product analytics (operator-side). Written fire-and-forget so
-- it never blocks a request. No message content is ever stored here.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_events (
    id             TEXT PRIMARY KEY,
    actor_user_id  TEXT,
    event_type     TEXT NOT NULL,
    screen         TEXT,
    feature        TEXT,
    conversation_id TEXT,
    metadata_json  TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_usage_event_type ON usage_events(event_type);

-- ----------------------------------------------------------------------------
-- LLM usage — real token + cost capture for every OpenAI call.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_usage (
    id              TEXT PRIMARY KEY,
    user_id         TEXT,
    conversation_id TEXT,
    model           TEXT NOT NULL,
    action          TEXT NOT NULL DEFAULT 'chat',
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    cost_usd        REAL NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user ON llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model ON llm_usage(model);

-- ----------------------------------------------------------------------------
-- Error events — global failure ledger fed by the exception handler and the
-- background-job guards. severity: info | warning | high | critical.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS error_events (
    id            TEXT PRIMARY KEY,
    severity      TEXT NOT NULL DEFAULT 'high',
    source        TEXT NOT NULL,
    route         TEXT,
    user_id       TEXT,
    environment   TEXT NOT NULL DEFAULT 'development',
    message       TEXT NOT NULL,
    stack_hash    TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_created ON error_events(created_at);
CREATE INDEX IF NOT EXISTS idx_error_severity ON error_events(severity);
CREATE INDEX IF NOT EXISTS idx_error_stack ON error_events(stack_hash);

-- ----------------------------------------------------------------------------
-- Operator user lifecycle columns. The admin panel needs to suspend / block /
-- soft-delete operator accounts without destroying their data. These augment
-- the existing ``users`` table (status defaults keep every current account
-- active and visible exactly as before).
-- ----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN admin_note TEXT;
