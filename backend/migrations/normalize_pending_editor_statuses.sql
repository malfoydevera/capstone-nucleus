-- Normalize legacy editor-stage pending rows into the canonical pending_editor status.
-- Safe scope:
-- - only non-deleted papers
-- - only rows without a faculty reviewer
-- - only rows still using the legacy `pending` status

UPDATE public.research_papers
SET status = 'pending_editor',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND status = 'pending'
  AND faculty_id IS NULL;
