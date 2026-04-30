-- FILE: schema.sql | PURPOSE: Full database schema for ClauseGuardian | CONNECTS TO: Supabase dashboard (run this in SQL Editor), backend models.py

-- ── HOW TO RUN ────────────────────────────────────────────────────────────────
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file and click "Run"
-- 3. Then go to Storage → New Bucket → name it "contracts", set to private
-- 4. Confirm all 5 tables appear in Table Editor

-- ── PREREQUISITE: CLERK JWT INTEGRATION ──────────────────────────────────────
-- WHY: ClauseGuardian uses Clerk for auth, NOT Supabase Auth.
-- For RLS policies to work with Clerk JWTs, Supabase must be configured to
-- accept and decode Clerk's JWT tokens.
--
-- SETUP (do this before running this SQL):
--   1. Go to Supabase Dashboard → Settings → Auth → JWT Settings
--   2. Change "JWT Secret" to "Custom JWT Secret"
--   3. Paste your Clerk JWT verification key (RS256 public key)
--      Find it at: Clerk Dashboard → API Keys → JWT Public Key (show)
--   4. Save — Supabase will now accept Clerk JWTs in requests
--
-- Once configured, auth.jwt() ->> 'sub' returns the Clerk user ID in policies.

-- ── EXTENSIONS ────────────────────────────────────────────────────────────────
-- pgcrypto is pre-enabled in Supabase and provides gen_random_uuid()
-- No additional extensions needed for this schema.

-- ── TABLE: users ──────────────────────────────────────────────────────────────
-- WHY: Synced FROM Clerk via webhooks. Not the auth source — just our app's
-- user record for preferences, plan tier, and as a FK anchor for contracts.
CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id    TEXT        UNIQUE NOT NULL,    -- Clerk's user.id, e.g. "user_2abc123"
  email            TEXT        NOT NULL,
  plan             TEXT        NOT NULL DEFAULT 'free',  -- free | pro | enterprise
  alert_preferences JSONB      NOT NULL DEFAULT '{"email": true, "push": true}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  users                        IS 'App users synced from Clerk via webhooks. Do not write directly — use the webhook handler.';
COMMENT ON COLUMN users.clerk_user_id          IS 'Clerk user ID — primary FK used throughout the app instead of UUID.';
COMMENT ON COLUMN users.alert_preferences      IS 'JSON: {"email": bool, "push": bool} — controls which channels receive deadline alerts.';

-- ── TABLE: contracts ─────────────────────────────────────────────────────────
-- WHY: Each uploaded contract is a row here. Status tracks the async analysis pipeline.
CREATE TABLE IF NOT EXISTS contracts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT        NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  file_url       TEXT,                             -- Supabase Storage path, e.g. "contracts/user_xxx/uuid.pdf"
  status         TEXT        NOT NULL DEFAULT 'processing',  -- processing | analyzing | complete | failed
  overall_risk   TEXT,                             -- critical | high | medium | low (set after analysis)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ                       -- optional: contract expiry date extracted from text
);

COMMENT ON TABLE  contracts             IS 'Uploaded contracts. Status progresses: processing → analyzing → complete (or failed).';
COMMENT ON COLUMN contracts.status      IS 'processing=file received, analyzing=LLM pipeline running, complete=results ready, failed=pipeline error.';
COMMENT ON COLUMN contracts.overall_risk IS 'Highest severity clause found. Null until analysis is complete.';

-- Index to speed up "list contracts for user" queries (dashboard page load)
CREATE INDEX IF NOT EXISTS idx_contracts_clerk_user_id ON contracts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status        ON contracts(status);

-- ── TABLE: clauses ────────────────────────────────────────────────────────────
-- WHY: Each flagged clause from a contract gets its own row.
-- The three-zone card UI (raw text → plain language → action) maps to these columns.
CREATE TABLE IF NOT EXISTS clauses (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        UUID    NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_type        TEXT    NOT NULL,   -- indemnification | ip_assignment | auto_renewal | liability_cap | termination | confidentiality | payment_terms | governing_law
  severity           TEXT    NOT NULL,   -- critical | high | medium | low
  raw_text           TEXT,               -- zone 1: exact legal language from the document
  summary            TEXT,               -- zone 2: plain-language explanation (2-3 sentences)
  recommended_action TEXT,               -- zone 3: what the user should do
  page_ref           INTEGER             -- page number in the original document (for reference)
);

COMMENT ON TABLE  clauses                   IS 'Individual flagged clauses extracted from contracts by the LLM pipeline.';
COMMENT ON COLUMN clauses.severity          IS 'critical | high | medium | low — see CLAUDE.md clause type defaults.';
COMMENT ON COLUMN clauses.recommended_action IS 'Actionable next step written for a non-lawyer, e.g. "Ask your attorney to add a liability cap."';

