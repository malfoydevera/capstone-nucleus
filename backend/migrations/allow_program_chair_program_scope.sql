-- =============================================================================
-- MIGRATION: Allow program chairs to carry program scope
-- =============================================================================
-- Description:
--   Updates role-based validation so program chairs can store program_id while
--   still inheriting and validating the parent department.
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
  ELSIF NEW.role = 'program_chair' THEN
    IF NEW.program_id IS NULL THEN
      RAISE EXCEPTION 'Program Chair must have a program_id';
    END IF;

    SELECT department_id INTO v_program_department
    FROM public.programs
    WHERE id = NEW.program_id;

    IF v_program_department IS NULL THEN
      RAISE EXCEPTION 'Invalid program_id for program chair: %', NEW.program_id;
    END IF;

    IF NEW.department_id IS NULL THEN
      NEW.department_id := v_program_department;
    ELSIF NEW.department_id <> v_program_department THEN
      RAISE EXCEPTION 'Program Chair program_id % does not belong to department_id %', NEW.program_id, NEW.department_id;
    END IF;
  ELSE
    IF NEW.program_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only students and program chairs can have a program_id';
    END IF;
  END IF;

  IF NEW.role IN ('faculty', 'dean', 'program_chair') AND NEW.department_id IS NULL THEN
    RAISE EXCEPTION 'Role % must have a department_id', NEW.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
