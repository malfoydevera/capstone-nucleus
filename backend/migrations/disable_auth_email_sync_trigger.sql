-- Disable auth.users.email -> public.users.email sync.
-- With per-account recovery email, auth.users.email is the delivery address
-- (personal inbox) while public.users.email remains the institutional login.

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
DROP FUNCTION IF EXISTS public.sync_user_email_from_auth();
