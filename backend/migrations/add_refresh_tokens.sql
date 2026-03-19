-- S-005: Refresh token table for JWT rotation pattern
-- Run this against your Supabase PostgreSQL instance.

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user_id lookups on logout (delete all tokens for a user)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Automatically purge expired tokens (optional: run periodically or via pg_cron)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW();
