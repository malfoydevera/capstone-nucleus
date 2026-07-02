// Mirror of backend/src/utils/emailDomain.js for client-side UX validation.
// The backend remains the source of truth; this only improves the user experience.
//
// Mapping: 'student' -> student domain; every other role -> staff/faculty domain.

const DEFAULT_STUDENT_DOMAIN = 'students.nu-dasma.edu.ph';
const DEFAULT_STAFF_DOMAIN = 'nu-dasma.edu.ph';

const parseDomains = (raw, fallback) => {
  const list = String(raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  return list.length > 0 ? list : [fallback];
};

const STUDENT_DOMAINS = parseDomains(import.meta.env.VITE_STUDENT_EMAIL_DOMAIN, DEFAULT_STUDENT_DOMAIN);
const STAFF_DOMAINS = parseDomains(import.meta.env.VITE_STAFF_EMAIL_DOMAIN, DEFAULT_STAFF_DOMAIN);

export const getAllowedDomainsForRole = (role) =>
  (String(role) === 'student' ? STUDENT_DOMAINS : STAFF_DOMAINS);

export const getPrimaryDomainForRole = (role) => getAllowedDomainsForRole(role)[0];

const extractDomain = (email) => {
  const value = String(email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  return at === -1 ? '' : value.slice(at + 1);
};

export const validateEmailDomainForRole = (email, role) => {
  const allowed = getAllowedDomainsForRole(role);
  const domain = extractDomain(email);

  if (!domain) {
    return { valid: false, message: 'A valid email address is required' };
  }

  if (!allowed.includes(domain)) {
    const label = role === 'student' ? 'student' : 'staff/faculty';
    return {
      valid: false,
      message: `Use your institutional ${label} email (${allowed.map((d) => `@${d}`).join(', ')})`,
    };
  }

  return { valid: true, message: '' };
};

export const getInstitutionalDomains = () =>
  [...new Set([...STUDENT_DOMAINS, ...STAFF_DOMAINS])];

export const isInstitutionalEmail = (email) => {
  const domain = extractDomain(email);
  if (!domain) return false;
  return getInstitutionalDomains().includes(domain);
};

export const validateRecoveryEmail = (email, institutionalEmail) => {
  const normalized = String(email || '').trim().toLowerCase();
  const institutional = String(institutionalEmail || '').trim().toLowerCase();

  if (!normalized || !normalized.includes('@')) {
    return { valid: false, message: 'A valid recovery email address is required' };
  }

  if (normalized === institutional) {
    return {
      valid: false,
      message: 'Recovery email must be different from your institutional login email',
    };
  }

  if (isInstitutionalEmail(normalized)) {
    return {
      valid: false,
      message: 'Use a personal inbox (e.g. Gmail, Yahoo) — not your institutional email domain',
    };
  }

  return { valid: true, message: '' };
};

export default validateEmailDomainForRole;
