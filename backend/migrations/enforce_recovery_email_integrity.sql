-- Prevent recovery_email from colliding with any account's login email.
CREATE OR REPLACE FUNCTION public.enforce_recovery_email_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.recovery_email IS NOT NULL THEN
    NEW.recovery_email := lower(trim(NEW.recovery_email));

    IF NEW.recovery_email = lower(trim(NEW.email)) THEN
      RAISE EXCEPTION 'recovery_email must differ from login email';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.users u
      WHERE lower(trim(u.email)) = NEW.recovery_email
        AND u.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'recovery_email is already used as another account login email';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.recovery_email IS NOT NULL
        AND lower(trim(u.recovery_email)) = NEW.recovery_email
        AND u.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'recovery_email is already linked to another account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_recovery_email_integrity_trigger ON public.users;
CREATE TRIGGER enforce_recovery_email_integrity_trigger
  BEFORE INSERT OR UPDATE OF recovery_email, email ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_recovery_email_integrity();

-- Performance indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_research_papers_author_id ON public.research_papers(author_id);
CREATE INDEX IF NOT EXISTS idx_research_papers_status ON public.research_papers(status);
CREATE INDEX IF NOT EXISTS idx_research_papers_dept_program ON public.research_papers(department_id, program_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_research_id ON public.approval_workflow(research_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
