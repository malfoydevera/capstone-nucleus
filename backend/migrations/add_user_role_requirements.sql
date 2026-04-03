-- =============================================================================
-- MIGRATION: Enforce role-based user assignment requirements
-- =============================================================================
-- Description:
--   Adds a trigger that validates department/program requirements by role.
--   This enforces future inserts/updates without risking immediate failure on
--   legacy rows that may still need data cleanup.
--
-- Rules:
--   - student: program_id is required
--   - student: department_id must match the parent department of program_id
--   - non-student: program_id must be NULL
--   - faculty, dean, program_chair: department_id is required
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_user_role_requirements()
RETURNS trigger AS $$
DECLARE
  v_program_department uuid;
BEGIN
  IF NEW.role = 'student' THEN
    IF NEW.program_id IS NULL THEN
      RAISE EXCEPTION 'Students must have a program_id';
    END IF;

    SELECT department_id INTO v_program_department
    FROM public.programs
    WHERE id = NEW.program_id;

    IF v_program_department IS NULL THEN
      RAISE EXCEPTION 'Invalid program_id for student: %', NEW.program_id;
    END IF;

    IF NEW.department_id IS NULL THEN
      NEW.department_id := v_program_department;
    ELSIF NEW.department_id <> v_program_department THEN
      RAISE EXCEPTION 'Student program_id % does not belong to department_id %', NEW.program_id, NEW.department_id;
    END IF;
  ELSE
    IF NEW.program_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only students can have a program_id';
    END IF;
  END IF;

  IF NEW.role IN ('faculty', 'dean', 'program_chair') AND NEW.department_id IS NULL THEN
    RAISE EXCEPTION 'Role % must have a department_id', NEW.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_user_role_requirements ON public.users;
CREATE TRIGGER trg_validate_user_role_requirements
BEFORE INSERT OR UPDATE OF role, program_id, department_id
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_role_requirements();

COMMIT;

-- =============================================================================
-- Optional verification query
-- =============================================================================
-- SELECT id, email, role, department_id, program_id
-- FROM public.users
-- WHERE
--   (role = 'student' AND program_id IS NULL)
--   OR (role <> 'student' AND program_id IS NOT NULL)
--   OR (role IN ('faculty', 'dean', 'program_chair') AND department_id IS NULL);
