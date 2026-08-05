-- Add verification fields for recovery email setup without Resend dependency
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS recovery_email_verification_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS recovery_email_verification_expires TIMESTAMPTZ;

-- Create index for efficient cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_users_recovery_verification_expires
  ON users(recovery_email_verification_expires)
  WHERE recovery_email_verification_expires IS NOT NULL;