-- Ensure one draft per user for new submissions and one draft per user+paper for resubmissions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_drafts_user_null_paper
  ON public.submission_drafts (user_id)
  WHERE paper_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_drafts_user_paper
  ON public.submission_drafts (user_id, paper_id)
  WHERE paper_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submission_drafts_user_updated
  ON public.submission_drafts (user_id, updated_at DESC);
