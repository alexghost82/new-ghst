-- Inbound job applications submitted from the public Careers page.
--
-- A visitor fills in their name + phone (required), optionally an email,
-- the role they're applying for, and a short message, and attaches a CV
-- file. We persist a row here plus the stored CV path so the team can
-- review applicants from the internal tooling.
--
-- Fields:
--   * name        - applicant full name
--   * phone       - applicant mobile phone (required contact channel)
--   * email       - optional email address
--   * role        - which open role they applied to (free text / role id)
--   * message     - optional note from the applicant
--   * cv_filename - original uploaded filename (for display / download)
--   * cv_path     - public path of the stored CV under /uploads
--   * cv_size     - size in bytes of the stored CV
--   * cv_type     - reported MIME type of the upload
--   * ip          - best-effort client IP (honours X-Forwarded-For)
--   * user_agent  - raw browser UA string captured at submit time
--   * created_at  - precise ISO-8601 timestamp of the submission
CREATE TABLE IF NOT EXISTS job_applications (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    email       TEXT,
    role        TEXT,
    message     TEXT,
    cv_filename TEXT,
    cv_path     TEXT,
    cv_size     INTEGER,
    cv_type     TEXT,
    ip          TEXT,
    user_agent  TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_applications_created
    ON job_applications(created_at DESC);
