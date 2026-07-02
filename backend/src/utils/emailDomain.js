// Per-role institutional email domain policy.
// Domains are read from env so they are not hardcoded and can be extended to an
// allowlist (comma-separated) later without code changes.
//
// Mapping: 'student' -> STUDENT_EMAIL_DOMAINS; every other role -> STAFF_EMAIL_DOMAINS.

const DEFAULT_STUDENT_DOMAINS = 'students.nu-dasma.edu.ph';
const DEFAULT_STAFF_DOMAINS = 'nu-dasma.edu.ph';

function parseDomains(raw) {
  return String(raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

function getStudentDomains() {
  return parseDomains(process.env.STUDENT_EMAIL_DOMAINS || DEFAULT_STUDENT_DOMAINS);
}

function getStaffDomains() {
  return parseDomains(process.env.STAFF_EMAIL_DOMAINS || DEFAULT_STAFF_DOMAINS);
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

function isInstitutionalEmail(email) {
  const domain = extractDomain(email);
  if (!domain) return false;
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
  getStudentDomains,
  getStaffDomains,
  getAllowedDomainsForRole,
  getInstitutionalDomains,
  isInstitutionalEmail,
  validateEmailDomainForRole,
  validateRecoveryEmail,
  extractDomain,
};
