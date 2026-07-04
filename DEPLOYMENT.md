# NUCLEUS Production Deployment Guide

Host target: **PaaS (Render / Railway / Fly.io)** — single web instance + cron worker.

## Pre-deploy checklist

1. Verify `.env` was never committed: `git log --all --full-history -- '**/.env'`
2. Rotate Supabase service role key and JWT secret if they were ever exposed
3. Run `node scripts/audit-account-integrity.js` against production DB
4. Apply all migrations via Supabase CLI (see Migrations below)
5. Configure custom SMTP in Supabase Dashboard for auth emails (see PASSWORD_RESET_SETUP.md)
6. Set all secrets in PaaS dashboard — never ship `.env` in the Docker image

## Required environment variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

Critical secrets (PaaS secret store only):

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Legacy JWT + session signing (≥32 chars) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend DB access (bypasses RLS) |
| `GOOGLE_API_KEY` | Semantic search + AI features |
| `RESEND_API_KEY` | Transactional email (invitations, workflow) |

## Services to deploy

### 1. Web service (Node API)

- **Build:** `cd backend && npm ci`
- **Start:** `npm start`
- **Health check path:** `/ready` (readiness — pings Supabase)
- **Liveness path:** `/health`
- Set `NODE_ENV=production`, `ENABLE_INLINE_SCHEDULERS=false`

### 2. Cron worker (background jobs)

- **Start:** `node scripts/run-jobs.js --job=all`
- Schedule on PaaS cron (e.g. every hour):
  - Escalation alerts
  - Recycle bin cleanup
  - Review deadline reminders

Or run individual jobs: `--job=escalation`, `--job=recycle`, `--job=deadlines`

### 3. Frontend (static site)

- **Build:** `cd frontend && npm ci && npm run build`
- **Publish:** `dist/` folder to static host (Render Static, Vercel, Cloudflare Pages)
- Set `VITE_API_URL=https://your-api.example.com/api/v1`

## Migrations

Use Supabase CLI with migrations in `backend/migrations/`:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Do **not** apply migrations manually via dashboard in production.

## Rollback

1. Redeploy previous web service build from PaaS dashboard
2. If a migration broke schema: apply a forward-fix migration (never `db reset` on prod)
3. Verify `/ready` returns 200 before routing traffic

## Staging

Maintain a separate Supabase project (or branch) mirroring production schema.
Auto-deploy `main` → staging; manual promote → production.

## Supabase advisor notes (review periodically)

Run security/performance advisors in Supabase Dashboard or via CLI. Known items to track:

- RLS enabled without policies on several tables (backend uses service role; add policies for defense-in-depth if exposing PostgREST directly)
- `SECURITY DEFINER` RPCs callable by `anon` — revoke execute from anon/authenticated where not needed
- Enable leaked-password protection in Supabase Auth settings
- Confirm PITR/backups enabled on production project; run restore drill on staging annually

See [docs/PRIVACY.md](docs/PRIVACY.md) for retention and incident response.
