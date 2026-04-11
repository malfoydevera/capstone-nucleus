-- Safely retire public.research_papers.co_authors after external author notes rollout.
-- Date: 2026-04-11

DO $$
DECLARE
  has_co_authors boolean := false;
  dep_count integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'research_papers'
      AND column_name = 'co_authors'
  ) INTO has_co_authors;

  IF NOT has_co_authors THEN
    RAISE NOTICE 'public.research_papers.co_authors is already absent; skipping.';
    RETURN;
  END IF;

  -- Preserve any legacy note text before dropping the mirrored column.
  UPDATE public.research_papers
  SET external_author_notes = COALESCE(
    NULLIF(btrim(external_author_notes), ''),
    NULLIF(btrim(co_authors), '')
  )
  WHERE co_authors IS NOT NULL
    AND btrim(co_authors) <> ''
    AND (external_author_notes IS NULL OR btrim(external_author_notes) = '');

  -- Keep the legacy view shape without depending on research_papers.co_authors.
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'research_with_authors'
  ) THEN
    CREATE OR REPLACE VIEW public.research_with_authors AS
    SELECT
      rp.id,
      rp.title,
      rp.abstract,
      rp.keywords,
      rp.author_id,
      rp.external_author_notes AS co_authors,
      rp.category,
      rp.file_url,
      rp.file_name,
      rp.file_size,
      rp.status,
      rp.submission_date,
      rp.published_date,
      rp.rejection_reason,
      rp.revision_notes,
      rp.view_count,
      rp.download_count,
      rp.created_at,
      rp.updated_at,
      trim(concat_ws(' ', u.first_name, nullif(u.middle_name, ''), u.last_name))::character varying(255) AS author_name,
      u.email AS author_email,
      rc.name AS category_name
    FROM public.research_papers rp
    JOIN public.users u ON rp.author_id = u.id
    LEFT JOIN public.research_categories rc ON rp.category::text = rc.id::text;

    ALTER VIEW public.research_with_authors SET (security_invoker = true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'active_research_papers'
  ) THEN
    CREATE OR REPLACE VIEW public.active_research_papers AS
    SELECT
      id,
      title,
      abstract,
      keywords,
      author_id,
      external_author_notes AS co_authors,
      category,
      file_url,
      file_name,
      file_size,
      status,
      submission_date,
      published_date,
      rejection_reason,
      revision_notes,
      view_count,
      download_count,
      created_at,
      updated_at,
      faculty_id,
      department,
      last_reviewer_role,
      previous_status,
      dean_chair_id,
      department_id,
      bypass_reason,
      bypassed_by,
      bypassed_at,
      file_storage_path,
      deleted_at,
      deleted_by
    FROM public.research_papers
    WHERE deleted_at IS NULL;

    ALTER VIEW public.active_research_papers SET (security_invoker = true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'recycle_bin'
  ) THEN
    CREATE OR REPLACE VIEW public.recycle_bin AS
    SELECT
      id,
      title,
      abstract,
      keywords,
      author_id,
      external_author_notes AS co_authors,
      category,
      file_url,
      file_name,
      file_size,
      status,
      submission_date,
      published_date,
      rejection_reason,
      revision_notes,
      view_count,
      download_count,
      created_at,
      updated_at,
      faculty_id,
      department,
      last_reviewer_role,
      previous_status,
      dean_chair_id,
      department_id,
      bypass_reason,
      bypassed_by,
      bypassed_at,
      file_storage_path,
      deleted_at,
      deleted_by
    FROM public.research_papers
    WHERE deleted_at IS NOT NULL
      AND deleted_at > (now() - interval '30 days');

    ALTER VIEW public.recycle_bin SET (security_invoker = true);
  END IF;

  SELECT COUNT(*)
    INTO dep_count
  FROM pg_depend dep
  JOIN pg_attribute att
    ON att.attrelid = dep.refobjid
   AND att.attnum = dep.refobjsubid
  WHERE dep.refobjid = 'public.research_papers'::regclass
    AND att.attname = 'co_authors';

  IF dep_count > 0 THEN
    RAISE EXCEPTION 'Cannot drop public.research_papers.co_authors because % dependent object(s) still reference it.', dep_count;
  END IF;

  ALTER TABLE public.research_papers DROP COLUMN co_authors;

  RAISE NOTICE 'Dropped public.research_papers.co_authors safely.';
END $$;
