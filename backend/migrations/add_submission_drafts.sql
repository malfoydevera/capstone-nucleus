-- Create submission drafts table for autosave support.
CREATE TABLE IF NOT EXISTS public.submission_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  paper_id uuid NULL REFERENCES public.research_papers(id) ON DELETE CASCADE,
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_drafts_user_id
  ON public.submission_drafts(user_id);

CREATE INDEX IF NOT EXISTS idx_submission_drafts_paper_id
  ON public.submission_drafts(paper_id);
