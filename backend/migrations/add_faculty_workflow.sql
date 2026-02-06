-- Migration: Add Faculty Role and Sequential Approval Workflow
-- Date: 2026-01-22
-- Description: Adds faculty role, faculty assignment, department field, and new workflow statuses

-- ============================================
-- 1. Update users table to include 'faculty' role
-- ============================================
-- Note: If you have a CHECK constraint on the role column, update it:
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check 
--   CHECK (role IN ('student', 'faculty', 'staff', 'admin'));

-- Add department field to users table (for faculty members)
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- ============================================
-- 2. Update research_papers table
-- ============================================
-- Add faculty_id foreign key
ALTER TABLE research_papers 
ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add department field
ALTER TABLE research_papers 
ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Add revision tracking fields
ALTER TABLE research_papers 
ADD COLUMN IF NOT EXISTS revision_notes TEXT;

ALTER TABLE research_papers 
ADD COLUMN IF NOT EXISTS last_reviewer_role VARCHAR(20);

ALTER TABLE research_papers 
ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);

ALTER TABLE research_papers 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_research_papers_faculty_id ON research_papers(faculty_id);
CREATE INDEX IF NOT EXISTS idx_research_papers_department ON research_papers(department);

-- ============================================
-- 3. Expand status column values
-- ============================================
-- Update status check constraint to include new workflow statuses
-- Note: Adjust based on your actual constraint name
-- ALTER TABLE research_papers DROP CONSTRAINT IF EXISTS research_papers_status_check;
-- ALTER TABLE research_papers ADD CONSTRAINT research_papers_status_check 
--   CHECK (status IN (
--     'pending',              -- Initial submission (legacy)
--     'pending_faculty',      -- Awaiting faculty review
--     'faculty_approved',     -- Faculty approved, moving to editor
--     'pending_editor',       -- Awaiting editor/staff review
--     'editor_approved',      -- Editor approved, moving to admin
--     'pending_admin',        -- Awaiting admin final approval
--     'under_review',         -- Currently being reviewed (legacy)
--     'approved',             -- Final approval (published)
--     'rejected',             -- Rejected at any stage
--     'revision_required',    -- Needs revision
--     'published'             -- Published (alternative to approved)
--   ));

-- ============================================
-- 4. Update existing pending papers to pending_faculty
-- ============================================
-- Migrate existing 'pending' status papers to the new workflow
-- UPDATE research_papers 
-- SET status = 'pending_faculty' 
-- WHERE status = 'pending' AND faculty_id IS NULL;

-- ============================================
-- 5. Create/Update notifications structure
-- ============================================
-- Ensure notifications table can track faculty transitions
-- This assumes your notifications table already exists with proper structure
-- If not, create it:
/*
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  research_id UUID REFERENCES research_papers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_research_id (research_id),
  INDEX idx_notifications_created_at (created_at)
);
*/

-- ============================================
-- 6. Create faculty_reviews table (optional)
-- ============================================
-- Track detailed faculty review history
CREATE TABLE IF NOT EXISTS faculty_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_id UUID NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('approved', 'rejected', 'revision_required')),
  comments TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_research FOREIGN KEY (research_id) REFERENCES research_papers(id),
  CONSTRAINT fk_faculty FOREIGN KEY (faculty_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_faculty_reviews_research_id ON faculty_reviews(research_id);
CREATE INDEX IF NOT EXISTS idx_faculty_reviews_faculty_id ON faculty_reviews(faculty_id);

-- ============================================
-- 7. Update approval_workflow table
-- ============================================
-- Ensure approval_workflow can track faculty reviews
-- ALTER TABLE approval_workflow ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES users(id);

-- ============================================
-- NOTES:
-- ============================================
-- 1. Run this migration in your Supabase SQL Editor
-- 2. Uncomment the ALTER TABLE statements based on your actual constraint names
-- 3. Test the workflow with a sample submission
-- 4. Update your RLS policies if needed to grant faculty access
-- 5. Consider adding audit triggers for tracking changes

-- ============================================
-- Sample RLS Policies for Faculty
-- ============================================
-- Allow faculty to view papers assigned to them
/*
CREATE POLICY "Faculty can view assigned papers" ON research_papers
  FOR SELECT
  USING (auth.uid() = faculty_id);

CREATE POLICY "Faculty can update assigned papers" ON research_papers
  FOR UPDATE
  USING (auth.uid() = faculty_id AND status = 'pending_faculty');
*/

-- ============================================
-- Rollback Script (in case of issues)
-- ============================================
/*
-- Rollback: Remove faculty-related columns and constraints
ALTER TABLE research_papers DROP COLUMN IF EXISTS faculty_id;
ALTER TABLE research_papers DROP COLUMN IF EXISTS department;
ALTER TABLE users DROP COLUMN IF EXISTS department;
DROP TABLE IF EXISTS faculty_reviews;
DROP INDEX IF EXISTS idx_research_papers_faculty_id;
DROP INDEX IF EXISTS idx_research_papers_department;
*/
