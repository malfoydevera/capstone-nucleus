-- Replace legacy user profile/name columns with structured name fields.
-- Date: 2026-03-29

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name varchar,
  ADD COLUMN IF NOT EXISTS middle_name varchar,
  ADD COLUMN IF NOT EXISTS last_name varchar;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'full_name'
  ) THEN
    UPDATE public.users
    SET
      first_name = COALESCE(first_name, NULLIF(split_part(trim(full_name), ' ', 1), '')),
      last_name = COALESCE(
        last_name,
        NULLIF(
          (
            regexp_split_to_array(trim(full_name), '\\s+')
          )[array_length(regexp_split_to_array(trim(full_name), '\\s+'), 1)],
          ''
        )
      ),
      middle_name = COALESCE(
        middle_name,
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
      );
  END IF;
END $$;

-- Guarantee required names are present.
UPDATE public.users
SET
  first_name = COALESCE(NULLIF(first_name, ''), NULLIF(split_part(email, '@', 1), ''), 'User'),
  last_name = COALESCE(NULLIF(last_name, ''), NULLIF(first_name, ''), NULLIF(split_part(email, '@', 1), ''), 'User');

ALTER TABLE public.users
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;

-- Rewrite any dependent views that still reference users.full_name.
DO $$
DECLARE
  v RECORD;
  original_def text;
  rewritten_def text;
BEGIN
  FOR v IN
    SELECT
      ns.nspname AS schema_name,
      view_cls.relname AS view_name,
      view_cls.oid AS view_oid
    FROM pg_depend dep
    JOIN pg_attribute att
      ON att.attrelid = dep.refobjid
     AND att.attnum = dep.refobjsubid
    JOIN pg_rewrite rw
      ON rw.oid = dep.objid
    JOIN pg_class view_cls
      ON view_cls.oid = rw.ev_class
    JOIN pg_namespace ns
      ON ns.oid = view_cls.relnamespace
    WHERE dep.refobjid = 'public.users'::regclass
      AND att.attname = 'full_name'
      AND view_cls.relkind = 'v'
  LOOP
    original_def := pg_get_viewdef(v.view_oid, true);
    rewritten_def := original_def;

    -- Qualified alias.full_name (unquoted alias).
    rewritten_def := regexp_replace(
      rewritten_def,
      '([[:alpha:]_][[:alnum:]_]*)\\.full_name',
      'trim(concat_ws('' '', \\1.first_name, nullif(\\1.middle_name, ''''), \\1.last_name))',
      'g'
    );

    -- Qualified "alias".full_name (quoted alias).
    rewritten_def := regexp_replace(
      rewritten_def,
      '"([[:alpha:]_][[:alnum:]_]*)"\\.full_name',
      'trim(concat_ws('' '', "\\1".first_name, nullif("\\1".middle_name, ''''), "\\1".last_name))',
      'g'
    );

    -- Bare full_name fallback for known views and simple definitions.
    IF v.view_name IN ('research_with_authors', 'pending_reviews') THEN
      rewritten_def := regexp_replace(
        rewritten_def,
        '\\mfull_name\\M',
        'trim(concat_ws('' '', first_name, nullif(middle_name, ''''), last_name))',
        'g'
      );
    END IF;

    IF rewritten_def = original_def THEN
      RAISE NOTICE
        'Could not auto-rewrite dependent view %.%. Keeping it unchanged for now.',
        v.schema_name,
        v.view_name;
    ELSE
      EXECUTE format(
        'CREATE OR REPLACE VIEW %I.%I AS %s',
        v.schema_name,
        v.view_name,
        rewritten_def
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS profile_picture_url,
  DROP COLUMN IF EXISTS bio;

-- If any DB objects still depend on full_name, keep it temporarily and sync it
-- from first/middle/last so legacy views continue to work.
DO $$
DECLARE
  dep_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'full_name'
  ) THEN
    SELECT COUNT(*)
      INTO dep_count
    FROM pg_depend dep
    JOIN pg_attribute att
      ON att.attrelid = dep.refobjid
     AND att.attnum = dep.refobjsubid
    WHERE dep.refobjid = 'public.users'::regclass
      AND att.attname = 'full_name';

    IF dep_count = 0 THEN
      ALTER TABLE public.users DROP COLUMN full_name;
    ELSE
      UPDATE public.users
      SET full_name = trim(concat_ws(' ', first_name, nullif(middle_name, ''), last_name))
      WHERE full_name IS DISTINCT FROM trim(concat_ws(' ', first_name, nullif(middle_name, ''), last_name));

      CREATE OR REPLACE FUNCTION public.sync_users_legacy_full_name()
      RETURNS trigger AS $func$
      BEGIN
        NEW.full_name := trim(concat_ws(' ', NEW.first_name, nullif(NEW.middle_name, ''), NEW.last_name));
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_users_legacy_full_name ON public.users;
      CREATE TRIGGER trg_sync_users_legacy_full_name
      BEFORE INSERT OR UPDATE OF first_name, middle_name, last_name
      ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_users_legacy_full_name();

      RAISE NOTICE 'Kept public.users.full_name because % dependent object(s) still reference it. Update/drop dependent views first, then drop full_name in a follow-up migration.', dep_count;
    END IF;
  END IF;
END $$;
