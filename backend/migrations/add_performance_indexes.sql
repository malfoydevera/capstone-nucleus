-- P-002: Performance indexes for research_papers table
-- Run this migration against your Supabase PostgreSQL database.
-- These indexes significantly speed up the most common filtered queries
-- across all roles (status filtering, author lookups, faculty assignment lookups).

-- Index on status column (most frequent filter: pending_faculty_review, approved, published, etc.)
CREATE INDEX IF NOT EXISTS idx_research_papers_status
  ON research_papers(status);

-- Index on author_id (students querying their own research)
CREATE INDEX IF NOT EXISTS idx_research_papers_author_id
  ON research_papers(author_id);

-- Index on faculty_id (faculty querying papers assigned to them)
CREATE INDEX IF NOT EXISTS idx_research_papers_faculty_id
  ON research_papers(faculty_id);

-- Composite index: status + created_at (common sort pattern on dashboard queries)
CREATE INDEX IF NOT EXISTS idx_research_papers_status_created
  ON research_papers(status, created_at DESC);

-- Index on department (department-based filtering for dean/program chair views)
CREATE INDEX IF NOT EXISTS idx_research_papers_department
  ON research_papers(department);
