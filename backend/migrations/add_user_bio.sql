-- Add optional short bio for user profile pages.
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS bio text;

COMMENT ON COLUMN public.users.bio IS 'Optional user profile bio (max 200 chars enforced in application layer).';
