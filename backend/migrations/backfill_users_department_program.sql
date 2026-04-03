-- =============================================================================
-- MIGRATION: Backfill users.department/program and enforce department-program consistency
-- =============================================================================
-- Description:
--   1) Backfills users.department_id and users.program_id from legacy text columns
--   2) Backfills legacy text columns from lookup table FKs
--   3) Adds a trigger to ensure users.program_id belongs to users.department_id
-- Safe to run multiple times.
-- =============================================================================

BEGIN;

-- 1) Backfill department_id from existing program_id when department_id is missing.
UPDATE public.users u
SET department_id = p.department_id
FROM public.programs p
WHERE u.program_id = p.id
  AND u.department_id IS NULL;

-- 2) Backfill program_id from legacy users.program text.
--    Prefer match by code first, then by name.
UPDATE public.users u
SET program_id = p.id
FROM public.programs p
WHERE u.program_id IS NULL
  AND u.program IS NOT NULL
  AND (
    lower(trim(u.program)) = lower(trim(p.code))
    OR lower(trim(u.program)) = lower(trim(p.name))
  )
  AND (
    u.department_id IS NULL
    OR u.department_id = p.department_id
  );

-- 3) Backfill department_id from legacy users.department text.
--    Prefer code or name matches.
UPDATE public.users u
SET department_id = d.id
FROM public.departments d
WHERE u.department_id IS NULL
  AND u.department IS NOT NULL
  AND (
    lower(trim(u.department)) = lower(trim(d.code))
    OR lower(trim(u.department)) = lower(trim(d.name))
  );

-- 4) If program_id exists, set department_id to the program's parent department.
--    This guarantees one program maps to exactly one department.
UPDATE public.users u
SET department_id = p.department_id
FROM public.programs p
WHERE u.program_id = p.id
  AND (u.department_id IS NULL OR u.department_id <> p.department_id);

-- 5) Backfill legacy text columns from FK lookups for backward compatibility.
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

-- 6) Guardrail: program must belong to selected department.
CREATE OR REPLACE FUNCTION public.validate_user_program_department()
RETURNS trigger AS $$
DECLARE
  v_program_department uuid;
BEGIN
  IF NEW.program_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT department_id INTO v_program_department
  FROM public.programs
  WHERE id = NEW.program_id;

  IF v_program_department IS NULL THEN
    RAISE EXCEPTION 'Invalid program_id: %', NEW.program_id;
  END IF;

  IF NEW.department_id IS NULL THEN
    NEW.department_id := v_program_department;
    RETURN NEW;
  END IF;

  IF NEW.department_id <> v_program_department THEN
    RAISE EXCEPTION 'program_id % does not belong to department_id %', NEW.program_id, NEW.department_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_user_program_department ON public.users;
CREATE TRIGGER trg_validate_user_program_department
BEFORE INSERT OR UPDATE OF program_id, department_id
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_program_department();

COMMIT;

-- =============================================================================
-- Optional verification queries
-- =============================================================================
-- SELECT role, COUNT(*) AS total_users FROM public.users GROUP BY role ORDER BY role;
-- SELECT COUNT(*) AS users_without_department FROM public.users WHERE department_id IS NULL;
-- SELECT COUNT(*) AS students_without_program FROM public.users WHERE role = 'student' AND program_id IS NULL;
-- SELECT u.id, u.email, u.department, u.program
-- FROM public.users u
-- WHERE (u.department_id IS NULL OR (u.role = 'student' AND u.program_id IS NULL));
