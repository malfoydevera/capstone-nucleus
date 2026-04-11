-- =============================================================================
-- MIGRATION: Retire legacy refresh_tokens table
-- =============================================================================
-- Description:
--   Removes the obsolete refresh_tokens table after session handling has been
--   moved to Supabase Auth access/refresh tokens.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.refresh_tokens;

COMMIT;
