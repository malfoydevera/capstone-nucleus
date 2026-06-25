const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

function parseListPagination(query = {}, { defaultLimit = DEFAULT_LIMIT } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return {
    page,
    limit,
    from: (page - 1) * limit,
    to: (page - 1) * limit + limit - 1,
  };
}

module.exports = {
  MAX_LIMIT,
  DEFAULT_LIMIT,
  parseListPagination,
};
