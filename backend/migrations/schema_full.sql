-- =============================================================================
-- FULL DATABASE SCHEMA — Capstone Research Repository
-- =============================================================================
-- Date:        2026-03-10
-- Description: Complete schema for context and documentation purposes.
--              Reflects the live Supabase database as of the date above.
--
-- Table of Contents:
--   1.  extensions          — Required Postgres extensions
--   2.  users               — All system accounts (student, faculty, staff, admin, dean, program_chair)
--   3.  profiles            — Supabase Auth mirror (legacy)
--   4.  research_categories — Lookup table for paper categories
--   5.  research_papers     — Core research paper submissions
--   6.  research_authors    — Co-author join table
--   7.  research_comments   — Internal and public comments on papers
--   8.  faculty_reviews     — Stage 1 review records (adviser → paper)
--   9.  approval_workflow   — Full audit trail for every review action
--   10. notifications       — In-app notification feed
--   11. paper_views         — View analytics per paper per user
--   12. paper_downloads     — Download analytics per paper per user
--   13. Indexes             — Performance indexes
--   14. Notes               — Schema decisions and known issues
--
-- WARNING: This file is for documentation/context only.
--          DO NOT run this on a live database — it will fail on existing objects.
--          Use individual migration files for incremental changes.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()


-- =============================================================================
-- 2. USERS
-- =============================================================================
-- Central authentication and identity table.
-- All roles are stored here; Supabase Auth is NOT used for JWT — the app
-- issues its own JWTs via bcryptjs + jsonwebtoken.
--
-- Roles:
--   student       — submits research papers
--   faculty       — Adviser; Stage 1 reviewer; assigns Dean or Program Chair
--   dean          — Stage 2a reviewer (assigned by Adviser)
--   program_chair — Stage 2b reviewer (assigned by Adviser)
--   staff         — Research Editor; Stage 3 reviewer
--   admin         — Final approver; full system access
--
-- Workflow: student → faculty → (dean | program_chair) → staff → admin

CREATE TABLE public.users (
  id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  email               varchar       NOT NULL UNIQUE,
  password            varchar       NOT NULL,          -- bcrypt hash (cost 10)
  full_name           varchar       NOT NULL,
  role                varchar       NOT NULL,
  profile_picture_url text,
  bio                 text,
  program             text,                            -- student's academic program
  department          varchar,                         -- faculty/dean/chair department
  created_at          timestamptz   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT users_pkey PRIMARY KEY (id),

  -- Only these 6 role values are valid
  CONSTRAINT users_role_check
    CHECK (role::text = ANY (ARRAY[
      'student'::text,
      'faculty'::text,
      'staff'::text,
      'admin'::text,
      'dean'::text,
      'program_chair'::text
    ]))
);

COMMENT ON TABLE  public.users IS 'All system users. JWTs are issued by the Express backend, not Supabase Auth.';
COMMENT ON COLUMN public.users.role IS 'student | faculty | staff | admin | dean | program_chair';
COMMENT ON COLUMN public.users.password IS 'bcrypt hash, cost factor 10';
COMMENT ON COLUMN public.users.department IS 'Only relevant for faculty, dean, program_chair, staff roles';


-- =============================================================================
-- 3. PROFILES (Legacy)
-- =============================================================================
-- Created automatically by Supabase Auth but not actively used by the app.
-- The app uses the public.users table exclusively for auth and role management.

CREATE TABLE public.profiles (
  id   uuid NOT NULL,
  role text DEFAULT 'User'::text,

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),

  CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY['User'::text, 'Staff'::text, 'Admin'::text]))
);

COMMENT ON TABLE public.profiles IS 'Legacy Supabase Auth mirror. Not used by the application — use public.users instead.';


-- =============================================================================
-- 4. RESEARCH CATEGORIES
-- =============================================================================
-- Lookup table for research paper categories (e.g. "Computer Science", "Engineering").
-- Used for the category dropdown on the Submit Research form.

