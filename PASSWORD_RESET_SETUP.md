# Password Management Setup (Supabase-native)

Password reset, change, and login now use **Supabase Auth** as the single source of
truth. The custom `password_reset_tokens` table and the dual bcrypt storage have
been removed. This document lists the **manual Supabase dashboard steps** required
for the feature to work end-to-end (these cannot be automated via code/MCP).

Project ref: `nnqnszprshnsyuebegnt`

---

## 1. Email delivery: use Supabase's built-in email service (no Resend/SMTP)

Password reset emails are sent by **Supabase Auth's built-in email service** — no
Resend and no custom SMTP.

Dashboard: **Authentication -> Emails -> SMTP Settings**

- Leave **"Enable custom SMTP" turned OFF**. With it off, Supabase sends auth
  emails (recovery, confirmation, magic link) using its own built-in sender.
- Nothing else to configure here.

> Built-in email limits: Supabase's built-in service is **rate-limited**
> (a small number of emails per hour, intended for development/low volume) and
> sends from a generic Supabase address. This is fine for the capstone/demo.
> If you later need higher volume or your own branded sender, you can enable
> custom SMTP at any time without changing application code.

> Tip: you can raise the built-in send rate under
> **Authentication -> Rate Limits -> "Emails per hour"** if you hit the cap
> while testing.

## 2. URL configuration (redirect allow-list)

Dashboard: **Authentication -> URL Configuration**

- **Site URL**: your production frontend URL (e.g. `https://app.yourdomain.edu` or `http://localhost:5173` for local dev).

**Password reset now uses a 6-digit code** typed on `/forgot-password` (no link click required). You do **not** need `/reset-password` in the redirect list for the main flow.

Optional redirect URLs (only if you still use email links for change-email or legacy reset links):

- `http://localhost:5173/auth/callback` (email confirmation / change-email)
- `http://localhost:5173/reset-password` (legacy link-based reset only)

## 3. Email template (6-digit code)

Dashboard: **Authentication -> Emails -> Templates -> Reset Password**

The app sends a **6-digit code** the user types on the forgot-password page. Make sure the template includes the token variable, for example:

```html
<p>Your password reset code is: <strong>{{ .Token }}</strong></p>
<p>This code expires in one hour.</p>
```

You can remove or de-emphasize `{{ .ConfirmationURL }}` if you only want the code flow. The code is verified with Supabase `verifyOtp({ type: 'recovery' })` — no redirect URL needed.

> **SMS / text messages:** Supabase password reset codes are delivered by **email** by default. True SMS requires enabling the **Phone** provider (Twilio, etc.) and storing a phone number on each account — not set up in this project yet.

## 4. Token expiry & security

Dashboard: **Authentication -> Providers -> Email** (and **Sessions**)

- Set the recovery/OTP expiry to a reasonable window (e.g. 30-60 minutes).
- Set the minimum password length to at least `8` to match the app policy
  (`backend/src/utils/passwordPolicy.js` / `frontend/src/utils/passwordPolicy.js`:
  min 8 chars, at least one letter and one number).

---

## 5. One-time backfill (legacy accounts)

Legacy users created before this migration may not yet have a Supabase Auth user,
which means `resetPasswordForEmail` would do nothing for them. Backfill them:

```bash
cd capstone-nucleus/backend
npm run backfill:auth-users -- --dry-run   # preview
npm run backfill:auth-users                # apply
```

Legacy users keep logging in normally (the login fallback re-syncs their real
password into Supabase Auth on the next successful sign-in), and can use
"Forgot password" once the steps above are complete.

## 6. Secret hygiene

- `backend/.env` and `frontend/.env` are already git-ignored. Confirm they were
  never committed (`git log --all -- capstone-nucleus/backend/.env`). If they were,
  **rotate**: Supabase service-role key + anon key (Dashboard -> Project Settings ->
  API) and `JWT_SECRET`.
- The frontend only needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  (the anon key is safe to expose to the browser).
- Password reset no longer uses Resend. The `RESEND_API_KEY` / `EMAIL_PROVIDER`
  vars in `backend/.env` are now only used by the **non-auth** transactional
  emails (co-author invitations and workflow notifications). See the note below.

