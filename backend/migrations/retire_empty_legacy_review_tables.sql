-- =============================================================================
-- MIGRATION: Retire empty legacy review/invitation tables
-- =============================================================================
-- Description:
--   Drops legacy tables that are no longer used by the application and have
--   already been verified as empty in production.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.faculty_reviews;
DROP TABLE IF EXISTS public.author_invitations;

COMMIT;
