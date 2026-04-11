-- Historical reconciliation migration.
-- Captures the live user suspension columns that exist in production but were missing from the repo.

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

UPDATE public.users
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE IF EXISTS public.users
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE IF EXISTS public.users
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_active
  ON public.users(is_active)
  WHERE is_active = false;