## 7. Follow-up cleanup (after backfill is verified)

Once all active users are confirmed in Supabase Auth, you can fully drop the
legacy password column and bcrypt fallback:

```sql
ALTER TABLE public.users DROP COLUMN password;
```

Then remove the bcrypt fallback branch in `login()` (`auth.controller.js`) and the
`bcryptjs` dependency.

---

## 9. Authentication hardening (per-role domains + email confirmation)

This builds on the Supabase-native auth above. New signups now require email
confirmation, enforce per-role institutional domains, and link `public.users` to
`auth.users` via a stable `auth_user_id`.

### 9.1 Environment variables (domains are not hardcoded)

`backend/.env`:

```
STUDENT_EMAIL_DOMAINS=students.nu-dasma.edu.ph
STAFF_EMAIL_DOMAINS=nu-dasma.edu.ph
```

`frontend/.env`:

```
VITE_STUDENT_EMAIL_DOMAIN=students.nu-dasma.edu.ph
VITE_STAFF_EMAIL_DOMAIN=nu-dasma.edu.ph
```

Both accept a comma-separated list if you ever need to allow multiple domains.
Mapping: `student` → student domains; every other role (faculty/dean/chair/staff/
admin) → staff domains.

### 9.2 Enable "Confirm email"

Dashboard: **Authentication → Providers → Email → Confirm email = ON**.

- New signups get an unconfirmed auth user and a Supabase confirmation email.
- Existing users were created **confirmed**, so they are unaffected (non-disruptive).

### 9.3 Redirect allow-list for the confirmation callback

Dashboard: **Authentication → URL Configuration → Redirect URLs** — add:

- `http://localhost:5173/auth/callback` (local dev)
- `https://<your-prod-domain>/auth/callback`

The backend passes `emailRedirectTo = <FRONTEND_URL>/auth/callback` for signup and
email-change, so this exact path must be allow-listed. Also confirm **Site URL** is
set (used by the email-change confirmation).

Make sure `backend/.env` `FRONTEND_URL` points at the correct frontend origin.

### 9.4 Email templates (optional)

Customize **Confirm signup** and **Change Email Address** templates under
**Authentication → Emails → Templates**. The default `{{ .ConfirmationURL }}`
works with the callback flow.

### 9.5 Database migrations (apply in order)

Already applied to project `nnqnszprshnsyuebegnt` via MCP; the SQL also lives in
`backend/migrations/` for reproducibility:

1. `add_users_auth_user_id.sql` — adds `public.users.auth_user_id` + unique index.
2. `sync_user_email_from_auth.sql` — **deprecated**; replaced by
   `disable_auth_email_sync_trigger.sql` when using recovery email (see section 10).

### 9.6 Backfill the stable link

After `backfill:auth-users` (section 5), link every profile to its auth user:

```bash
cd capstone-nucleus/backend
npm run backfill:auth-user-id -- --dry-run   # preview
npm run backfill:auth-user-id                # apply
```

Active users also self-heal: a successful login now sets `auth_user_id` if missing.

### 9.7 (Optional, recommended) Before-User-Created Auth Hook

The anon key is public, so a client could call Supabase `signUp` directly and skip
the app-layer domain check. To enforce domains at the database layer too, add a
**Before User Created** hook (Dashboard → Authentication → Hooks) or a trigger that
rejects emails whose domain does not match `raw_user_meta_data.role`. Example
Postgres function for a hook:

```sql
create or replace function public.enforce_email_domain()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_domain text := lower(split_part(new.email, '@', 2));
  v_allowed text[];
begin
  if v_role = 'student' then
    v_allowed := array['students.nu-dasma.edu.ph'];
  else
    v_allowed := array['nu-dasma.edu.ph'];
  end if;
  if not (v_domain = any(v_allowed)) then
    raise exception 'Email domain % not allowed for role %', v_domain, v_role;
  end if;
  return new;
end; $$;
```

The app-layer validation stands on its own if you skip this.

### 9.8 Migration & verification order (non-disruptive)

