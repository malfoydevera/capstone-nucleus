-- S7: Co-author token-based invitations
-- Creates invitation records that must be accepted before co-authorship is added.

CREATE TABLE IF NOT EXISTS co_author_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email VARCHAR(255) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (research_id, invitee_id, status)
);

CREATE INDEX IF NOT EXISTS idx_co_author_invitations_invitee_status
  ON co_author_invitations(invitee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_co_author_invitations_research
  ON co_author_invitations(research_id, created_at DESC);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_co_author_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_co_author_invitations_updated_at ON co_author_invitations;
CREATE TRIGGER trg_co_author_invitations_updated_at
  BEFORE UPDATE ON co_author_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_co_author_invitations_updated_at();
