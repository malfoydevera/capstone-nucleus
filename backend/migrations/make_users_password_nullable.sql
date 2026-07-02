-- =============================================================================
-- MIGRATION: Make public.users.password nullable
-- =============================================================================
-- Description:
--   Supabase Auth is now the single source of truth for credentials. New
--   accounts no longer store a bcrypt hash in public.users.password.
--   This is the intermediate, non-destructive step: the column is kept for
--   backward-compatible login of legacy users who have not yet been migrated
--   into Supabase Auth (see scripts/backfill-auth-users.js).
--
-- Follow-up (only after all active users are confirmed in Supabase Auth):
--   ALTER TABLE public.users DROP COLUMN password;
--   ...and remove the bcrypt fallback in auth.controller.js login().
-- =============================================================================

ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;
