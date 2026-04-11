-- =============================================================================
-- MIGRATION: Enable RLS on backend-only private/admin tables
-- =============================================================================
-- Description:
--   Enables row level security on tables that are only accessed through the
--   backend service-role client. No client-side direct Supabase reads/writes
--   should rely on these tables anymore.
--
-- Safety:
--   - no schema/data shape changes
--   - backend service role bypasses RLS
--   - blocks accidental anon/authenticated direct table access
-- =============================================================================

BEGIN;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.co_author_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_conflict_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_policy_settings ENABLE ROW LEVEL SECURITY;

COMMIT;
