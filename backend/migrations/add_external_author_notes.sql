-- =============================================================================
-- MIGRATION: Add external_author_notes to research_papers
-- =============================================================================
-- Description:
--   Separates legacy/external author note text from canonical structured
--   authorship. Existing co_authors text is copied into the new field.
-- =============================================================================

BEGIN;

ALTER TABLE public.research_papers
ADD COLUMN IF NOT EXISTS external_author_notes text;

UPDATE public.research_papers
SET external_author_notes = co_authors
WHERE external_author_notes IS NULL
  AND co_authors IS NOT NULL
  AND btrim(co_authors) <> '';

COMMIT;
