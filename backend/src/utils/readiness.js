const supabase = require('../config/supabase');

let lastCheck = { ok: true, checkedAt: 0, error: null };
const CACHE_MS = 5000;

async function checkReadiness() {
  const now = Date.now();
  if (now - lastCheck.checkedAt < CACHE_MS) {
    return lastCheck;
  }

  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    lastCheck = { ok: true, checkedAt: now, error: null };
  } catch (err) {
    lastCheck = { ok: false, checkedAt: now, error: err?.message || 'Database unreachable' };
  }

  return lastCheck;
}

module.exports = { checkReadiness };
