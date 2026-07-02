-- =============================================================================
-- MIGRATION: Add public.users.auth_user_id (stable link to auth.users)
-- =============================================================================
-- Description:
--   public.users and auth.users were previously linked only by matching email
--   strings. This adds a stable id-based link so email changes never desync the
--   two, and so the backend can resolve the auth user by id instead of scanning
--   the entire auth user list.
--
--   public.users.id cannot be repointed to auth.users.id because many tables
--   already FK to public.users.id, so we add a separate column.
--
-- Follow-up: populate via `npm run backfill:auth-user-id`.
-- =============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.users.auth_user_id IS
  'Stable FK-like link to auth.users(id). Populated by backfill; preferred over email matching.';
