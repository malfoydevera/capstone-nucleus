-- Full-text search for research_papers (trigger-maintained tsvector)

ALTER TABLE research_papers
ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_research_papers_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.abstract, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.keywords, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_papers_search_vector_trigger ON research_papers;

CREATE TRIGGER research_papers_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, abstract, keywords ON research_papers
FOR EACH ROW
EXECUTE FUNCTION update_research_papers_search_vector();

UPDATE research_papers
SET title = title
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_research_papers_search
  ON research_papers USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_research_papers_status
  ON research_papers (status);

CREATE INDEX IF NOT EXISTS idx_research_papers_category
  ON research_papers (category);

CREATE INDEX IF NOT EXISTS idx_research_papers_created_at
  ON research_papers (created_at DESC);

CREATE OR REPLACE FUNCTION published_paper_ids_by_author(author_term text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT rp.id
  FROM research_papers rp
  LEFT JOIN research_authors ra ON ra.research_id = rp.id
  LEFT JOIN users u ON u.id = COALESCE(ra.user_id, rp.author_id)
  WHERE rp.status IN ('approved', 'published')
    AND rp.deleted_at IS NULL
    AND author_term IS NOT NULL
    AND length(trim(author_term)) > 0
    AND (
      lower(trim(concat_ws(' ', u.first_name, u.middle_name, u.last_name))) LIKE '%' || lower(trim(author_term)) || '%'
      OR lower(coalesce(u.email, '')) LIKE '%' || lower(trim(author_term)) || '%'
    );
$$;
