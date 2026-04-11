-- =============================================================================
-- MIGRATION: Backfill unresolved legacy category values
-- =============================================================================
-- Description:
--   Creates a canonical "Uncategorized" lookup row and maps any remaining
--   non-UUID legacy category strings to that row instead of leaving them as
--   free-text placeholders.
-- =============================================================================

BEGIN;

INSERT INTO public.research_categories (name, description)
SELECT 'Uncategorized', 'Legacy or unresolved category values'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.research_categories
  WHERE lower(name) = 'uncategorized'
);

UPDATE public.research_papers
SET category = (
  SELECT id
  FROM public.research_categories
  WHERE lower(name) = 'uncategorized'
  LIMIT 1
)
WHERE deleted_at IS NULL
  AND category IS NOT NULL
  AND btrim(category) <> ''
  AND category !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

COMMIT;