CREATE TABLE public.research_categories (
  id          uuid    NOT NULL DEFAULT gen_random_uuid(),
  name        varchar NOT NULL UNIQUE,
  description text,
  created_at  timestamptz DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT research_categories_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.research_categories IS 'Lookup values for research paper categories. Managed by admin.';


-- =============================================================================
-- 5. RESEARCH PAPERS
-- =============================================================================
-- Core table. One row per submitted paper.
-- Status tracks the paper through the 4-tier review workflow.
--
-- Workflow statuses:
--   pending              → Legacy: submitted without an assigned adviser
--   pending_faculty      → Stage 1: waiting for Adviser review
--   pending_dean         → Stage 2a: forwarded to Dean
--   pending_program_chair → Stage 2b: forwarded to Program Chair
--   pending_editor       → Stage 3: waiting for Research Editor (staff) review
--   pending_admin        → Stage 4: waiting for Admin final approval
--   revision_required    → Returned to student for revision (from any stage)
--   rejected             → Permanently rejected (from any stage)
--   approved             → Final approval granted
--   published            → Alternative final state
--   under_review         → Legacy generic status
--   faculty_approved     → Legacy intermediate (Adviser approved, pre-dean workflow)
--   editor_approved      → Legacy intermediate (Editor approved, pre-admin workflow)

CREATE TABLE public.research_papers (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  title             varchar     NOT NULL,
  abstract          text        NOT NULL,
  keywords          text[],                            -- array of keyword strings
  author_id         uuid        NOT NULL,              -- primary submitting student
  co_authors        text,                              -- legacy: co-author names as plain text
  category          varchar     NOT NULL,
  file_url          text        NOT NULL,              -- Supabase Storage URL
  file_name         varchar     NOT NULL,
  file_size         bigint      NOT NULL,              -- bytes
  status            varchar     NOT NULL DEFAULT 'pending',
  submission_date   timestamptz DEFAULT CURRENT_TIMESTAMP,
  published_date    timestamptz,
  rejection_reason  text,                             -- set on reject
  revision_notes    text,                             -- set on request-revision
  view_count        integer     DEFAULT 0,
  download_count    integer     DEFAULT 0,
  faculty_id        uuid,                             -- Adviser assigned to this paper
  department        varchar,
  last_reviewer_role varchar,                         -- role of last person who acted
  previous_status   varchar,                          -- status before latest revision request
  dean_chair_id     uuid,                             -- Dean or Program Chair assigned at Stage 2
  created_at        timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at        timestamptz DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT research_papers_pkey PRIMARY KEY (id),
  CONSTRAINT research_papers_author_id_fkey  FOREIGN KEY (author_id)    REFERENCES public.users(id),
  CONSTRAINT research_papers_faculty_id_fkey FOREIGN KEY (faculty_id)   REFERENCES public.users(id),
  CONSTRAINT research_papers_dean_chair_id_fkey FOREIGN KEY (dean_chair_id) REFERENCES public.users(id) ON DELETE SET NULL,

  CONSTRAINT research_papers_status_check
    CHECK (status::text = ANY (ARRAY[
      'pending'::text,
      'pending_faculty'::text,
      'pending_dean'::text,
      'pending_program_chair'::text,
      'pending_editor'::text,
      'pending_admin'::text,
      'under_review'::text,
      'faculty_approved'::text,
      'editor_approved'::text,
      'approved'::text,
      'published'::text,
      'rejected'::text,
      'revision_required'::text
    ]))
);

COMMENT ON TABLE  public.research_papers IS 'Core research submission table. One row per paper.';
COMMENT ON COLUMN public.research_papers.author_id IS 'The primary student submitter';
COMMENT ON COLUMN public.research_papers.faculty_id IS 'Adviser (faculty role) assigned to review this paper at Stage 1';
COMMENT ON COLUMN public.research_papers.dean_chair_id IS 'Dean or Program Chair assigned by the Adviser at Stage 2. Determines which stage 2 status applies.';
COMMENT ON COLUMN public.research_papers.last_reviewer_role IS 'Role of the last person who took action. Used for routing revisions back to correct stage.';
COMMENT ON COLUMN public.research_papers.previous_status IS 'Status before a revision was requested. Used to route resubmissions back to the right stage.';
COMMENT ON COLUMN public.research_papers.keywords IS 'Postgres text array, e.g. {machine learning, deep learning}';
COMMENT ON COLUMN public.research_papers.co_authors IS 'Legacy plain-text field. Structured co-authors are in research_authors table.';


-- =============================================================================
-- 6. RESEARCH AUTHORS
-- =============================================================================
-- Structured co-author join table (replaces the legacy co_authors text column).
-- Supports author ordering and primary author flag.

CREATE TABLE public.research_authors (
  id           uuid    NOT NULL DEFAULT uuid_generate_v4(),
  research_id  uuid    NOT NULL,
  user_id      uuid    NOT NULL,
  author_order integer NOT NULL DEFAULT 1,
  is_primary   boolean DEFAULT false,
  created_at   timestamptz DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT research_authors_pkey PRIMARY KEY (id),
  CONSTRAINT research_authors_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.research_papers(id),
  CONSTRAINT research_authors_user_id_fkey     FOREIGN KEY (user_id)     REFERENCES public.users(id)
);

COMMENT ON TABLE  public.research_authors IS 'Structured co-author records. Replaces the legacy co_authors text column on research_papers.';
COMMENT ON COLUMN public.research_authors.author_order IS '1 = first author, 2 = second, etc.';
COMMENT ON COLUMN public.research_authors.is_primary IS 'True for the main submitting author (mirrors research_papers.author_id)';


-- =============================================================================
-- 7. RESEARCH COMMENTS
-- =============================================================================
-- Comment thread on a paper. Can be internal (reviewer-only) or public.

CREATE TABLE public.research_comments (
  id          uuid    NOT NULL DEFAULT gen_random_uuid(),
  research_id uuid    NOT NULL,
  user_id     uuid    NOT NULL,
  comment     text    NOT NULL,
  is_internal boolean DEFAULT false,    -- true = only visible to reviewers/admin
  created_at  timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at  timestamptz DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT research_comments_pkey PRIMARY KEY (id),
  CONSTRAINT research_comments_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.research_papers(id),
  CONSTRAINT research_comments_user_id_fkey     FOREIGN KEY (user_id)     REFERENCES public.users(id)
);

COMMENT ON TABLE  public.research_comments IS 'Comment threads on papers. is_internal = true restricts visibility to reviewers and admins.';


-- =============================================================================
-- 8. FACULTY REVIEWS
-- =============================================================================
-- Records each Adviser (faculty) review decision on a paper.
-- Note: dean/program_chair/staff/admin review decisions go to approval_workflow instead.

CREATE TABLE public.faculty_reviews (
  id          uuid    NOT NULL DEFAULT uuid_generate_v4(),
  research_id uuid    NOT NULL,
  faculty_id  uuid    NOT NULL,
  status      varchar NOT NULL,
  comments    text,
  reviewed_at timestamptz DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT faculty_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_reviews_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.research_papers(id),
  CONSTRAINT faculty_reviews_faculty_id_fkey  FOREIGN KEY (faculty_id)  REFERENCES public.users(id),

  -- Duplicate FKs from original schema (kept for compatibility)
  CONSTRAINT fk_research FOREIGN KEY (research_id) REFERENCES public.research_papers(id),
  CONSTRAINT fk_faculty  FOREIGN KEY (faculty_id)  REFERENCES public.users(id),

  CONSTRAINT faculty_reviews_status_check
    CHECK (status::text = ANY (ARRAY[
      'approved'::text,
      'rejected'::text,
      'revision_required'::text
    ]))
);

COMMENT ON TABLE public.faculty_reviews IS 'Adviser review decisions. Dean/Chair/Staff/Admin decisions are in approval_workflow.';


-- =============================================================================
-- 9. APPROVAL WORKFLOW
-- =============================================================================
-- Full audit trail of every review action across all roles and stages.
-- One row per action (approve / reject / request_revision).
-- reviewer_role is a free-text VARCHAR — no CHECK constraint — validated at app layer.

CREATE TABLE public.approval_workflow (
  id            uuid    NOT NULL DEFAULT gen_random_uuid(),
  research_id   uuid    NOT NULL,
  reviewer_id   uuid    NOT NULL,
  reviewer_role varchar NOT NULL,   -- 'faculty' | 'dean' | 'program_chair' | 'staff' | 'admin'
  status        varchar NOT NULL,
  comments      text,
  reviewed_at   timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_at    timestamptz DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT approval_workflow_pkey PRIMARY KEY (id),
  CONSTRAINT approval_workflow_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.research_papers(id),
  CONSTRAINT approval_workflow_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id),

  CONSTRAINT approval_workflow_status_check
    CHECK (status::text = ANY (ARRAY[
      'pending'::text,
      'approved'::text,
      'rejected'::text,
      'revision_required'::text
    ]))
);

