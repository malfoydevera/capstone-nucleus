-- Historical reconciliation migration.
-- Captures the live soft-delete shape that exists in production but was missing from the repo.

ALTER TABLE IF EXISTS public.research_papers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'research_papers_deleted_by_fkey'
      AND conrelid = 'public.research_papers'::regclass
  ) THEN
    ALTER TABLE public.research_papers
      ADD CONSTRAINT research_papers_deleted_by_fkey
      FOREIGN KEY (deleted_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_research_papers_deleted_at
  ON public.research_papers(deleted_at)
  WHERE deleted_at IS NOT NULL;
