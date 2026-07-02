/**
 * Backfill public.users.auth_user_id from the matching Supabase Auth user.
 *
 * Why: public.users and auth.users were linked only by email. This populates a
 * stable id-based link so email changes never desync the two and the backend can
 * resolve the auth user by id instead of scanning the full auth user list.
 *
 * Run AFTER `npm run backfill:auth-users` (which guarantees every user has an
 * auth account to link to).
 *
 * Usage:
 *   node scripts/backfill-auth-user-id.js            # apply
 *   node scripts/backfill-auth-user-id.js --dry-run  # report only
 */

require('dotenv').config();

const supabase = require('../src/config/supabase');
const { findAuthUserByEmail } = require('../src/utils/supabaseAuth');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\nBackfilling public.users.auth_user_id${DRY_RUN ? ' (dry run)' : ''}...\n`);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, auth_user_id');

  if (error) {
    throw error;
  }

  const summary = { total: users.length, alreadyLinked: 0, linked: 0, missingAuth: 0, failed: 0 };

  for (const user of users) {
    if (user.auth_user_id) {
      summary.alreadyLinked += 1;
      continue;
    }

    const email = String(user.email || '').trim().toLowerCase();
    if (!email) {
      summary.failed += 1;
      console.warn(`  ! skipped user ${user.id}: missing email`);
      continue;
    }

    try {
      const authUser = await findAuthUserByEmail(email);
      if (!authUser?.id) {
        summary.missingAuth += 1;
        console.warn(`  ? no auth user for ${email} (run backfill:auth-users first)`);
        continue;
      }

      if (DRY_RUN) {
        summary.linked += 1;
        console.log(`  + would link ${email} -> ${authUser.id}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_user_id: authUser.id })
        .eq('id', user.id);

      if (updateError) throw updateError;

      summary.linked += 1;
      console.log(`  + linked ${email} -> ${authUser.id}`);
    } catch (err) {
      summary.failed += 1;
      console.error(`  ! failed for ${email}: ${err.message || err}`);
    }
  }

  console.log('\nDone.');
  console.log(`  total:          ${summary.total}`);
  console.log(`  already linked: ${summary.alreadyLinked}`);
  console.log(`  linked:         ${summary.linked}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  missing auth:   ${summary.missingAuth}`);
  console.log(`  failed:         ${summary.failed}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
