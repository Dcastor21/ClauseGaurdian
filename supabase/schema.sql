-- PREREQUISITE: Supabase must be configured to accept Clerk JWTs before RLS policies work.
-- Settings → Auth → JWT Settings → Custom JWT Secret → paste your Clerk RS256 public key
-- (Clerk Dashboard → API Keys → JWT Public Key → Show)
-- After saving, auth.jwt() ->> 'sub' will return the Clerk user ID in policies.
--
-- RE-RUNNING THIS FILE: CREATE TABLE IF NOT EXISTS is idempotent for the table structure,
-- but the inline CHECK constraints below only apply when the table is first created.
-- If you need to add constraints to an existing database, the DO $$ blocks at the bottom
-- handle that safely (they catch duplicate_object errors so re-runs are safe).
-- If existing rows violate a new constraint, truncate the table first in dev/staging.

CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id     TEXT        UNIQUE NOT NULL,
  email             TEXT        NOT NULL,
  plan              TEXT        NOT NULL DEFAULT 'free'
                                CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro')),
  alert_preferences JSONB       NOT NULL DEFAULT '{"email": true, "push": true}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT        NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  name          TEXT        NOT NULL
                            CONSTRAINT contracts_name_length_check CHECK (char_length(name) <= 200),
  file_url      TEXT,
  status        TEXT        NOT NULL DEFAULT 'processing'
                            CONSTRAINT contracts_status_check
                              CHECK (status IN ('processing', 'analyzing', 'complete', 'failed')),
  overall_risk  TEXT        CONSTRAINT contracts_overall_risk_check
                              CHECK (overall_risk IS NULL OR overall_risk IN ('critical', 'high', 'medium', 'low')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clauses (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        UUID    NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_type        TEXT    NOT NULL,
  severity           TEXT    NOT NULL
                             CONSTRAINT clauses_severity_check
                               CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  raw_text           TEXT,
  summary            TEXT,
  recommended_action TEXT,
  page_ref           INTEGER
);

CREATE TABLE IF NOT EXISTS deadlines (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_id     UUID        REFERENCES clauses(id) ON DELETE SET NULL,
  deadline_date TIMESTAMPTZ NOT NULL,
  alert_window  TEXT        CONSTRAINT deadlines_alert_window_check
                              CHECK (alert_window IN ('30-day', '14-day', '7-day', '1-day')),
  alert_status  TEXT        NOT NULL DEFAULT 'pending'
                            CONSTRAINT deadlines_alert_status_check
                              CHECK (alert_status IN ('pending', 'sent', 'failed'))
);

CREATE TABLE IF NOT EXISTS alert_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT        NOT NULL,
  contract_id   UUID        REFERENCES contracts(id) ON DELETE SET NULL,
  channel       TEXT        NOT NULL
                            CONSTRAINT alert_logs_channel_check CHECK (channel IN ('email', 'push')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  message       TEXT
);

-- ── INDEXES ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contracts_clerk_user_id ON contracts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status        ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_clauses_contract_id     ON clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_clauses_severity        ON clauses(severity);
CREATE INDEX IF NOT EXISTS idx_deadlines_contract_id   ON deadlines(contract_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_alert_status  ON deadlines(alert_status);
CREATE INDEX IF NOT EXISTS idx_deadlines_deadline_date ON deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_alert_logs_clerk_user_id ON alert_logs(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at      ON alert_logs(sent_at);

-- Composite index for the dashboard list query: WHERE clerk_user_id = ? ORDER BY created_at DESC
-- Allows Postgres to do an index-only scan instead of a sequential scan + sort.
CREATE INDEX IF NOT EXISTS idx_contracts_user_created
  ON contracts(clerk_user_id, created_at DESC);

-- Partial index for the scheduler's pending-deadline scan.
-- The WHERE clause filters to pending rows only, keeping the index small.
CREATE INDEX IF NOT EXISTS idx_deadlines_pending_upcoming
  ON deadlines(alert_status, deadline_date)
  WHERE alert_status = 'pending';

-- ── SAFE ALTER TABLE: add constraints to an existing database ─────────────────
-- Each block catches duplicate_object so this file can be re-run safely.
-- These are no-ops when the table was freshly created above (constraints already exist).

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE contracts ADD CONSTRAINT contracts_name_length_check CHECK (char_length(name) <= 200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
    CHECK (status IN ('processing', 'analyzing', 'complete', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE contracts ADD CONSTRAINT contracts_overall_risk_check
    CHECK (overall_risk IS NULL OR overall_risk IN ('critical', 'high', 'medium', 'low'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clauses ADD CONSTRAINT clauses_severity_check
    CHECK (severity IN ('critical', 'high', 'medium', 'low'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE deadlines ADD CONSTRAINT deadlines_alert_window_check
    CHECK (alert_window IN ('30-day', '14-day', '7-day', '1-day'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE deadlines ADD CONSTRAINT deadlines_alert_status_check
    CHECK (alert_status IN ('pending', 'sent', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alert_logs ADD CONSTRAINT alert_logs_channel_check CHECK (channel IN ('email', 'push'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clauses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_logs  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "contracts_select_own" ON contracts
  FOR SELECT USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "contracts_insert_own" ON contracts
  FOR INSERT WITH CHECK (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "contracts_update_own" ON contracts
  FOR UPDATE USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "contracts_delete_own" ON contracts
  FOR DELETE USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "clauses_select_own" ON clauses
  FOR SELECT USING (
    contract_id IN (
      SELECT id FROM contracts WHERE clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "deadlines_select_own" ON deadlines
  FOR SELECT USING (
    contract_id IN (
      SELECT id FROM contracts WHERE clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "alert_logs_select_own" ON alert_logs
  FOR SELECT USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- Storage bucket must be created manually:
-- Storage → New Bucket → name: "contracts" → Public: OFF → max size: 10 MB
-- Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
