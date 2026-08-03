-- Student-initiated "request to mark as published" workflow.
-- Adds request-tracking columns to research_papers without introducing a new
-- status value, so all existing status-based logic (status === 'approved' / 'published')
-- keeps working unmodified. A paper stays in 'approved' status while a publish
-- request is pending; only actual admin publication flips it to 'published'.

ALTER TABLE IF EXISTS public.research_papers
  ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_requested_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'research_papers_publish_requested_by_fkey'
      AND conrelid = 'public.research_papers'::regclass
  ) THEN
    ALTER TABLE public.research_papers
      ADD CONSTRAINT research_papers_publish_requested_by_fkey
      FOREIGN KEY (publish_requested_by)
      REFERENCES public.users(id);
  END IF;
END $$;

-- Partial index keeps the "Publish requests" admin queue query cheap since
-- almost all rows will have a NULL publish_requested_at.
CREATE INDEX IF NOT EXISTS idx_research_papers_publish_requested_at
ON public.research_papers (publish_requested_at)
WHERE publish_requested_at IS NOT NULL;
