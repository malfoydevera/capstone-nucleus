const normalizeToken = (value) => (value == null ? '' : String(value).trim());
const normalizeComparable = (value) => normalizeToken(value).toLowerCase();

const normalizeNameParts = (user = {}, options = {}) => {
  const preserveSingleTokenLast = options.preserveSingleTokenLast === true;

  const first = normalizeToken(user.first_name || user.firstName);
  let middle = normalizeToken(user.middle_name || user.middleName);
  let last = normalizeToken(user.last_name || user.lastName);

  if (middle && last && normalizeComparable(middle) === normalizeComparable(last)) {
    const prefixedLast = `${normalizeComparable(first)} `;
    if (normalizeComparable(last).startsWith(prefixedLast)) {
      last = normalizeToken(last.slice(first.length).trim());
      middle = '';
    }
  }

  if (middle && normalizeComparable(middle) === normalizeComparable(first)) {
    middle = '';
  }

  if (!preserveSingleTokenLast && last && !middle && normalizeComparable(last) === normalizeComparable(first)) {
    last = '';
  }

  return {
    first_name: first,
    middle_name: middle || null,
    last_name: last,
  };
};

const buildFullName = (user = {}) => {
  if (!user || typeof user !== 'object') return '';

  const {
    first_name: first,
    middle_name: middle,
    last_name: last,
  } = normalizeNameParts(user);

  const parts = [first, middle, last].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  return normalizeToken(user.name || user.email || '');
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
    return normalizeNameParts({ first_name: tokens[0], middle_name: null, last_name: tokens[0] }, { preserveSingleTokenLast: true });
  }

  const first_name = tokens[0];
  const last_name = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1).join(' ').trim();

  return normalizeNameParts({
    first_name,
    middle_name: middle || null,
    last_name,
  }, { preserveSingleTokenLast: true });
};

module.exports = {
  attachFullName,
  buildFullName,
  normalizeNameParts,
  splitFullName,
};
