-- Configurable workflow stages for admin-managed review pipelines
CREATE TABLE IF NOT EXISTS workflow_stages (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  label VARCHAR(120) NOT NULL,
  reviewer_role VARCHAR(32) NOT NULL,
  position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO workflow_stages (code, label, reviewer_role, position, is_active)
VALUES
  ('pending_faculty', 'Faculty Review', 'faculty', 10, TRUE),
  ('pending_dean', 'Dean Review', 'dean', 20, TRUE),
  ('pending_program_chair', 'Program Chair Review', 'program_chair', 30, TRUE),
  ('pending_editor', 'Research Editor Review', 'staff', 40, TRUE),
  ('pending_admin', 'Admin Final Review', 'admin', 50, TRUE),
  ('approved', 'Approved / Published', 'admin', 60, TRUE)
ON CONFLICT (code) DO NOTHING;