1. Apply `add_users_auth_user_id.sql` (done).
2. Run `npm run backfill:auth-users` then `npm run backfill:auth-user-id`.
3. Apply `add_users_recovery_email.sql` (adds `public.users.recovery_email`).
4. Apply `disable_auth_email_sync_trigger.sql` — **disables** the old
   `sync_user_email_from_auth` trigger (institutional login email is no longer
   mirrored from `auth.users.email` once recovery email is in use).
5. Deploy the updated backend + frontend.
6. Enable **Confirm email** and add `/auth/callback` to the redirect allow-list.
7. (Optional) add the Before-User-Created hook.

Verify:

- Existing users still log in (they are confirmed; `auth_user_id` self-heals).
- A new student signup with a valid `@students.nu-dasma.edu.ph` email receives a
  confirmation link, and cannot log in until confirmed.
- A signup with a disallowed domain is rejected with a clear message.
- Profile → **Set recovery email** with a personal Gmail (etc.) sends a verify
  link; after confirming, forgot-password codes go to that inbox only.
- Profile → **Change email** updates the institutional login email; when a
  recovery email exists, this updates `public.users.email` only (auth delivery
  stays on recovery).
- Seed/fake accounts (`@nucleus.local`) keep logging in but cannot use
  forgot-password until a recovery email is added in Profile — expected.

---

## 10. Dual-email model (institutional login + personal recovery)

Many accounts use an institutional address (`@students.nu-dasma.edu.ph`) that does
**not** receive mail. NUCLEUS therefore separates:

| Field | Purpose |
|-------|---------|
| `public.users.email` | Institutional **login** email (what you type at sign-in) |
| `public.users.recovery_email` | Verified **personal** inbox (unique per account) |
| `auth.users.email` | Supabase delivery address (= `recovery_email` once set) |

### 10.1 Set recovery email (all roles)

1. Sign in → **Profile** → **Set recovery email**.
2. Enter a personal inbox (Gmail, Yahoo, etc.) — not an institutional domain.
3. Click the verification link Supabase sends to that address.
4. Profile shows both **Login** and **Recovery** emails.

Each account must use its **own** recovery email. The same Gmail cannot be linked
to two accounts (enforced by a unique index on `recovery_email`).

### 10.2 Forgot password

1. User enters their **institutional login email** on `/forgot-password`.
2. Backend looks up that account's `recovery_email`.
3. If none is set → `RECOVERY_EMAIL_REQUIRED` (user must add recovery in Profile).
4. If set → Supabase sends the OTP code to the recovery inbox only.
5. User enters the code + new password; verification happens server-side.

Ensure the **Reset Password** template includes `{{ .Token }}` (see section 3).

### 10.3 Login after recovery is set

Users still sign in with their **institutional email** + password. The backend
resolves the linked recovery address for Supabase `signInWithPassword`.

---

## 11. Production email (custom SMTP)

For production with many users, **enable custom SMTP** in Supabase:

Dashboard: **Authentication → Emails → SMTP Settings**

1. Enable **Custom SMTP**
2. Use your Resend SMTP credentials (or institutional mail server):
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (TLS)
   - Username: `resend`
   - Password: your Resend API key
3. Set sender to a verified domain (not `onboarding@resend.dev`)
4. Verify SPF/DKIM records on your domain

Built-in Supabase email is rate-limited (~few per hour) and unsuitable for
mass student onboarding. Custom SMTP is required before launch to a large cohort.

---

## 8. Note: Resend and non-auth emails

Supabase Auth's built-in email service only sends **auth** emails (password
recovery, email confirmation, magic links). It cannot send arbitrary
transactional emails.

The app still uses Resend (via `backend/src/utils/mailer.js`) for two **non-auth**
features:

- Co-author invitations (`coauthorInvitation.controller.js`)
- Workflow / paper-status notifications (`workflowEmail.js`)

Password reset no longer depends on Resend at all. If you also want to stop using
Resend for those two features, they would need either another email provider or to
be disabled — Supabase Auth cannot deliver them. Let me know and I can migrate or
remove them.
