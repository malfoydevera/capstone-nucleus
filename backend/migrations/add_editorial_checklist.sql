-- ST1: Editorial checklist per paper before Research Editor approval
CREATE TABLE IF NOT EXISTS editorial_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (research_id)
);

CREATE INDEX IF NOT EXISTS idx_editorial_checklists_research_id ON editorial_checklists(research_id);
CREATE INDEX IF NOT EXISTS idx_editorial_checklists_staff_id ON editorial_checklists(staff_id);
