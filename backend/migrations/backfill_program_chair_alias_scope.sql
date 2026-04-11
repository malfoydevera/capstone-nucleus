-- =============================================================================
-- MIGRATION: Backfill program chair alias scope
-- =============================================================================
-- Description:
--   Resolves legacy program chair rows that already carry a deterministic
--   program alias in their legacy program/department text fields.
-- =============================================================================

BEGIN;

WITH bsit_program AS (
  SELECT id, name, department_id
  FROM public.programs
  WHERE lower(code) = 'bsit-mwa'
     OR lower(name) = 'bs information technology - mobile and web applications'
  ORDER BY name
  LIMIT 1
)
UPDATE public.users u
SET program_id = bp.id,
    program = COALESCE(NULLIF(u.program, ''), bp.name),
    department_id = bp.department_id
FROM bsit_program bp
WHERE u.role = 'program_chair'
  AND u.program_id IS NULL
  AND lower(replace(COALESCE(NULLIF(u.program, ''), u.department, ''), '_', '-')) IN (
    'bsit',
    'bsit-mwa',
    'bs information technology - mobile and web applications'
  );

COMMIT;
