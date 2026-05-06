-- PREREQUISITE: Supabase must be configured to accept Clerk JWTs before RLS policies work.
-- Settings → Auth → JWT Settings → Custom JWT Secret → paste your Clerk RS256 public key
-- (Clerk Dashboard → API Keys → JWT Public Key → Show)
-- After saving, auth.jwt() ->> 'sub' will return the Clerk user ID in policies.

CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id     TEXT        UNIQUE NOT NULL,
  email             TEXT        NOT NULL,
  plan              TEXT        NOT NULL DEFAULT 'free',
  alert_preferences JSONB       NOT NULL DEFAULT '{"email": true, "push": true}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT        NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  file_url      TEXT,
  status        TEXT        NOT NULL DEFAULT 'processing',
  overall_risk  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clauses (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        UUID    NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_type        TEXT    NOT NULL,
  severity           TEXT    NOT NULL,
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
  alert_type    TEXT,
  alert_status  TEXT        NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS alert_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT        NOT NULL,
  contract_id   UUID        REFERENCES contracts(id) ON DELETE SET NULL,
  channel       TEXT        NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_contracts_clerk_user_id ON contracts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status        ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_clauses_contract_id     ON clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_clauses_severity        ON clauses(severity);
CREATE INDEX IF NOT EXISTS idx_deadlines_contract_id   ON deadlines(contract_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_alert_status  ON deadlines(alert_status);
CREATE INDEX IF NOT EXISTS idx_deadlines_deadline_date ON deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_alert_logs_clerk_user_id ON alert_logs(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at      ON alert_logs(sent_at);

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
-- Storage → New Bucket → name: "contracts" → Public: OFF → max size: 20 MB
-- Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
