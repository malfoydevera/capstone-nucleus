-- =============================================================================
-- MIGRATION: Enable RLS on remaining public application tables
-- =============================================================================
-- Description:
--   Enables row level security on the remaining public tables now that the
--   frontend no longer performs direct Supabase reads/writes. Existing
--   `users` and `research_papers` policies become active. Other tables remain
--   backend/service-role only until explicit client policies are introduced.
-- =============================================================================

BEGIN;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

COMMIT;
