-- =============================================================================
-- MIGRATION: Drop the custom password_reset_tokens table
-- =============================================================================
-- Description:
--   Password reset is now handled natively by Supabase Auth
--   (supabase.auth.resetPasswordForEmail + updateUser). The hand-rolled
--   one-time token table is no longer used by the application.
--
-- Safety:
--   - The table is only ever accessed by the backend service role.
--   - No application code references this table after this migration.
-- =============================================================================

DROP TABLE IF EXISTS public.password_reset_tokens;
