-- Migration: Add Dean & Program Chair Roles to Workflow
-- Date: 2026-03-09
-- Schema source: Verified against live Supabase schema dump
-- Description: Inserts Dean and Program Chair as Stage 2 in the review chain.
--              Full new flow: Adviser (faculty) → Dean OR Program Chair → Research Editor (staff) → Admin
--
-- STATUS: This migration reflects the CURRENT live schema.
--         Run ONLY if migrating a database that is still on the old schema.
--         The live DB already has all these changes applied.
--
-- IMPORTANT: Run AFTER add_faculty_workflow.sql has already been applied.

-- ============================================
-- PRE-FLIGHT CHECK
-- Run these SELECTs first to confirm your DB state before applying.
-- ============================================
/*
-- 1. See all CHECK constraints on users and research_papers
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('public.users'::regclass, 'public.research_papers'::regclass)
  AND contype = 'c'
ORDER BY conrelid, conname;

-- 2. Check if dean_chair_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'research_papers'
  AND column_name = 'dean_chair_id';
*/


-- ============================================
-- 1. Extend the users role constraint
-- ============================================
-- Live schema constraint name is auto-generated. This DO block finds it
-- by pattern and only drops it if 'dean' is not already present.

DO $$
DECLARE
  v_constraint_name text;
  v_constraint_def  text;
BEGIN
  SELECT conname, pg_get_constraintdef(oid)
  INTO v_constraint_name, v_constraint_def
  FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
    AND pg_get_constraintdef(oid) LIKE '%student%';

  IF v_constraint_name IS NOT NULL THEN
    IF v_constraint_def NOT LIKE '%dean%' THEN
      EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT ' || quote_ident(v_constraint_name);
      RAISE NOTICE 'Dropped old users role constraint: %', v_constraint_name;
    ELSE
      RAISE NOTICE 'users role constraint already includes dean/program_chair — skipping drop.';
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role::text = ANY (ARRAY[
    'student'::text,
    'faculty'::text,
    'staff'::text,
    'admin'::text,
    'dean'::text,
    'program_chair'::text
  ]));


-- ============================================
-- 2. Extend the research_papers status constraint
-- ============================================

DO $$
DECLARE
  v_constraint_name text;
  v_constraint_def  text;
BEGIN
  SELECT conname, pg_get_constraintdef(oid)
  INTO v_constraint_name, v_constraint_def
  FROM pg_constraint
  WHERE conrelid = 'public.research_papers'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
    AND pg_get_constraintdef(oid) LIKE '%pending%';

  IF v_constraint_name IS NOT NULL THEN
    IF v_constraint_def NOT LIKE '%pending_dean%' THEN
      EXECUTE 'ALTER TABLE public.research_papers DROP CONSTRAINT ' || quote_ident(v_constraint_name);
      RAISE NOTICE 'Dropped old research_papers status constraint: %', v_constraint_name;
    ELSE
      RAISE NOTICE 'research_papers status constraint already includes pending_dean — skipping drop.';
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.research_papers DROP CONSTRAINT IF EXISTS research_papers_status_check;
ALTER TABLE public.research_papers
  ADD CONSTRAINT research_papers_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending'::text,                -- Legacy: initial submission without faculty
    'pending_faculty'::text,        -- Stage 1: Awaiting Adviser review
    'pending_dean'::text,           -- Stage 2a: Awaiting Dean review
    'pending_program_chair'::text,  -- Stage 2b: Awaiting Program Chair review
    'pending_editor'::text,         -- Stage 3: Awaiting Research Editor (staff) review
    'pending_admin'::text,          -- Stage 4: Awaiting Admin final approval
    'under_review'::text,           -- Legacy: generic under review
    'faculty_approved'::text,       -- Legacy intermediate (kept for compatibility)
    'editor_approved'::text,        -- Legacy intermediate (kept for compatibility)
    'approved'::text,               -- Final: approved and published
    'published'::text,              -- Alternative published state
    'rejected'::text,               -- Rejected at any stage
    'revision_required'::text       -- Needs revision (returned to student)
  ]));


