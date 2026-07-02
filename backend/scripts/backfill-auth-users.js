/**
 * Backfill Supabase Auth users for every row in public.users.
 *
 * Why: password reset and login are now handled by Supabase Auth. Legacy
 * accounts that were created before the migration (and never signed in since)
 * may not have a corresponding Supabase Auth user yet, which means
 * `resetPasswordForEmail` would silently do nothing for them.
 *
 * What it does: for each public.users row without a matching Supabase Auth
 * user, it creates one with a random temporary password. Legacy users who
 * still have a bcrypt hash keep logging in normally — the login fallback
 * re-syncs their real password into Supabase Auth on the next successful login.
 * Users can also simply use "Forgot password" to set a new one.
 *
 * Usage:
 *   node scripts/backfill-auth-users.js            # apply
 *   node scripts/backfill-auth-users.js --dry-run  # report only
 */

require('dotenv').config();

const crypto = require('crypto');
const supabase = require('../src/config/supabase');
const { findAuthUserByEmail, ensureAuthUser } = require('../src/utils/supabaseAuth');

const DRY_RUN = process.argv.includes('--dry-run');

function randomTempPassword() {
  // Long, random, and guaranteed to contain letters + numbers.
  return `${crypto.randomBytes(24).toString('base64url')}aA1`;
}

async function main() {
  console.log(`\nBackfilling Supabase Auth users${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role');

  if (error) {
    throw error;
  }

  const summary = { total: users.length, existing: 0, created: 0, failed: 0 };

  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) {
      summary.failed += 1;
      console.warn(`  ! skipped user ${user.id}: missing email`);
      continue;
    }

    try {
      const existing = await findAuthUserByEmail(email);
      if (existing) {
        summary.existing += 1;
        continue;
      }

      if (DRY_RUN) {
        summary.created += 1;
        console.log(`  + would create auth user for ${email}`);
        continue;
      }

      await ensureAuthUser({
        email,
        password: randomTempPassword(),
        userMetadata: { role: user.role },
      });
      summary.created += 1;
      console.log(`  + created auth user for ${email}`);
    } catch (err) {
      summary.failed += 1;
      console.error(`  ! failed for ${email}: ${err.message || err}`);
    }
  }

  console.log('\nDone.');
  console.log(`  total:    ${summary.total}`);
  console.log(`  existing: ${summary.existing}`);
  console.log(`  created:  ${summary.created}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  failed:   ${summary.failed}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
