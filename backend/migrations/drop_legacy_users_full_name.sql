-- Safely retire public.users.full_name after split-name rollout.
-- Date: 2026-04-11

DO $$
DECLARE
  has_full_name boolean := false;
  dep_count integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'full_name'
  ) INTO has_full_name;

  IF NOT has_full_name THEN
    RAISE NOTICE 'public.users.full_name is already absent; skipping.';
    RETURN;
  END IF;

  -- Backfill split names from existing data before any drop attempt.
  UPDATE public.users
  SET
    first_name = COALESCE(
      NULLIF(first_name, ''),
      NULLIF(split_part(trim(full_name), ' ', 1), ''),
      NULLIF(split_part(email, '@', 1), ''),
      'User'
    ),
    last_name = COALESCE(
      NULLIF(last_name, ''),
      NULLIF(
        (
          regexp_split_to_array(trim(full_name), '\\s+')
        )[array_length(regexp_split_to_array(trim(full_name), '\\s+'), 1)],
        ''
      ),
      NULLIF(split_part(email, '@', 1), ''),
      'User'
    ),
    middle_name = COALESCE(
      NULLIF(middle_name, ''),
      NULLIF(
        trim(
          regexp_replace(
            trim(full_name),
            '^\\S+\\s*|\\s*\\S+$',
            '',
            'g'
          )
        ),
        ''
      )
    )
  WHERE NULLIF(first_name, '') IS NULL
     OR NULLIF(last_name, '') IS NULL;

  -- Enforce split-name completeness for edge cases.
  UPDATE public.users
  SET
    first_name = COALESCE(NULLIF(first_name, ''), NULLIF(split_part(email, '@', 1), ''), 'User'),
    last_name = COALESCE(NULLIF(last_name, ''), NULLIF(first_name, ''), NULLIF(split_part(email, '@', 1), ''), 'User');

  SELECT COUNT(*)
    INTO dep_count
  FROM pg_depend dep
  JOIN pg_attribute att
    ON att.attrelid = dep.refobjid
   AND att.attnum = dep.refobjsubid
  WHERE dep.refobjid = 'public.users'::regclass
    AND att.attname = 'full_name';

  IF dep_count > 0 THEN
    UPDATE public.users
    SET full_name = trim(concat_ws(' ', first_name, nullif(middle_name, ''), last_name))
    WHERE full_name IS DISTINCT FROM trim(concat_ws(' ', first_name, nullif(middle_name, ''), last_name));

    RAISE NOTICE 'Kept public.users.full_name because % dependent object(s) still reference it.', dep_count;
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_sync_users_legacy_full_name ON public.users;
  DROP FUNCTION IF EXISTS public.sync_users_legacy_full_name();

  ALTER TABLE public.users DROP COLUMN full_name;

  RAISE NOTICE 'Dropped public.users.full_name safely.';
END $$;
