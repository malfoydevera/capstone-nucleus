-- =============================================================================
-- add_semantic_search.sql
-- AI-powered thematic search: pgvector embeddings + hybrid (semantic + keyword)
-- ranking RPC for research_papers.
--
-- Apply manually via the Supabase SQL editor (this repo applies migrations by
-- hand; see SMOKE_TEST_RUNBOOK.md). Safe to re-run (idempotent).
-- =============================================================================

-- 1. Enable pgvector. Provides the `vector` type and distance operators.
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Embedding storage on research_papers.
--    embedding            : 768-dim Gemini `text-embedding-004` vector.
--    embedding_model      : model id, so we can re-embed if we change models.
--    embedding_source_hash: sha256 of (title + abstract + keywords); lets the
--                           app skip re-embedding when content is unchanged.
--    embedding_generated_at: observability / backfill tracking.
ALTER TABLE research_papers
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_source_hash text,
  ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;

-- 3. Approximate-nearest-neighbour index for fast semantic search at scale.
--    HNSW with cosine distance handles thousands of rows + concurrent reads
--    well, and (unlike IVFFlat) needs no training/row-count threshold.
CREATE INDEX IF NOT EXISTS idx_research_papers_embedding_hnsw
  ON research_papers
  USING hnsw (embedding vector_cosine_ops);

-- 4. Hybrid search RPC.
--    Combines semantic similarity (pgvector cosine) with keyword relevance
--    (the existing `search_vector` tsvector from add_fulltext_search.sql).
--    Returns ids + component scores; the API layer hydrates full paper rows
--    so the response shape matches the existing published-browse endpoint.
--
--    Scoring:
--      semantic_score = 1 - cosine_distance               (0..1, higher better)
--      keyword_score  = ts_rank normalized to (0..1)       via kw / (1 + kw)
--      hybrid_score   = w_sem * semantic + w_kw * keyword   (weights are params)
--
--    A row qualifies if it clears the semantic threshold OR matches the
--    keyword query, so strong lexical matches are never dropped just because
--    their embedding is missing or slightly below threshold.
CREATE OR REPLACE FUNCTION match_research_papers(
  query_embedding      vector(768),
  query_text           text     DEFAULT NULL,
  match_count          integer  DEFAULT 50,
  similarity_threshold double precision DEFAULT 0.30,
  semantic_weight      double precision DEFAULT 0.60,
  keyword_weight       double precision DEFAULT 0.40,
  filter_department    uuid     DEFAULT NULL,
  filter_year          integer  DEFAULT NULL,
  filter_author        text     DEFAULT NULL
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
        filter_year IS NULL
        OR EXTRACT(YEAR FROM COALESCE(rp.published_date, rp.created_at)) = filter_year
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

-- Keep search_path pinned for security parity with other hardened functions.
ALTER FUNCTION public.match_research_papers(
  vector, text, integer, double precision, double precision, double precision, uuid, integer, text
) SET search_path = public;
