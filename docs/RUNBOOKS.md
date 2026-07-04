# NUCLEUS Production Runbooks

## Email delivery failing (auth confirmations / password reset)

1. Check Supabase Dashboard → Authentication → Emails → SMTP Settings
2. Verify custom SMTP credentials (Resend or institutional SMTP)
3. Check SPF/DKIM on sender domain
4. Review Supabase rate limits (Authentication → Rate Limits)
5. Test with a single account; check spam folder

## Database slow or unreachable

1. Hit `GET /ready` on the API — returns 503 if Supabase is down
2. Check Supabase Dashboard → Database → Health
3. Review slow queries in Supabase Performance Advisors
4. Verify connection pooler settings if using direct Postgres

## Deploy rollback

1. In PaaS dashboard, redeploy the previous successful build
2. If a migration caused the issue, apply a forward-fix migration (never reset prod)
3. Verify `/ready` returns 200 before routing traffic
4. Run `node scripts/audit-account-integrity.js` if auth issues reported

## Account integrity incident (wrong user data / session mismatch)

1. Run `node scripts/audit-account-integrity.js`
2. Check for `RECOVERY_COLLIDES_WITH_LOGIN` or `DUPLICATE_RECOVERY_EMAIL` issues
3. Clear conflicting `recovery_email` values in DB
4. Ensure user logs out and back in after fix
5. Verify `auth_user_id` is set on affected accounts

## High API load / slow dashboards

1. Check if multiple admin users have dashboards open (10s polling)
2. Verify cache is working: published browse should hit cache on repeat requests
3. Review rate limit logs for 429 spikes
4. Consider enabling React Query + reduced polling (see caching plan)

## PII / data retention

- Student PII lives in `public.users` and `auth.users`
- Audit trail in `audit_logs` — retain per institutional policy
- Deleted papers go to recycle bin for `RECYCLE_BIN_RETENTION_DAYS` (default 30) before permanent purge
- Document your institution's retention period and schedule purges accordingly
