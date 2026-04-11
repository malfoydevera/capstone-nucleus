-- =============================================================================
-- MIGRATION: Normalize legacy organization scope
-- =============================================================================
-- Description:
--   Backfills department_id and program_id from legacy free-text organization
--   fields only when the mapping is deterministic from existing department or
--   program name/code values.
--
-- Safety:
--   - additive/no schema changes
--   - only updates rows with null FK targets
--   - only uses exact normalized name/code matches
--   - leaves ambiguous legacy values untouched for manual cleanup
-- =============================================================================

BEGIN;

-- Users: direct department name/code match.
UPDATE public.users u
SET department_id = d.id
FROM public.departments d
WHERE u.department_id IS NULL
  AND u.department IS NOT NULL
  AND lower(u.department) IN (lower(d.name), lower(d.code));

-- Users: legacy department field actually contains a program code/name.
UPDATE public.users u
SET department_id = p.department_id
FROM public.programs p
WHERE u.department_id IS NULL
  AND u.department IS NOT NULL
  AND replace(lower(u.department), '_', '-') IN (
    replace(lower(p.name), '_', '-'),
    replace(lower(p.code), '_', '-')
  );

-- Papers: direct department name/code match.
UPDATE public.research_papers rp
SET department_id = d.id
FROM public.departments d
WHERE rp.department_id IS NULL
  AND rp.department IS NOT NULL
  AND lower(rp.department) IN (lower(d.name), lower(d.code));

-- Papers: legacy department field actually contains a program code/name.
UPDATE public.research_papers rp
SET program_id = p.id
FROM public.programs p
WHERE rp.program_id IS NULL
  AND rp.department IS NOT NULL
  AND replace(lower(rp.department), '_', '-') IN (
    replace(lower(p.name), '_', '-'),
    replace(lower(p.code), '_', '-')
  );

-- Papers: derive department_id from the resolved program.
UPDATE public.research_papers rp
SET department_id = p.department_id
FROM public.programs p
WHERE rp.department_id IS NULL
  AND rp.program_id = p.id;

COMMIT;
