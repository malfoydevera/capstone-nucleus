# NUCLEUS Privacy & Data Retention

## Data categories

| Category | Location | Examples |
|----------|----------|----------|
| Identity | `auth.users`, `public.users` | Name, institutional email, recovery email |
| Academic | `research_papers`, storage | Thesis PDFs, abstracts, metadata |
| Audit | `audit_logs` | Admin actions, login events |
| Notifications | `notifications` | In-app alerts |

## Retention defaults

- **Active accounts:** retained while enrolled/employed per institutional policy
- **Deleted papers:** soft-deleted to recycle bin for `RECYCLE_BIN_RETENTION_DAYS` (default 30), then purged by cron job
- **Audit logs:** retain minimum 1 academic year unless law/policy requires longer
- **Auth sessions:** Supabase-managed; users can sign out to invalidate refresh tokens

## Incident response (summary)

1. **Detect:** Sentry alerts, user reports, `audit-account-integrity.js` findings
2. **Contain:** suspend affected accounts, rotate compromised secrets
3. **Assess:** run integrity audit; identify scope (wrong session, email collision, data leak)
4. **Notify:** follow institutional IR/data-protection process for affected users
5. **Recover:** apply DB fixes, require re-login, verify `/ready` and auth flows
6. **Review:** post-incident note in runbooks; add regression test if applicable

See [RUNBOOKS.md](./RUNBOOKS.md) for operational steps.

## Token storage note

The frontend stores Supabase access/refresh tokens in `sessionStorage` by default (or `localStorage` when "Remember me" is checked). A future migration to httpOnly cookies requires backend cookie endpoints and CSRF protection — track as a separate hardening milestone.
