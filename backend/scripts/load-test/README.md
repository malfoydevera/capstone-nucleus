# Load test — Browse / published endpoint

Smoke-load the repository browse API (`GET /api/research/published`).

## Prerequisites

- Backend running (default `http://localhost:5000`)
- Optional: [k6](https://k6.io/) for the k6 script

## Node script (no extra deps)

```bash
cd backend
API_BASE=http://localhost:5000/api node scripts/load-test/browse-published.js
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE` | `http://localhost:5000/api` | API root |
| `CONCURRENCY` | `10` | Parallel requests per batch |
| `ITERATIONS` | `50` | Total requests |

## k6 script

```bash
k6 run backend/scripts/load-test/browse-published.k6.js
```

Override base URL:

```bash
K6_API_BASE=http://localhost:5000/api k6 run backend/scripts/load-test/browse-published.k6.js
```

## What to watch

- p95 latency under ~500ms for cached reads
- Zero 5xx responses
- Stable `total` count across paginated requests
