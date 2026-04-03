-- Schema catch-up migration for environments missing recently added tables/columns.
-- Safe to run multiple times.

-- 1) Review deadline reminder tracking column
ALTER TABLE IF EXISTS research_papers
  ADD COLUMN IF NOT EXISTS deadline_reminder_last_sent_at timestamptz;

-- 2) System policy settings table
CREATE TABLE IF NOT EXISTS system_policy_settings (
  id boolean PRIMARY KEY DEFAULT true,
  max_file_size_mb integer NOT NULL DEFAULT 100,
  allowed_file_types text[] NOT NULL DEFAULT ARRAY['pdf', 'doc', 'docx'],
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_policy_settings_singleton CHECK (id = true)
);

INSERT INTO system_policy_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- 3) Workflow stages table
CREATE TABLE IF NOT EXISTS workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  reviewer_role text NOT NULL,
  position integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_position
  ON workflow_stages (position);

-- Seed defaults only when missing
INSERT INTO workflow_stages (code, label, reviewer_role, position, is_active)
VALUES
  ('pending_faculty', 'Faculty Review', 'faculty', 10, true),
  ('pending_dean', 'Dean Review', 'dean', 20, true),
  ('pending_program_chair', 'Program Chair Review', 'program_chair', 30, true),
  ('pending_editor', 'Research Editor Review', 'staff', 40, true),
  ('pending_admin', 'Admin Final Review', 'admin', 50, true),
  ('approved', 'Approved / Published', 'admin', 60, true)
ON CONFLICT (code) DO NOTHING;

-- 4) Co-author invitations table
CREATE TABLE IF NOT EXISTS co_author_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email text NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT co_author_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  CONSTRAINT co_author_invitations_unique_pending
    UNIQUE (research_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_co_author_invitations_invitee
  ON co_author_invitations (invitee_id);

CREATE INDEX IF NOT EXISTS idx_co_author_invitations_research
  ON co_author_invitations (research_id);

CREATE INDEX IF NOT EXISTS idx_co_author_invitations_status
  ON co_author_invitations (status);

-- 5) Plagiarism result columns
ALTER TABLE IF EXISTS research_papers
  ADD COLUMN IF NOT EXISTS plagiarism_status text,
  ADD COLUMN IF NOT EXISTS plagiarism_score integer,
  ADD COLUMN IF NOT EXISTS plagiarism_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS plagiarism_provider text,
  ADD COLUMN IF NOT EXISTS plagiarism_summary text,
  ADD COLUMN IF NOT EXISTS plagiarism_report jsonb;

-- Default existing null statuses to not_checked for consistency
UPDATE research_papers
SET plagiarism_status = 'not_checked'
WHERE plagiarism_status IS NULL;
