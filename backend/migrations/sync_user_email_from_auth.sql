-- =============================================================================
-- MIGRATION: Keep public.users.email in sync with auth.users.email
-- =============================================================================
-- Description:
--   When a user changes their email through Supabase Auth (verified email-change
--   flow), auth.users.email is updated after confirmation. This trigger mirrors
--   that change into public.users, matched by the stable auth_user_id link, so
--   the application profile never desyncs from the auth identity.
--
-- Requires: public.users.auth_user_id (see add_users_auth_user_id.sql) to be
--           populated for the affected users.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
      SET email = NEW.email, updated_at = now()
    WHERE auth_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_email_from_auth();

-- This is a trigger-only function; it must not be callable as a REST RPC.
REVOKE ALL ON FUNCTION public.sync_user_email_from_auth() FROM PUBLIC, anon, authenticated;
