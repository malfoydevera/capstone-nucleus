-- Historical reconciliation migration.
-- Captures the legacy author_invitations table that still exists in production.

CREATE TABLE IF NOT EXISTS public.author_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES public.research_papers(id),
  inviter_id uuid NOT NULL REFERENCES public.users(id),
  invitee_id uuid NOT NULL REFERENCES public.users(id),
  token varchar NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status varchar NOT NULL DEFAULT 'pending',
  message text,
  invited_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '7 days'),
  CONSTRAINT author_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  CONSTRAINT author_invitations_unique
    UNIQUE (research_id, invitee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS author_invitations_token_key
  ON public.author_invitations(token);

CREATE INDEX IF NOT EXISTS idx_author_invitations_invitee
  ON public.author_invitations(invitee_id);

CREATE INDEX IF NOT EXISTS idx_author_invitations_research
  ON public.author_invitations(research_id);

CREATE INDEX IF NOT EXISTS idx_author_invitations_token
  ON public.author_invitations(token);
