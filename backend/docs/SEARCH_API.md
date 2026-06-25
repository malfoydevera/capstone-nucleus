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
