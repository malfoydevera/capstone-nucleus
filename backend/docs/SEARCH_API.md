# Search API — Published Research

Browse and search approved/published papers via the public listing endpoint.

## Endpoint

```
GET /api/research/published
```

Authentication is optional. Unauthenticated callers receive public metadata only.

## Query parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` or `search` | string | Full-text query (title, abstract, keywords). Uses Postgres `search_vector` when available; falls back to `ILIKE` on title/abstract. |
| `category` | uuid/string | Filter by category id |
| `themes` | string | Comma-separated category ids |
| `year` | number | Filter by publication/approval year |
| `author` | string | Filter by author name (partial match) |
| `sort` | string | `newest` (default), `oldest`, `title`, `views` |
| `page` | number | Page number (default `1`) |
| `limit` | number | Page size (default `12`, capped server-side) |

## Example

```http
GET /api/research/published?q=machine%20learning&year=2025&sort=newest&page=1&limit=12
```

## Response

```json
{
  "success": true,
  "data": {
    "papers": [],
    "total": 0,
    "page": 1,
    "limit": 12,
    "facets": {}
  }
}
```

## Notes

- Only papers with status `approved` or `published` and `deleted_at IS NULL` are returned.
- Results are cached briefly (~90s) for browse performance.
- Websearch syntax is supported when using the `q` parameter (e.g. quoted phrases).

---

# AI Thematic Search — Hybrid Semantic + Keyword

Ranks published papers by meaning (pgvector cosine similarity over Gemini
embeddings) blended with keyword relevance (Postgres `search_vector`).

## Endpoint

```
GET /api/research/semantic-search
```

Authentication is **required** (Bearer token). Rate limited per user
(default 30 requests / 60s; configurable via `SEMANTIC_SEARCH_RATE_LIMIT_*`).

## Query parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | **Required.** Natural-language query (min 2 chars). Embedded with Gemini `text-embedding-004` (`RETRIEVAL_QUERY`). |
| `department` | uuid | Filter by `department_id` |
| `year` | number (YYYY) | Filter by publication/creation year |
| `author` | string | Filter by author name (partial match) |
| `page` | number | Page number (default `1`) |
| `limit` | number | Page size (default `20`, capped at `50`) |

## Example

```http
GET /api/research/semantic-search?q=early%20disease%20detection%20with%20deep%20learning&department=<uuid>&year=2025&page=1&limit=12
Authorization: Bearer <token>
```

## Response

```json
{
  "success": true,
  "data": {
    "papers": [
      {
        "id": "…",
        "title": "…",
        "abstract": "…",
        "keywords": ["…"],
        "similarityScore": 0.842,
        "keywordScore": 0.31,
        "hybridScore": 0.63
      }
    ],
    "total": 0,
    "page": 1,
    "limit": 12,
    "query": "early disease detection with deep learning"
  }
}
```

## How it works

1. The query is embedded once and the ranked candidate pool (top 100) is cached
   by query + filters (~90s), so paging through results does not re-embed.
2. The `match_research_papers` Postgres RPC computes per-paper:
   - `semantic_score = 1 - cosine_distance(embedding, query_embedding)`
   - `keyword_score  = ts_rank(search_vector, websearch_to_tsquery(q))` normalized to 0..1
   - `hybrid_score   = semantic_weight * semantic_score + keyword_weight * keyword_score`
3. A paper qualifies if it clears the semantic threshold **or** matches the
   keyword query, then results are ordered by `hybrid_score`.

## Setup & operations

1. Apply the migration in the Supabase SQL editor:
   `backend/migrations/add_semantic_search.sql` (enables `vector`, adds the
   `embedding vector(768)` column + HNSW index + `match_research_papers` RPC).
2. Ensure `GOOGLE_API_KEY` is set (already used by the AI features).
3. Backfill embeddings for existing papers: `npm run backfill:embeddings`
   (use `FORCE=1 npm run backfill:embeddings` to re-embed everything).
4. New/updated submissions embed automatically inside `POST /api/research/submit`
   (best-effort; submission never fails if embedding does).

### Tunable env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `SEMANTIC_SIMILARITY_THRESHOLD` | `0.3` | Min cosine similarity to qualify on semantics alone |
| `SEMANTIC_WEIGHT` | `0.6` | Weight of semantic score in the hybrid blend |
| `KEYWORD_WEIGHT` | `0.4` | Weight of keyword score in the hybrid blend |
| `SEMANTIC_SEARCH_RATE_LIMIT_MAX` | `30` | Requests per window per user |
| `SEMANTIC_SEARCH_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |

## Manual test checklist

1. Apply migration, then run `npm run check:migrations` — the `research_papers.embedding` checks pass.
2. Submit a new paper (or run `npm run backfill:embeddings`); confirm `embedding`
   and `embedding_generated_at` are populated for that row.
3. `GET /api/research/semantic-search?q=<topic>` returns ranked papers with
   `similarityScore`; conceptually-related papers rank above pure keyword matches.
4. Frontend: open **AI Search** in the sidebar — verify initial prompt state,
   loading spinner, results with % match badges, empty state for nonsense queries,
   department/year/author filters, and "Load more" pagination.
5. Exceed the rate limit to confirm a graceful 429 message in the UI.
