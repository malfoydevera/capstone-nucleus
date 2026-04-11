-- Remove users.full_name dependency from legacy author views.
-- Date: 2026-04-11

BEGIN;

CREATE OR REPLACE VIEW public.research_with_authors AS
SELECT
  rp.id,
  rp.title,
  rp.abstract,
  rp.keywords,
  rp.author_id,
  rp.co_authors,
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

CREATE OR REPLACE VIEW public.pending_reviews AS
SELECT
  rp.id,
  rp.title,
  rp.author_id,
  trim(concat_ws(' ', u.first_name, nullif(u.middle_name, ''), u.last_name))::character varying(255) AS author_name,
  rp.category,
  rp.submission_date,
  rp.status
FROM public.research_papers rp
JOIN public.users u ON rp.author_id = u.id
WHERE rp.status::text = ANY (
  ARRAY[
    'pending'::character varying,
    'under_review'::character varying
  ]::text[]
)
ORDER BY rp.submission_date;

ALTER VIEW public.pending_reviews SET (security_invoker = true);
ALTER VIEW public.research_with_authors SET (security_invoker = true);

COMMIT;
