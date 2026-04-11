export const formatFullName = (user = {}) => {
  const first = (user.first_name || user.firstName || '').trim();
  const middle = (user.middle_name || user.middleName || '').trim();
  const last = (user.last_name || user.lastName || '').trim();

  const combined = [first, middle, last].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (combined) return combined;

  const fallback = (user.name || '').trim();
  if (fallback) return fallback;

  return (user.email || '').trim();
};

export const getInitials = (user = {}) => {
  const name = formatFullName(user);
  if (!name) return '?';
  const tokens = name.split(' ').filter(Boolean);
  if (tokens.length === 1) return tokens[0][0]?.toUpperCase() || '?';
  return `${tokens[0][0] || ''}${tokens[tokens.length - 1][0] || ''}`.toUpperCase();
};
