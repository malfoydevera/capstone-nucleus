BEGIN;

-- Cover foreign keys flagged by the Supabase performance advisor.
CREATE INDEX IF NOT EXISTS idx_co_author_invitations_inviter_id
  ON public.co_author_invitations(inviter_id);

CREATE INDEX IF NOT EXISTS idx_notifications_research_id
  ON public.notifications(research_id);

CREATE INDEX IF NOT EXISTS idx_research_comments_user_id
  ON public.research_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_submission_drafts_paper_id
  ON public.submission_drafts(paper_id);

CREATE INDEX IF NOT EXISTS idx_research_papers_bypassed_by
  ON public.research_papers(bypassed_by);

CREATE INDEX IF NOT EXISTS idx_research_papers_deleted_by
  ON public.research_papers(deleted_by);

-- Remove duplicate indexes while keeping the canonical names used elsewhere.
DROP INDEX IF EXISTS public.idx_research_author;
DROP INDEX IF EXISTS public.idx_research_status;

COMMIT;
