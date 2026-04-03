-- Add plagiarism check metadata to research_papers.
ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS plagiarism_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS plagiarism_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS plagiarism_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plagiarism_provider VARCHAR(64),
  ADD COLUMN IF NOT EXISTS plagiarism_summary TEXT,
  ADD COLUMN IF NOT EXISTS plagiarism_report JSONB;

CREATE INDEX IF NOT EXISTS idx_research_papers_plagiarism_status
  ON research_papers(plagiarism_status);

CREATE INDEX IF NOT EXISTS idx_research_papers_plagiarism_checked_at
  ON research_papers(plagiarism_checked_at DESC);
