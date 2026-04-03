const normalizeToken = (value) => (value == null ? '' : String(value).trim());

const buildFullName = (user = {}) => {
  if (!user || typeof user !== 'object') return '';

  const first = normalizeToken(user.first_name || user.firstName);
  const middle = normalizeToken(user.middle_name || user.middleName);
  const last = normalizeToken(user.last_name || user.lastName);

  const parts = [first, middle, last].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  return normalizeToken(user.full_name || user.fullName || user.name || user.email || '');
};

const attachFullName = (user) => {
  if (!user || typeof user !== 'object') return user;
  const fullName = buildFullName(user);
  return {
    ...user,
    full_name: fullName,
  };
};

const splitFullName = (value) => {
  const raw = normalizeToken(value).replace(/\s+/g, ' ');
  if (!raw) {
    return { first_name: '', middle_name: null, last_name: '' };
  }

  const tokens = raw.split(' ');
  if (tokens.length === 1) {
    return { first_name: tokens[0], middle_name: null, last_name: tokens[0] };
  }

  const first_name = tokens[0];
  const last_name = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1).join(' ').trim();

  return {
    first_name,
    middle_name: middle || null,
    last_name,
  };
};

module.exports = {
  attachFullName,
  buildFullName,
  splitFullName,
};
