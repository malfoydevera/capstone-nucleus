-- Migration: Add Research Co-Authors Support
-- Date: 2026-01-23
-- Description: Adds support for multiple authors per research paper

-- ============================================
-- 1. Create research_authors junction table
-- ============================================
CREATE TABLE IF NOT EXISTS research_authors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_id UUID NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_order INTEGER NOT NULL DEFAULT 1,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_research_author UNIQUE (research_id, user_id)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_research_authors_research_id ON research_authors(research_id);
CREATE INDEX IF NOT EXISTS idx_research_authors_user_id ON research_authors(user_id);
CREATE INDEX IF NOT EXISTS idx_research_authors_order ON research_authors(research_id, author_order);

-- ============================================
-- 2. Migrate existing co_authors data (if any)
-- ============================================
-- This assumes co_authors field contains text that needs to be preserved
-- The primary author (student_id) should be added as the first author
-- You may need to manually handle existing co_authors text data

-- ============================================
-- NOTES:
-- ============================================
-- 1. Run this migration in your Supabase SQL Editor
-- 2. The primary author (student who submitted) will have is_primary=TRUE
-- 3. Co-authors are ordered by author_order field
-- 4. The old co_authors text field can be kept for legacy data or removed

-- ============================================
-- Rollback Script (if needed)
-- ============================================
/*
DROP TABLE IF EXISTS research_authors;
*/
