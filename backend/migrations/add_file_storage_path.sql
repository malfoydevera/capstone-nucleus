-- Adds canonical storage path support for dual-mode file access.
-- Backward compatible: existing rows keep file_url values.

ALTER TABLE research_papers
ADD COLUMN IF NOT EXISTS file_storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_research_papers_file_storage_path
ON research_papers(file_storage_path);
