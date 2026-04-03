# Workflow Smoke Test Runbook

This runbook verifies role access and core workflow endpoints after migrations.

## 1) Prerequisites

- Backend server is running.
- Database migrations are applied.
- Role test accounts exist for roles you want to verify.

## 2) Recommended pre-check

Run migration drift check first:

```bash
npm run check:migrations
```

If this fails, apply missing migrations before continuing.

## 3) Configure smoke credentials

Set environment variables in backend `.env` (or shell):

- `SMOKE_API_BASE_URL` (optional, default `http://localhost:5001/api`)
- `SMOKE_STUDENT_EMAIL`, `SMOKE_STUDENT_PASSWORD`
- `SMOKE_FACULTY_EMAIL`, `SMOKE_FACULTY_PASSWORD`
- `SMOKE_DEAN_EMAIL`, `SMOKE_DEAN_PASSWORD`
- `SMOKE_PROGRAM_CHAIR_EMAIL`, `SMOKE_PROGRAM_CHAIR_PASSWORD`
- `SMOKE_STAFF_EMAIL`, `SMOKE_STAFF_PASSWORD`
- `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`

You can set only the roles you want to check.

If you need quick local test accounts for all roles, run:

```bash
npm run smoke:bootstrap-users
```

This will create or update role-based smoke users and write `SMOKE_*` credentials to backend `.env`.

## 4) Run role smoke checks

```bash
npm run smoke:workflow
```

Expected behavior:

- Script logs PASS/FAIL per configured role.
- Exit code `0` when all configured roles pass.
- Exit code `1` when any configured role fails.

## 5) Manual follow-up checks

After script passes, manually validate one full paper lifecycle in UI:

1. Student submits or resubmits paper.
2. Faculty reviews and forwards.
3. Dean/Program Chair reviews.
4. Staff editorial checks and approval.
5. Admin publishes.

Also verify notifications and status updates appear in-app and (if configured) via email.
