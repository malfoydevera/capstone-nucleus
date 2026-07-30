-- =============================================================================
-- update_semantic_search_year_range.sql
-- Replaces the single filter_year parameter in match_research_papers with
-- filter_year_from and filter_year_to to support year-range filtering.
-- Safe to re-run (drop + create).
-- =============================================================================

-- Drop the old function signature before recreating with new params.
DROP FUNCTION IF EXISTS match_research_papers(
  vector, text, integer, double precision, double precision, double precision, uuid, integer, text
);

CREATE OR REPLACE FUNCTION match_research_papers(
  query_embedding      vector(768),
  query_text           text              DEFAULT NULL,
  match_count          integer           DEFAULT 50,
  similarity_threshold double precision  DEFAULT 0.30,
  semantic_weight      double precision  DEFAULT 0.60,
  keyword_weight       double precision  DEFAULT 0.40,
  filter_department    uuid              DEFAULT NULL,
  filter_year_from     integer           DEFAULT NULL,
  filter_year_to       integer           DEFAULT NULL,
  filter_author        text              DEFAULT NULL
)
RETURNS TABLE (
  id             uuid,
  semantic_score double precision,
  keyword_score  double precision,
  hybrid_score   double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      CASE
        WHEN query_text IS NULL OR length(trim(query_text)) = 0 THEN NULL
        ELSE websearch_to_tsquery('english', query_text)
      END AS ts_query
  ),
  scored AS (
    SELECT
      rp.id,
      -- Cosine similarity in (0..1). NULL embeddings score 0.
      CASE
        WHEN query_embedding IS NULL OR rp.embedding IS NULL THEN 0
        ELSE GREATEST(0, 1 - (rp.embedding <=> query_embedding))
      END AS semantic_raw,
      -- Lexical rank squashed into (0..1) so it composes with the semantic score.
      CASE
        WHEN p.ts_query IS NULL THEN 0
        ELSE (
          SELECT r / (1 + r)
          FROM (SELECT ts_rank(rp.search_vector, p.ts_query) AS r) AS k
        )
      END AS keyword_raw,
      p.ts_query
    FROM research_papers rp
    CROSS JOIN params p
    WHERE rp.status IN ('approved', 'published')
      AND rp.deleted_at IS NULL
      AND (filter_department IS NULL OR rp.department_id = filter_department)
      AND (
        (filter_year_from IS NULL AND filter_year_to IS NULL)
        OR EXTRACT(YEAR FROM COALESCE(rp.published_date, rp.created_at))
             BETWEEN COALESCE(filter_year_from, 1900) AND COALESCE(filter_year_to, 9999)
      )
      AND (
        filter_author IS NULL
        OR rp.id IN (SELECT published_paper_ids_by_author(filter_author))
      )
  )
  SELECT
    s.id,
    s.semantic_raw AS semantic_score,
    s.keyword_raw  AS keyword_score,
    (semantic_weight * s.semantic_raw + keyword_weight * s.keyword_raw) AS hybrid_score
  FROM scored s
  WHERE s.semantic_raw >= similarity_threshold
     OR (s.ts_query IS NOT NULL AND s.keyword_raw > 0)
  ORDER BY hybrid_score DESC, semantic_score DESC
  LIMIT GREATEST(match_count, 1);
$$;

ALTER FUNCTION public.match_research_papers(
  vector, text, integer, double precision, double precision, double precision, uuid, integer, integer, text
) SET search_path = public;
