-- Enable Supabase Realtime for per-user notifications.
-- Date: 2026-03-29

-- Improve performance for notification lookups in API endpoints.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE is_read = false;

-- Include full row payloads in realtime UPDATE/DELETE events.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add notifications table to Supabase realtime publication if not already present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ALTER PUBLICATION; insufficient privilege. Configure publication manually in Supabase.';
END $$;
