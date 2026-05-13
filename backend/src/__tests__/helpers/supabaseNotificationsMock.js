/**
 * Matches supabase-js insert().select() / .select().single() chains used by notify.js
 */
function mockNotificationsTable() {
  return {
    insert: () => ({
      select: () => {
        const bulkResult = { data: [{ id: 'n1' }], error: null };
        const singleResult = { data: { id: 'n1' }, error: null };
        const bulkPromise = Promise.resolve(bulkResult);
        return {
          single: () => Promise.resolve(singleResult),
          then: (onF, onR) => bulkPromise.then(onF, onR),
          catch: (onR) => bulkPromise.catch(onR),
        };
      },
    }),
  };
}

function supabaseGenericFallback(table) {
  if (table === 'notifications') {
    return mockNotificationsTable();
  }
  return {
    insert: async () => ({ error: null }),
  };
}

module.exports = { mockNotificationsTable, supabaseGenericFallback };
