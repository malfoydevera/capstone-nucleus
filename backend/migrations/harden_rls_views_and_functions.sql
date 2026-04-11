-- =============================================================================
-- MIGRATION: Harden users policies, views, and function search_path
-- =============================================================================
-- Description:
--   Removes obsolete direct-client users policies, switches legacy views away
--   from SECURITY DEFINER behavior, and pins search_path for flagged functions.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "Allow insert for registration" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

ALTER VIEW public.pending_reviews SET (security_invoker = true);
ALTER VIEW public.recycle_bin SET (security_invoker = true);
ALTER VIEW public.research_with_authors SET (security_invoker = true);
ALTER VIEW public.active_research_papers SET (security_invoker = true);

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.increment_download_count(uuid) SET search_path = public;
ALTER FUNCTION public.increment_view_count(uuid) SET search_path = public;
ALTER FUNCTION public.match_paper_content(vector,double precision,integer,uuid) SET search_path = public;
ALTER FUNCTION public.sync_users_legacy_full_name() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.validate_user_program_department() SET search_path = public;
ALTER FUNCTION public.validate_user_role_requirements() SET search_path = public;

COMMIT;
