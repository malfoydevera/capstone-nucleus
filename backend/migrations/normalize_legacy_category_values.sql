-- Normalize legacy free-text research categories to canonical lookup IDs
-- Only exact case-insensitive matches are converted. Ambiguous placeholder
-- values such as "a", "test", or "General" are left untouched for manual cleanup.

UPDATE public.research_papers AS rp
SET category = rc.id::text
FROM public.research_categories AS rc
WHERE rp.category IS NOT NULL
  AND rp.category !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND lower(trim(rp.category)) = lower(trim(rc.name));
