-- ST4: DOI-style identifier and citation key assignment on editorial approval
ALTER TABLE research_papers
ADD COLUMN IF NOT EXISTS doi VARCHAR,
ADD COLUMN IF NOT EXISTS citation_key VARCHAR;

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_papers_doi
ON research_papers (doi)
WHERE doi IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_papers_citation_key
ON research_papers (citation_key)
WHERE citation_key IS NOT NULL;
