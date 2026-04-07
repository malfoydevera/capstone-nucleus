-- Add optional recovery email for password reset delivery without changing login email.
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_recovery_email_unique
  ON users(recovery_email)
  WHERE recovery_email IS NOT NULL;
