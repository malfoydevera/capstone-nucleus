-- Historical reconciliation migration.
-- This repo already has add_annotation_threads.sql; this file exists to match the live migration history.

ALTER TABLE IF EXISTS public.research_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'research_comments_parent_id_fkey'
      AND conrelid = 'public.research_comments'::regclass
  ) THEN
    ALTER TABLE public.research_comments
      ADD CONSTRAINT research_comments_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES public.research_comments(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_research_comments_parent_id
  ON public.research_comments(parent_id)
  WHERE parent_id IS NOT NULL;