COMMENT ON TABLE  public.approval_workflow IS 'Immutable audit log of every review action. reviewer_role is app-validated (no DB constraint).';
COMMENT ON COLUMN public.approval_workflow.reviewer_role IS 'Valid values: faculty | dean | program_chair | staff | admin. Enforced at application layer.';
COMMENT ON COLUMN public.approval_workflow.status IS 'The action taken: pending | approved | rejected | revision_required';


-- =============================================================================
-- 10. NOTIFICATIONS
-- =============================================================================
-- In-app notification feed. Created by the backend whenever a status change occurs.

CREATE TABLE public.notifications (
  id          uuid    NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid    NOT NULL,    -- recipient
  research_id uuid,               -- related paper (nullable for system notifications)
  type        varchar NOT NULL,   -- e.g. 'paper_approved', 'revision_required', 'paper_rejected'
  title       varchar NOT NULL,
  message     text    NOT NULL,
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey     FOREIGN KEY (user_id)     REFERENCES public.users(id),
  CONSTRAINT notifications_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.research_papers(id)
);

COMMENT ON TABLE  public.notifications IS 'In-app notification feed. Created by backend on every workflow status change.';
COMMENT ON COLUMN public.notifications.type IS 'Examples: paper_approved | paper_rejected | revision_required | paper_submitted';
COMMENT ON COLUMN public.notifications.user_id IS 'The user who should receive this notification';


