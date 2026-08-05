// Per-role institutional email domain policy.
// Domains are read from env so they are not hardcoded and can be extended to an
// allowlist (comma-separated) later without code changes.
//
// Mapping: 'student' -> STUDENT_EMAIL_DOMAINS; every other role -> STAFF_EMAIL_DOMAINS.
//
// Recovery email must be a personal inbox. Consumer providers are never treated
// as institutional — even if misconfigured in env — so password-reset recovery
// cannot be blocked by a bad allowlist.

const DEFAULT_STUDENT_DOMAINS = 'students.nu-dasma.edu.ph';
const DEFAULT_STAFF_DOMAINS = 'nu-dasma.edu.ph';

/** Personal inbox providers that must never be treated as institutional login domains. */
const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.com.ph',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'mail.com',
  'zoho.com',
  'gmx.com',
  'gmx.net',
]);

function parseDomains(raw) {
  return String(raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
    .filter((domain) => !CONSUMER_EMAIL_DOMAINS.has(domain));
}

function getStudentDomains() {
  const parsed = parseDomains(process.env.STUDENT_EMAIL_DOMAINS || DEFAULT_STUDENT_DOMAINS);
  return parsed.length > 0 ? parsed : parseDomains(DEFAULT_STUDENT_DOMAINS);
}

function getStaffDomains() {
  const parsed = parseDomains(process.env.STAFF_EMAIL_DOMAINS || DEFAULT_STAFF_DOMAINS);
  return parsed.length > 0 ? parsed : parseDomains(DEFAULT_STAFF_DOMAINS);
}

function getAllowedDomainsForRole(role) {
  return String(role) === 'student' ? getStudentDomains() : getStaffDomains();
}

function extractDomain(email) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  return at === -1 ? '' : value.slice(at + 1);
}

function validateEmailDomainForRole(email, role) {
  const allowed = getAllowedDomainsForRole(role);
  const domain = extractDomain(email);

  if (!domain) {
    return { valid: false, message: 'A valid email address is required' };
  }

  if (!allowed.includes(domain)) {
    const label = role === 'student' ? 'student' : 'staff/faculty';
    return {
      valid: false,
      message: `This email domain is not allowed for ${label} accounts. Use one of: ${allowed.map((d) => `@${d}`).join(', ')}`,
    };
  }

  return { valid: true, message: '' };
}

function getInstitutionalDomains() {
  return [...new Set([...getStudentDomains(), ...getStaffDomains()])];
}

function isConsumerEmailDomain(domain) {
  return CONSUMER_EMAIL_DOMAINS.has(String(domain || '').trim().toLowerCase());
}

function isInstitutionalEmail(email) {
  const domain = extractDomain(email);
  if (!domain || isConsumerEmailDomain(domain)) return false;
  return getInstitutionalDomains().includes(domain);
}

function validateRecoveryEmail(email, institutionalEmail) {
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
}

module.exports = {
  CONSUMER_EMAIL_DOMAINS,
  getStudentDomains,
  getStaffDomains,
  getAllowedDomainsForRole,
  getInstitutionalDomains,
  isConsumerEmailDomain,
  isInstitutionalEmail,
  validateEmailDomainForRole,
  validateRecoveryEmail,
  extractDomain,
};
