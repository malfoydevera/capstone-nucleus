CREATE TABLE IF NOT EXISTS faculty_conflict_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  research_id uuid NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  reason text NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, research_id)
);

CREATE INDEX IF NOT EXISTS idx_faculty_conflict_declarations_faculty
  ON faculty_conflict_declarations (faculty_id);

CREATE INDEX IF NOT EXISTS idx_faculty_conflict_declarations_research
  ON faculty_conflict_declarations (research_id);
