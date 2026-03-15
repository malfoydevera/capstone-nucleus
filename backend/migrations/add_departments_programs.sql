-- =============================================================================
-- MIGRATION: Flexible Department & Program Management
-- =============================================================================
-- Description: Replaces hardcoded department/program strings with two normalized
--              lookup tables (departments → programs).  All existing free-text
--              columns are kept for backwards compatibility.
-- Safe to run multiple times (all DDL uses IF NOT EXISTS / IF EXISTS).
-- =============================================================================

BEGIN;

-- ===========================================================================
-- 1. DEPARTMENTS lookup table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        varchar     NOT NULL,
  code        varchar,           -- short code, e.g. "SECA"
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT departments_pkey    PRIMARY KEY (id),
  CONSTRAINT departments_code_uk UNIQUE (code),
  CONSTRAINT departments_name_uk UNIQUE (name)
);

COMMENT ON TABLE  public.departments IS 'Top-level academic departments. Managed by admin.';
COMMENT ON COLUMN public.departments.code IS 'Short identifier, e.g. SECA, CAS, COE';
COMMENT ON COLUMN public.departments.is_active IS 'Soft-delete flag. Inactive departments are hidden from dropdowns.';

-- ===========================================================================
-- 2. PROGRAMS lookup table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.programs (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  department_id uuid        NOT NULL,
  name          varchar     NOT NULL,
  code          varchar,           -- e.g. "BSIT-MWA", "CPE"
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT programs_pkey PRIMARY KEY (id),
  CONSTRAINT programs_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
  CONSTRAINT programs_dept_code_uk UNIQUE (department_id, code)
);

COMMENT ON TABLE  public.programs IS 'Academic programs belonging to a department.';
COMMENT ON COLUMN public.programs.code IS 'Program code, e.g. BSIT-MWA, BSCS, CE, CPE, Architecture';
COMMENT ON COLUMN public.programs.is_active IS 'Soft-delete flag. Inactive programs are hidden from dropdowns.';

-- ===========================================================================
-- 3. NULLABLE FK columns on users and research_papers
--    (additive — existing free-text columns are untouched)
-- ===========================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'department_id'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN department_id uuid
        REFERENCES public.departments(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.users.department_id IS
      'FK to departments lookup table. NULL means the user was created before this migration or belongs to an uncategorized dept.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'program_id'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN program_id uuid
        REFERENCES public.programs(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.users.program_id IS
      'FK to programs lookup table. Primarily used for students.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'research_papers'
      AND column_name  = 'department_id'
  ) THEN
    ALTER TABLE public.research_papers
      ADD COLUMN department_id uuid
        REFERENCES public.departments(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.research_papers.department_id IS
      'FK to departments lookup table. NULL for papers submitted before this migration.';
  END IF;
END $$;

-- ===========================================================================
-- 4. INDEXES
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_programs_department_id
  ON public.programs(department_id);

CREATE INDEX IF NOT EXISTS idx_users_department_id
  ON public.users(department_id);

CREATE INDEX IF NOT EXISTS idx_users_program_id
  ON public.users(program_id);

CREATE INDEX IF NOT EXISTS idx_research_papers_department_id
  ON public.research_papers(department_id);

-- ===========================================================================
-- 5. SEED — SECA department + 5 programs (current scope)
-- ===========================================================================
DO $$
DECLARE
  v_dept_id uuid;
BEGIN
  -- Insert SECA department (skip if already exists)
  INSERT INTO public.departments (name, code, description)
  VALUES (
    'School of Engineering, Computing, and Architecture',
    'SECA',
    'Covers computing, engineering, and architecture programs at NU Dasmariñas'
  )
  ON CONFLICT (code) DO NOTHING;

  -- Get its id (works whether we just inserted or it already existed)
  SELECT id INTO v_dept_id
  FROM public.departments
  WHERE code = 'SECA';

  -- Insert programs for SECA
  INSERT INTO public.programs (department_id, name, code) VALUES
    (v_dept_id, 'BS Information Technology - Mobile and Web Applications', 'BSIT-MWA'),
    (v_dept_id, 'BS Architecture',                                         'Architecture'),
    (v_dept_id, 'BS Civil Engineering',                                    'CE'),
    (v_dept_id, 'BS Computer Engineering',                                 'CPE'),
    (v_dept_id, 'BS Computer Science',                                     'CS')
  ON CONFLICT (department_id, code) DO NOTHING;
END $$;

COMMIT;

-- ===========================================================================
-- VERIFICATION
-- ===========================================================================
SELECT
  d.code  AS dept_code,
  d.name  AS department,
  COUNT(p.id) AS program_count
FROM public.departments d
LEFT JOIN public.programs p ON p.department_id = d.id AND p.is_active = true
WHERE d.is_active = true
GROUP BY d.id, d.code, d.name
ORDER BY d.name;

-- ===========================================================================
-- ROLLBACK SCRIPT (run manually only to revert)
-- ===========================================================================
-- ALTER TABLE public.research_papers DROP COLUMN IF EXISTS department_id;
-- ALTER TABLE public.users           DROP COLUMN IF EXISTS program_id;
-- ALTER TABLE public.users           DROP COLUMN IF EXISTS department_id;
-- DROP TABLE IF EXISTS public.programs;
-- DROP TABLE IF EXISTS public.departments;
