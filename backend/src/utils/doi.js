/**
 * Shared DOI helpers.
 * Used by admin.controller.js (formal publish) and submission.controller.js
 * (student DOI entry / publish requests) so both stay in sync.
 */

/** Loose DOI check: optional https://doi.org/ prefix, then common DOI patterns */
function normalizeDoiInput(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return s.trim();
}

function isValidDoiFormat(doi) {
  if (!doi || doi.length > 512) return false;
  // Typical Crossref-style DOI
  if (/^10\.\d{4,9}\/\S+$/i.test(doi)) return true;
  return false;
}

module.exports = { normalizeDoiInput, isValidDoiFormat };
