# NUCLEUS Release Workflow

Use this checklist for **major updates** (new features, schema changes, env var changes, auth/config changes). For first-time infrastructure setup, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Production stack

| Layer | Platform | Deploy trigger |
|-------|----------|----------------|
| Frontend | [Vercel](https://vercel.com) — root dir `frontend/` | Push to `main` |
| Backend API | [Render](https://dashboard.render.com/web/srv-d9q1p3u417fc73fcel80) — `nucleus-api` | Push to `main` |
| Database / Auth / Storage | Supabase | Manual migrations + dashboard config |

**Live URLs (update if domains change):**

- Frontend: `https://nucleus-beige.vercel.app`
- Backend: `https://nucleus-api-9fju.onrender.com`
- API base (Vercel env): `https://nucleus-api-9fju.onrender.com/api`

---

## Deploy order (always follow this)

```
Database migrations  →  Backend (Render)  →  Frontend (Vercel)  →  External config
```

Never deploy frontend that depends on new API routes before the backend is live. Never deploy backend that depends on new DB columns before migrations run.

---

## Phase 1 — Before merge

### Branch & CI

- [ ] Work on a feature branch (avoid direct commits to `main` when possible)
- [ ] Open a PR and wait for GitHub Actions to pass:
  - Backend tests + migration check
  - Frontend lint + build
- [ ] Confirm no secrets in the diff:
  ```bash
  git log --all --full-history -- '**/.env'
  ```

### Classify the release

Check all that apply:

- [ ] **Frontend only** — UI/components, no API contract changes
- [ ] **Backend only** — API/logic, no schema changes
- [ ] **Database** — new/changed files in `backend/migrations/`
- [ ] **New env vars** — update `.env.example` and platform dashboards
- [ ] **Supabase auth/config** — redirects, SMTP, RLS, storage buckets
- [ ] **Breaking API change** — coordinate backend + frontend in one release window

### Local verification

```bash
# Backend
cd backend && npm ci && npm test && npm run dev

# Frontend
cd frontend && npm ci && npm run lint && npm run build && npm run dev
```

- [ ] Core flows tested locally (login, submit paper, browse, review, AI chat if touched)
- [ ] New env vars documented in `backend/.env.example` and/or `frontend/.env.example`

---

## Phase 2 — Pre-merge platform prep

### Supabase migrations (if schema changed)

Run **before** or **immediately after** merge, before users hit new code:

```bash
supabase link --project-ref nnqnszprshnsyuebegnt
supabase db push
```

- [ ] Migration applied successfully
- [ ] No destructive changes without backup plan

### Render (backend) — set env vars **before** deploy if app crashes without them

Dashboard: [nucleus-api → Environment](https://dashboard.render.com/web/srv-d9q1p3u417fc73fcel80)

| Variable | Production value |
|----------|------------------|
| `FRONTEND_URL` | `https://nucleus-beige.vercel.app` |
| `CORS_ORIGINS` | `https://nucleus-beige.vercel.app,http://localhost:5173,http://localhost:4173` |
| `GEMINI_MODELS` | `gemini-3.1-flash-lite,gemini-3.5-flash-lite` |
| Secrets | `JWT_SECRET`, `SUPABASE_*`, `GOOGLE_API_KEY`, `RESEND_API_KEY` — never commit |

- [ ] New backend env vars added on Render (if any)

### Vercel (frontend) — remember: `VITE_*` vars are baked at **build time**

Dashboard: Vercel → Project → Settings → Environment Variables

| Variable | Production value |
|----------|------------------|
| `VITE_API_URL` | `https://nucleus-api-9fju.onrender.com/api` ← must end with `/api` |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_STUDENT_EMAIL_DOMAIN` | `students.nu-dasma.edu.ph` |
| `VITE_STAFF_EMAIL_DOMAIN` | `nu-dasma.edu.ph` |

- [ ] New frontend env vars added on Vercel (if any)
- [ ] If any `VITE_*` var changed: plan a **Redeploy** after merge (saving alone is not enough)

### Supabase dashboard (if auth/email touched)

Authentication → URL Configuration:

- **Site URL:** `https://nucleus-beige.vercel.app`
- **Redirect URLs:**
  ```
  https://nucleus-beige.vercel.app/auth/callback
  http://localhost:5173/auth/callback
  ```

- [ ] Supabase redirect URLs updated (if domain changed)

---

## Phase 3 — Release

- [ ] PR approved and merged to `main`
- [ ] Migrations applied (if applicable)
- [ ] Watch Render deploy: [Deployments tab](https://dashboard.render.com/web/srv-d9q1p3u417fc73fcel80)
- [ ] Watch Vercel deploy: Project → Deployments
- [ ] If `VITE_*` changed: trigger **Redeploy** on Vercel (Deployments → ⋯ → Redeploy)

Typical wait time: **2–5 minutes** per service.

---

## Phase 4 — Post-deploy smoke test (~10 min)

### Automated checks

```bash
curl -s https://nucleus-api-9fju.onrender.com/health
curl -s https://nucleus-api-9fju.onrender.com/ready   # expect {"status":"READY"}
```

- [ ] `/health` → 200
- [ ] `/ready` → 200 (confirms Supabase connectivity)

### Manual browser checks

Open production: `https://nucleus-beige.vercel.app`

| # | Test | Pass |
|---|------|------|
| 1 | Hard refresh `/login` — no 404 | ☐ |
| 2 | Login (student account) | ☐ |
| 3 | Login (staff/faculty account) | ☐ |
| 4 | Register page loads departments | ☐ |
| 5 | Submit / view research paper | ☐ |
| 6 | PDF viewer loads | ☐ |
| 7 | AI Research Assistant responds | ☐ |
| 8 | DevTools Network: API calls go to `nucleus-api-9fju.onrender.com`, not `localhost` | ☐ |

### Monitor logs (first 15 minutes)

- [ ] Render logs — no repeated 500 errors
- [ ] Vercel deployment status — Ready

---

## Rollback

| What broke | Action |
|------------|--------|
| **Backend** | Render → Deployments → Redeploy previous successful build |
| **Frontend** | Vercel → Deployments → Promote previous deployment to Production |
| **Database** | Write a **forward-fix migration** — never `db reset` on production |
| **Bad env var** | Fix in dashboard → redeploy affected service |

After rollback:

```bash
curl -s https://nucleus-api-9fju.onrender.com/ready
```

- [ ] `/ready` returns 200 before announcing rollback complete

---

## Release notes template

Copy into your PR description or a team channel for each major release:

```markdown
## Release YYYY-MM-DD

### Summary
- 

### Changes
- 

### Migrations
- [ ] None
- [ ] Applied: `<migration file names>`

### Env vars added/changed
- Render: 
- Vercel: 
- Supabase: 

### Smoke test
- [ ] /ready OK
- [ ] Login OK
- [ ] Core workflow OK

### Known issues / follow-ups
- 
```

---

## Common release-day mistakes

| Mistake | Fix |
|---------|-----|
| `VITE_API_URL` missing `/api` | Set to `https://nucleus-api-9fju.onrender.com/api` and redeploy Vercel |
| Changed Vercel env but didn't redeploy | Deployments → Redeploy |
| CORS errors on preview URLs | Render `CORS_ORIGINS` or backend allows `*.vercel.app` |
| AI returns 503 for all users | Check `GOOGLE_API_KEY` and `GEMINI_MODELS=gemini-3.1-flash-lite,gemini-3.5-flash-lite` on Render |
| Auth callback fails | Add `/auth/callback` to Supabase redirect URLs |
| `/ready` returns 503 | Check Supabase credentials on Render; confirm migrations applied |

---

## Future: staging environment

Recommended before heavy production traffic:

1. Separate Supabase project (or branch) for staging
2. Render service `nucleus-api-staging` on a `develop` branch
3. Vercel preview deploys for PRs; promote to production only from `main`

See [DEPLOYMENT.md — Staging](DEPLOYMENT.md#staging).

---

## Related docs

- [`DEPLOYMENT.md`](DEPLOYMENT.md) — infrastructure, env vars, cron, migrations
- [`PASSWORD_RESET_SETUP.md`](PASSWORD_RESET_SETUP.md) — Supabase auth email setup
- [`backend/.env.example`](backend/.env.example) — backend env reference
- [`frontend/.env.example`](frontend/.env.example) — frontend env reference