-- =============================================================================
-- 11. PAPER VIEWS
-- =============================================================================
-- Analytics: one row per (user, paper) view event.
-- The view_count column on research_papers is a denormalized cache of COUNT(*) here.

CREATE TABLE public.paper_views (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id   uuid,
  user_id    uuid,
  viewed_at  timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  CONSTRAINT paper_views_pkey PRIMARY KEY (id),
  CONSTRAINT paper_views_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.research_papers(id),
  CONSTRAINT paper_views_user_id_fkey  FOREIGN KEY (user_id)  REFERENCES public.users(id)
);

COMMENT ON TABLE public.paper_views IS 'Raw view events. research_papers.view_count is a cached aggregate of this table.';


-- =============================================================================
-- 12. PAPER DOWNLOADS
-- =============================================================================
-- Analytics: one row per (user, paper) download event.

CREATE TABLE public.paper_downloads (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id      uuid,
  user_id       uuid,
  downloaded_at timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),

  CONSTRAINT paper_downloads_pkey PRIMARY KEY (id),
  CONSTRAINT paper_downloads_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.research_papers(id),
  CONSTRAINT paper_downloads_user_id_fkey  FOREIGN KEY (user_id)  REFERENCES public.users(id)
);

COMMENT ON TABLE public.paper_downloads IS 'Raw download events. research_papers.download_count is a cached aggregate of this table.';


-- =============================================================================
-- 13. INDEXES
-- =============================================================================

-- users
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users(email);

