const supabase = require('../config/supabase');

/**
 * Insert a single notification row.
 * Skips and warns when userId is missing so we never silently lose notifications.
 * Logs (but does not throw) when the insert itself fails so the caller workflow continues.
 */
async function notifyUser({ userId, researchId = null, type, title, message, senderUserId = null, actionUrl = null }) {
  if (!userId) {
    console.warn('[notifyUser] skipped: missing userId', { type, title });
    return { skipped: true };
  }

  const payload = {
    user_id: userId,
    research_id: researchId,
    type,
    title,
    message,
    sender_user_id: senderUserId || null,
    action_url: actionUrl || (researchId ? `/research/${researchId}` : null),
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert([payload])
    .select('id')
    .single();

  if (error) {
    // Gracefully fall back if new columns don't exist yet (migration not applied)
    if (
      String(error.message || '').includes('sender_user_id') ||
      String(error.message || '').includes('action_url')
    ) {
      const fallbackPayload = { user_id: userId, research_id: researchId, type, title, message };
      const fallbackResult = await supabase
        .from('notifications')
        .insert([fallbackPayload])
        .select('id')
        .single();
      if (!fallbackResult.error) return { data: fallbackResult.data };
    }

    console.error('[notifyUser] insert failed', {
      userId,
      type,
      title,
      researchId,
      error: error.message || error,
    });
    return { error };
  }

  return { data };
}

/**
 * Bulk insert. Filters out rows missing user_id and logs each skipped one.
 */
async function notifyUsers(rows = []) {
  const valid = [];
  for (const row of rows) {
    if (!row?.user_id) {
      console.warn('[notifyUsers] skipped row missing user_id', {
        type: row?.type,
        title: row?.title,
      });
      continue;
    }
    valid.push({
      user_id: row.user_id,
      research_id: row.research_id || null,
      type: row.type,
      title: row.title,
      message: row.message,
      sender_user_id: row.sender_user_id || null,
      action_url: row.action_url || (row.research_id ? `/research/${row.research_id}` : null),
    });
  }

  if (valid.length === 0) return { data: [], skipped: rows.length };

  const { data, error } = await supabase
    .from('notifications')
    .insert(valid)
    .select('id');

  if (error) {
    // Gracefully fall back if new columns don't exist yet
    if (
      String(error.message || '').includes('sender_user_id') ||
      String(error.message || '').includes('action_url')
    ) {
      const fallbackRows = valid.map(({ user_id, research_id, type, title, message }) => ({
        user_id, research_id, type, title, message,
      }));
      const fallbackResult = await supabase.from('notifications').insert(fallbackRows).select('id');
      if (!fallbackResult.error) {
        return { data: fallbackResult.data, attempted: valid.length, skipped: rows.length - valid.length };
      }
    }

    console.error('[notifyUsers] bulk insert failed', {
      count: valid.length,
      error: error.message || error,
    });
    return { error, attempted: valid.length };
  }

  return { data, attempted: valid.length, skipped: rows.length - valid.length };
}

/**
 * Fetch the user IDs of all accepted co-authors for a paper.
 * Returns an empty array on error so callers do not need to handle failures.
 */
async function getPaperCoAuthors(researchId) {
  if (!researchId) return [];

  try {
    const { data, error } = await supabase
      .from('research_authors')
      .select('user_id')
      .eq('research_id', researchId)
      .eq('is_primary', false);

    if (error) {
      console.warn('[getPaperCoAuthors] query failed', { researchId, error: error.message });
      return [];
    }

    return (data || []).map((row) => row.user_id).filter(Boolean);
  } catch (err) {
    console.warn('[getPaperCoAuthors] unexpected error', { researchId, error: err.message });
    return [];
  }
}

/**
 * Notify all accepted co-authors of a paper.
 *
 * - Automatically fetches co-author IDs from research_authors.
 * - Skips the user identified by excludeUserId (e.g. the triggering author).
 * - Deduplicates against any extra IDs in alreadyNotifiedIds to prevent double-sends.
 * - Silently no-ops when the paper has no co-authors or the query fails.
 */
async function notifyCoAuthors({
  researchId,
  type,
  title,
  message,
  senderUserId = null,
  excludeUserId = null,
  alreadyNotifiedIds = [],
}) {
  const coAuthorIds = await getPaperCoAuthors(researchId);
  if (coAuthorIds.length === 0) return { skipped: 0, attempted: 0 };

  const excluded = new Set(
    [excludeUserId, ...alreadyNotifiedIds].filter(Boolean).map(String)
  );
  const eligible = coAuthorIds.filter((id) => !excluded.has(String(id)));

  if (eligible.length === 0) return { skipped: coAuthorIds.length, attempted: 0 };

  return notifyUsers(
    eligible.map((userId) => ({
      user_id: userId,
      research_id: researchId,
      type,
      title,
      message,
      sender_user_id: senderUserId || null,
    }))
  );
}

module.exports = { notifyUser, notifyUsers, getPaperCoAuthors, notifyCoAuthors };
