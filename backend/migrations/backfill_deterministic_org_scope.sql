-- =============================================================================
-- MIGRATION: Backfill deterministic organization scope
-- =============================================================================
-- Description:
--   Safely backfills users.department_id, users.program_id, and paper scope
--   fields only when the mapping is deterministic from current live data.
--
-- Safety:
--   - additive/data-only
--   - idempotent
--   - respects current role trigger rules (no program_id for non-students yet)
--   - only assigns program_id when a single unambiguous source exists
-- =============================================================================

BEGIN;

WITH default_department AS (
  SELECT id, name
  FROM public.departments
  ORDER BY name
  LIMIT 1
),
department_count AS (
  SELECT COUNT(*) AS total FROM public.departments
)
UPDATE public.users u
SET department_id = dd.id,
    department = COALESCE(NULLIF(u.department, ''), dd.name)
FROM default_department dd, department_count dc
WHERE dc.total = 1
  AND u.department_id IS NULL
  AND u.role IN ('faculty', 'dean', 'program_chair', 'staff')
  AND u.program_id IS NULL;

WITH student_program_source AS (
  SELECT
    rp.author_id AS user_id,
    (ARRAY_AGG(DISTINCT rp.program_id))[1] AS inferred_program_id
  FROM public.research_papers rp
  WHERE rp.program_id IS NOT NULL
  GROUP BY rp.author_id
  HAVING COUNT(DISTINCT rp.program_id) = 1
)
UPDATE public.users u
SET program_id = sps.inferred_program_id
FROM student_program_source sps
WHERE u.id = sps.user_id
  AND u.role = 'student'
  AND u.program_id IS NULL;

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
    program = COALESCE(NULLIF(u.program, ''), bp.name)
FROM bsit_program bp
WHERE u.role = 'student'
  AND u.program_id IS NULL
  AND lower(replace(COALESCE(u.department, ''), '_', '-')) IN (
    'bsit',
    'bsit-mwa',
    'bs information technology - mobile and web applications'
  );

UPDATE public.users u
SET department_id = p.department_id
FROM public.programs p
WHERE u.role = 'student'
  AND u.program_id = p.id
  AND (u.department_id IS NULL OR u.department_id <> p.department_id);

UPDATE public.users u
SET department = d.name
FROM public.departments d
WHERE u.department_id = d.id
  AND (u.department IS NULL OR trim(u.department) = '');

UPDATE public.users u
SET program = p.name
FROM public.programs p
WHERE u.program_id = p.id
  AND (u.program IS NULL OR trim(u.program) = '');

UPDATE public.research_papers rp
SET program_id = u.program_id
FROM public.users u
WHERE rp.author_id = u.id
  AND rp.program_id IS NULL
  AND u.program_id IS NOT NULL;

WITH bsit_program AS (
  SELECT id
  FROM public.programs
  WHERE lower(code) = 'bsit-mwa'
     OR lower(name) = 'bs information technology - mobile and web applications'
  ORDER BY name
  LIMIT 1
)
UPDATE public.research_papers rp
SET program_id = bp.id
FROM bsit_program bp
WHERE rp.program_id IS NULL
  AND lower(replace(COALESCE(rp.department, ''), '_', '-')) IN (
    'bsit',
    'bsit-mwa',
    'bs information technology - mobile and web applications'
  );

UPDATE public.research_papers rp
SET department_id = p.department_id
FROM public.programs p
WHERE rp.program_id = p.id
  AND (rp.department_id IS NULL OR rp.department_id <> p.department_id);

UPDATE public.research_papers rp
SET department_id = u.department_id
FROM public.users u
WHERE rp.author_id = u.id
  AND rp.department_id IS NULL
  AND u.department_id IS NOT NULL;

UPDATE public.research_papers rp
SET department = d.name
FROM public.departments d
WHERE rp.department_id = d.id
  AND (rp.department IS NULL OR trim(rp.department) = '');

COMMIT;

-- =============================================================================
-- Optional verification queries
-- =============================================================================
-- SELECT role, COUNT(*) FILTER (WHERE department_id IS NULL) AS missing_department,
--        COUNT(*) FILTER (WHERE program_id IS NULL) AS missing_program
-- FROM public.users
-- GROUP BY role
-- ORDER BY role;
--
-- SELECT COUNT(*) AS papers_missing_department FROM public.research_papers WHERE department_id IS NULL;
-- SELECT COUNT(*) AS papers_missing_program FROM public.research_papers WHERE program_id IS NULL;
