-- Adds program chair review deadlines and reminder bookkeeping.
ALTER TABLE IF EXISTS research_papers
  ADD COLUMN IF NOT EXISTS review_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_reminder_last_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_research_papers_review_deadline
  ON research_papers(review_deadline_at)
  WHERE review_deadline_at IS NOT NULL;