CREATE INDEX IF NOT EXISTS idx_clauses_contract_id ON clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_clauses_severity    ON clauses(severity);

-- ── TABLE: deadlines ─────────────────────────────────────────────────────────
-- WHY: Deadline dates extracted from contracts drive the alert scheduler.
-- Each deadline can trigger email and/or push notifications.
CREATE TABLE IF NOT EXISTS deadlines (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_id      UUID        REFERENCES clauses(id) ON DELETE SET NULL,  -- nullable: some deadlines aren't tied to a specific clause
  deadline_date  TIMESTAMPTZ NOT NULL,
  alert_type     TEXT,                              -- expiry | renewal | notice
  alert_status   TEXT        NOT NULL DEFAULT 'pending'  -- pending | sent | failed
);

COMMENT ON TABLE  deadlines              IS 'Deadline dates from contracts. APScheduler reads pending rows and sends alerts.';
COMMENT ON COLUMN deadlines.alert_status IS 'pending=not yet sent, sent=alert dispatched, failed=alert failed after retry.';

CREATE INDEX IF NOT EXISTS idx_deadlines_contract_id   ON deadlines(contract_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_alert_status  ON deadlines(alert_status);
CREATE INDEX IF NOT EXISTS idx_deadlines_deadline_date ON deadlines(deadline_date);

-- ── TABLE: alert_logs ────────────────────────────────────────────────────────
-- WHY: Audit trail for every alert sent. Helps debug missing alerts
-- and provides users with a delivery history.
CREATE TABLE IF NOT EXISTS alert_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT        NOT NULL,    -- denormalized: no FK so logs survive user deletion
  contract_id    UUID        REFERENCES contracts(id) ON DELETE SET NULL,
  channel        TEXT        NOT NULL,    -- email | push
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  message        TEXT
);

COMMENT ON TABLE  alert_logs         IS 'Append-only log of every alert dispatched. No FK on clerk_user_id so logs persist after account deletion.';
COMMENT ON COLUMN alert_logs.channel IS 'email=Resend, push=Ntfy.sh';

CREATE INDEX IF NOT EXISTS idx_alert_logs_clerk_user_id ON alert_logs(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at       ON alert_logs(sent_at);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- WHY: RLS is the last line of defense. Even if the application has a bug that
-- passes the wrong clerk_user_id, the DB will block the query.
-- Pattern: auth.jwt() ->> 'sub' extracts the Clerk user ID from the verified JWT.
-- This requires Clerk JWT integration (see PREREQUISITE section above).

ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clauses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_logs  ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICIES: users ───────────────────────────────────────────────────────
-- Users can only read/update their own row.
-- INSERT is blocked at the user level — only the webhook handler (service key) creates rows.
-- Decision: No INSERT policy because direct user creation bypasses our webhook sync.

CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- ── RLS POLICIES: contracts ───────────────────────────────────────────────────
CREATE POLICY "contracts_select_own" ON contracts
  FOR SELECT
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "contracts_insert_own" ON contracts
  FOR INSERT
  WITH CHECK (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "contracts_update_own" ON contracts
  FOR UPDATE
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "contracts_delete_own" ON contracts
  FOR DELETE
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- ── RLS POLICIES: clauses ─────────────────────────────────────────────────────
-- Clauses don't have clerk_user_id directly — we join through contracts.
-- Policy: user can access clauses whose contract they own.
CREATE POLICY "clauses_select_own" ON clauses
  FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM contracts WHERE clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

-- INSERT/UPDATE on clauses is done by the LLM pipeline using the service key.
-- No user-facing write policies needed.

-- ── RLS POLICIES: deadlines ───────────────────────────────────────────────────
CREATE POLICY "deadlines_select_own" ON deadlines
  FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM contracts WHERE clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

-- ── RLS POLICIES: alert_logs ──────────────────────────────────────────────────
CREATE POLICY "alert_logs_select_own" ON alert_logs
  FOR SELECT
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- ── STORAGE BUCKET NOTE ───────────────────────────────────────────────────────
-- SQL cannot create Storage buckets — do this manually in the Supabase dashboard:
--   1. Storage → New Bucket
--   2. Name: "contracts"
--   3. Public: OFF (private — files accessed via signed URLs)
--   4. File size limit: 10MB
--   5. Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- ── SUMMARY ───────────────────────────────────────────────────────────────────
-- TABLES CREATED:  users, contracts, clauses, deadlines, alert_logs
-- RLS ENABLED:     all 5 tables
-- POLICIES:        users (select, update), contracts (all), clauses (select),
--                  deadlines (select), alert_logs (select)
-- TO TEST:         In Supabase Table Editor, confirm all 5 tables appear.
--                  Try a SELECT as an anon user — should return 0 rows.
-- NEXT:            Create the "contracts" Storage bucket, then set up the FastAPI scaffold.
