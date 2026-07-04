#!/usr/bin/env node
/**
 * Detect account integrity issues before production launch.
 * Usage: node scripts/audit-account-integrity.js [--fix-hints]
 */
require('dotenv').config();

const supabase = require('../src/config/supabase');

async function audit() {
  const issues = [];

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, recovery_email, auth_user_id');

  if (usersError) throw usersError;

  const emailSet = new Set((users || []).map((u) => String(u.email || '').toLowerCase()).filter(Boolean));
  const recoverySet = new Map();

  for (const user of users || []) {
    if (!user.auth_user_id) {
      issues.push({ type: 'MISSING_AUTH_USER_ID', userId: user.id, email: user.email });
    }

    const recovery = String(user.recovery_email || '').trim().toLowerCase();
    if (recovery) {
      if (recoverySet.has(recovery)) {
        issues.push({ type: 'DUPLICATE_RECOVERY_EMAIL', email: recovery, userIds: [recoverySet.get(recovery), user.id] });
      } else {
        recoverySet.set(recovery, user.id);
      }

      if (emailSet.has(recovery) && recovery !== String(user.email || '').toLowerCase()) {
        issues.push({ type: 'RECOVERY_COLLIDES_WITH_LOGIN', userId: user.id, recoveryEmail: recovery });
      }

      if (recovery === String(user.email || '').toLowerCase()) {
        issues.push({ type: 'RECOVERY_EQUALS_LOGIN', userId: user.id, email: user.email });
      }
    }
  }

  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id');
  if (profilesError && !String(profilesError.message).includes('does not exist')) {
    throw profilesError;
  }

  const userIds = new Set((users || []).map((u) => u.id));
  const authUserIds = new Set((users || []).map((u) => u.auth_user_id).filter(Boolean));

  for (const profile of profiles || []) {
    if (!authUserIds.has(profile.id) && !userIds.has(profile.id)) {
      issues.push({ type: 'ORPHAN_PROFILE', profileId: profile.id });
    }
  }

  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), issueCount: issues.length, issues }, null, 2));
  process.exit(issues.length > 0 ? 1 : 0);
}

audit().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(2);
});
