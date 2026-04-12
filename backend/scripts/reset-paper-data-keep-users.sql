-- Reset all research-paper data while preserving user accounts and admin setup.
-- Safe target: Supabase SQL editor or psql connected as a role with access to
-- both the public schema and storage.objects.

BEGIN;

-- Remove storage metadata rows for the bucket used by the backend.
DELETE FROM storage.objects
WHERE bucket_id = 'research-papers';

-- Clear all paper-linked application data but keep users, departments,
-- programs, workflow settings, and other admin/config tables.
TRUNCATE TABLE
  public.research_authors,
  public.research_comments,
  public.faculty_reviews,
  public.approval_workflow,
  public.paper_views,
  public.paper_downloads,
  public.co_author_invitations,
  public.author_invitations,
  public.editorial_checklists,
  public.faculty_conflict_declarations,
  public.submission_drafts,
  public.notifications,
  public.research_papers
RESTART IDENTITY;

COMMIT;
