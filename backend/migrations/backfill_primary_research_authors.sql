-- =============================================================================
-- MIGRATION: Backfill primary research authors
-- =============================================================================
-- Description:
--   Ensures every paper has a canonical primary-author row in
--   public.research_authors based on research_papers.author_id.
--
-- Safety:
--   - additive data backfill only
--   - respects existing (research_id, user_id) uniqueness
--   - only inserts missing author rows
-- =============================================================================

BEGIN;

INSERT INTO public.research_authors (research_id, user_id, author_order, is_primary)
SELECT
  rp.id,
  rp.author_id,
  0 AS author_order,
  true AS is_primary
FROM public.research_papers rp
WHERE rp.author_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.research_authors ra
    WHERE ra.research_id = rp.id
      AND ra.user_id = rp.author_id
  );

COMMIT;
