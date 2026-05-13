-- =============================================================================
-- Migration: add_notifications_sender_and_action_url
-- Date: 2026-05-11
-- Description:
--   Adds sender_user_id (who triggered the notification) and action_url
--   (deep-link to the related page) to the notifications table.
--   Both columns are nullable so existing rows are unaffected.
-- =============================================================================

-- sender_user_id: the user whose action caused this notification (may be null for system alerts)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- action_url: optional deep-link path the frontend can use to navigate on click
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url text;

-- Index for looking up notifications sent by a specific user (admin diagnostics)
CREATE INDEX IF NOT EXISTS idx_notifications_sender_user_id
  ON public.notifications(sender_user_id)
  WHERE sender_user_id IS NOT NULL;

COMMENT ON COLUMN public.notifications.sender_user_id IS
  'The user whose action triggered this notification. NULL for system-generated alerts.';
COMMENT ON COLUMN public.notifications.action_url IS
  'Optional frontend route path (e.g. /research/<id>) to navigate to when the notification is opened.';