-- ============================================
-- 3. Add dean_chair_id column + FK to research_papers
-- ============================================
-- Stores the specific Dean or Program Chair the Adviser assigned this paper to.
-- FK name in live schema: research_papers_dean_chair_id_fkey

ALTER TABLE public.research_papers
  ADD COLUMN IF NOT EXISTS dean_chair_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_papers_dean_chair_id_fkey'
      AND conrelid = 'public.research_papers'::regclass
  ) THEN
    ALTER TABLE public.research_papers
      ADD CONSTRAINT research_papers_dean_chair_id_fkey
      FOREIGN KEY (dean_chair_id) REFERENCES public.users(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'Added FK constraint research_papers_dean_chair_id_fkey.';
  ELSE
    RAISE NOTICE 'FK research_papers_dean_chair_id_fkey already exists — skipping.';
  END IF;
END;
$$;


-- ============================================
-- 4. approval_workflow — reviewer_role
-- ============================================
-- In the live schema, reviewer_role is plain VARCHAR with NO CHECK constraint.
-- Application layer enforces valid values. Nothing to alter here.
--
-- Optional explicit constraint (uncomment if you want DB-level enforcement):
-- ALTER TABLE public.approval_workflow
--   ADD CONSTRAINT approval_workflow_reviewer_role_check
--   CHECK (reviewer_role IN ('faculty', 'dean', 'program_chair', 'staff', 'admin'));


-- ============================================
-- 5. Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_research_papers_dean_chair_id
  ON public.research_papers(dean_chair_id);

-- Partial indexes for the two new pending stages (speeds up dashboard queries)
CREATE INDEX IF NOT EXISTS idx_research_pending_dean
  ON public.research_papers(dean_chair_id)
  WHERE status = 'pending_dean';

CREATE INDEX IF NOT EXISTS idx_research_pending_program_chair
  ON public.research_papers(dean_chair_id)
  WHERE status = 'pending_program_chair';

-- General supporting indexes (safe to run — IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_research_papers_status
  ON public.research_papers(status);

CREATE INDEX IF NOT EXISTS idx_research_papers_faculty_id
  ON public.research_papers(faculty_id);


-- ============================================
-- 6. Verification queries
-- ============================================
-- Uncomment and run after applying to confirm everything is correct.
/*
SELECT 'users.role constraint' AS check_name, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass AND contype = 'c' AND conname LIKE '%role%'

UNION ALL

SELECT 'research_papers.status constraint', pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.research_papers'::regclass AND contype = 'c' AND conname LIKE '%status%'

UNION ALL

SELECT 'dean_chair_id column exists', data_type::text
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'research_papers'
  AND column_name = 'dean_chair_id'

UNION ALL

SELECT 'dean_chair_id FK exists', conname
FROM pg_constraint
WHERE conname = 'research_papers_dean_chair_id_fkey';
*/


-- ============================================
-- ROLLBACK SCRIPT
-- ============================================
/*
DROP INDEX IF EXISTS public.idx_research_papers_dean_chair_id;
DROP INDEX IF EXISTS public.idx_research_pending_dean;
DROP INDEX IF EXISTS public.idx_research_pending_program_chair;
DROP INDEX IF EXISTS public.idx_research_papers_status;
DROP INDEX IF EXISTS public.idx_research_papers_faculty_id;

-- Drops column AND its FK constraint automatically
ALTER TABLE public.research_papers DROP COLUMN IF EXISTS dean_chair_id;

-- Revert users role to original 4 roles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role::text = ANY (ARRAY[
    'student'::text, 'faculty'::text, 'staff'::text, 'admin'::text
  ]));

-- Revert research_papers status to pre-dean statuses
ALTER TABLE public.research_papers DROP CONSTRAINT IF EXISTS research_papers_status_check;
ALTER TABLE public.research_papers
  ADD CONSTRAINT research_papers_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending'::text, 'pending_faculty'::text, 'under_review'::text,
    'faculty_approved'::text, 'editor_approved'::text,
    'pending_editor'::text, 'pending_admin'::text,
    'approved'::text, 'published'::text,
    'rejected'::text, 'revision_required'::text
  ]));
*/

