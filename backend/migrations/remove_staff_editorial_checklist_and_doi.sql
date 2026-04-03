-- Roll back ST1/ST4 schema artifacts
-- Removes editorial checklist table and DOI/citation fields from research papers.

DROP TABLE IF EXISTS editorial_checklists;

DROP INDEX IF EXISTS uq_research_papers_doi;
DROP INDEX IF EXISTS uq_research_papers_citation_key;

ALTER TABLE IF EXISTS research_papers
  DROP COLUMN IF EXISTS doi,
  DROP COLUMN IF EXISTS citation_key;
