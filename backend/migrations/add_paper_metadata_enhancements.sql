-- Historical reconciliation migration.
-- The live database received these metadata columns under a migration name that was missing in the repo.
-- Some of these concerns are also covered by later dedicated migrations; all statements are idempotent.

ALTER TABLE IF EXISTS public.research_papers
  ADD COLUMN IF NOT EXISTS bypass_reason text,
  ADD COLUMN IF NOT EXISTS bypassed_by uuid,
  ADD COLUMN IF NOT EXISTS bypassed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_reminder_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS plagiarism_status text,
  ADD COLUMN IF NOT EXISTS plagiarism_score integer,
  ADD COLUMN IF NOT EXISTS plagiarism_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS plagiarism_provider text,
  ADD COLUMN IF NOT EXISTS plagiarism_summary text,
  ADD COLUMN IF NOT EXISTS plagiarism_report jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'research_papers_bypassed_by_fkey'
      AND conrelid = 'public.research_papers'::regclass
  ) THEN
    ALTER TABLE public.research_papers
      ADD CONSTRAINT research_papers_bypassed_by_fkey
      FOREIGN KEY (bypassed_by)
      REFERENCES public.users(id);
  END IF;
END $$;
