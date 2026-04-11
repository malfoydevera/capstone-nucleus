-- =============================================================================
-- MIGRATION: Add program scope to research papers
-- =============================================================================
-- Description:
--   Adds public.research_papers.program_id so workflow routing and analytics can
--   move from department-level inference to program-level ownership.
--
-- Safety:
--   - additive change only
--   - preserves existing department fallback
--   - backfills from author.users.program_id where available
-- =============================================================================

BEGIN;

ALTER TABLE public.research_papers
  ADD COLUMN IF NOT EXISTS program_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'research_papers_program_id_fkey'
  ) THEN
    ALTER TABLE public.research_papers
      ADD CONSTRAINT research_papers_program_id_fkey
      FOREIGN KEY (program_id)
      REFERENCES public.programs(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_research_papers_program_id
  ON public.research_papers(program_id);

-- Backfill paper program scope from the submitting author's normalized program.
UPDATE public.research_papers rp
SET
  program_id = u.program_id,
  department_id = COALESCE(rp.department_id, u.department_id),
  department = COALESCE(rp.department, u.department)
FROM public.users u
WHERE rp.author_id = u.id
  AND rp.program_id IS NULL
  AND u.program_id IS NOT NULL;

COMMIT;

-- Optional verification:
-- SELECT COUNT(*) AS papers_with_program_scope
-- FROM public.research_papers
-- WHERE program_id IS NOT NULL;