-- research_papers — workflow stage queries
CREATE INDEX IF NOT EXISTS idx_research_papers_status      ON public.research_papers(status);
CREATE INDEX IF NOT EXISTS idx_research_papers_author_id   ON public.research_papers(author_id);
CREATE INDEX IF NOT EXISTS idx_research_papers_faculty_id  ON public.research_papers(faculty_id);
CREATE INDEX IF NOT EXISTS idx_research_papers_dean_chair_id ON public.research_papers(dean_chair_id);

-- Partial indexes for each pending stage (used by dashboard queries)
CREATE INDEX IF NOT EXISTS idx_research_pending_faculty
  ON public.research_papers(faculty_id)
  WHERE status = 'pending_faculty';

CREATE INDEX IF NOT EXISTS idx_research_pending_dean
  ON public.research_papers(dean_chair_id)
  WHERE status = 'pending_dean';

CREATE INDEX IF NOT EXISTS idx_research_pending_program_chair
  ON public.research_papers(dean_chair_id)
  WHERE status = 'pending_program_chair';

CREATE INDEX IF NOT EXISTS idx_research_pending_editor
  ON public.research_papers(status)
  WHERE status = 'pending_editor';

CREATE INDEX IF NOT EXISTS idx_research_pending_admin
  ON public.research_papers(status)
  WHERE status = 'pending_admin';

-- approval_workflow — audit trail queries
CREATE INDEX IF NOT EXISTS idx_approval_workflow_research_id ON public.approval_workflow(research_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_reviewer_id ON public.approval_workflow(reviewer_id);

-- notifications — unread badge queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id)
  WHERE is_read = false;

-- analytics
CREATE INDEX IF NOT EXISTS idx_paper_views_paper_id     ON public.paper_views(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_downloads_paper_id ON public.paper_downloads(paper_id);


-- =============================================================================
-- 14. SCHEMA NOTES
-- =============================================================================
--
-- AUTHENTICATION
--   - The app uses its own JWT system (Express + jsonwebtoken, 7-day expiry).
--   - Supabase Auth is NOT used for login. public.users.password holds bcrypt hashes.
--   - The public.profiles table exists from Supabase defaults but is unused.
--
-- WORKFLOW ROUTING
--   - When an Adviser approves → they pick a Dean or Program Chair → dean_chair_id is set.
--   - Status becomes 'pending_dean' (if dean picked) or 'pending_program_chair' (if chair picked).
--   - Dean/Chair approves → status becomes 'pending_editor' (staff queue).
--   - Staff approves → status becomes 'pending_admin'.
--   - Admin approves → status becomes 'approved'.
--
-- REVISION ROUTING
--   - Dean/Chair requests revision → student gets 'revision_required', resubmits to same dean/chair.
--   - Staff requests revision → paper returns to pending_dean or pending_program_chair
--     (looked up via dean_chair_id), not back to faculty.
--   - Admin requests revision → notifies all staff, paper goes back to 'pending_editor'.
--   - previous_status and last_reviewer_role columns track where to route resubmissions.
--
-- CO-AUTHORS
--   - Legacy: co_authors (text) on research_papers stores a comma-separated or JSON string.
--   - New: research_authors table provides structured co-author records with ordering.
--   - Both exist simultaneously; new submissions should use research_authors.
--
-- ANALYTICS
--   - paper_views and paper_downloads store raw events.
--   - research_papers.view_count and download_count are denormalized counters
--     incremented by the backend on each event. They may drift if events are bulk-deleted.
--
-- KNOWN ISSUES (from code review)
--   1. Public register endpoint allows any role — fix: restrict to 'student' only,
--      use POST /auth/users/create (admin-only) for privileged roles.
--   2. No rate limiting on auth endpoints (register, login).
--   3. CORS is open ('*') in server.js — restrict to your frontend origin in production.
--   4. Token stored in both sessionStorage and localStorage in api.js — pick one.
--   5. No Axios response interceptor for 401 — users are not auto-logged out on token expiry.
--   6. research.controller.js is 1000+ lines — should be split into a service layer.
--   7. No input validation middleware (e.g. express-validator) — all validation is ad hoc.
-- =============================================================================
