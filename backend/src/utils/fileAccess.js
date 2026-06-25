const supabase = require('../config/supabase');

const PUBLIC_STATUSES = new Set(['approved', 'published']);
const SIGNED_URL_TTL_SECONDS = Number.parseInt(process.env.SIGNED_URL_TTL_SECONDS || '3600', 10);
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'research-papers';
const seenSignedUrlErrors = new Set();

function isPublicPaperStatus(status) {
  return PUBLIC_STATUSES.has(status);
}

function sameId(a, b) {
  return String(a || '') === String(b || '');
}

/** Dean / chair oversight when paper and user are org-scoped (skip when user has no org set). */
function departmentOrProgramAlignedForOversight(user, paper) {
  if (!user?.department_id && !user?.department && !user?.program_id) return true;
  if (user.program_id && paper.program_id) return sameId(user.program_id, paper.program_id);
  if (user.department_id && paper.department_id) return sameId(user.department_id, paper.department_id);
  if (user.department && paper.department) {
    return String(user.department).trim() === String(paper.department).trim();
  }
  if (user.program_id && !paper.program_id && user.department_id && paper.department_id) {
    return sameId(user.department_id, paper.department_id);
  }
  return false;
}

function canDownloadPaper(user) {
  return user?.role === 'admin';
}

function canAccessPaper(user, paper) {
  if (!user || !paper) return false;

  if (isPublicPaperStatus(paper.status)) return true;
  if (sameId(paper.author_id, user.id)) return true;
  if (sameId(paper.faculty_id, user.id)) return true;
  if (sameId(paper.dean_chair_id, user.id)) return true;
  if (['admin', 'staff'].includes(user.role)) return true;

  // Deans receive escalation alerts on program-chair queue papers where dean_chair_id is the chair, not the dean.
  if (user.role === 'dean' && paper.status === 'pending_program_chair') return true;

  if (user.role === 'dean') {
    const deanOversight = new Set(['pending_dean', 'pending_faculty', 'pending_editor', 'pending_admin', 'revision_required']);
    if (deanOversight.has(paper.status) && departmentOrProgramAlignedForOversight(user, paper)) return true;
  }

  if (user.role === 'program_chair') {
    const chairOversight = new Set(['pending_program_chair', 'pending_dean', 'pending_faculty', 'pending_editor', 'pending_admin', 'revision_required']);
    if (chairOversight.has(paper.status) && departmentOrProgramAlignedForOversight(user, paper)) return true;
  }

  // If the paper was fetched with its research_authors relation, check co-authorship
  if (Array.isArray(paper.research_authors)) {
    if (paper.research_authors.some((a) => sameId(a.user_id, user.id))) return true;
  }

  return false;
}

function extractStoragePathFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return null;

  try {
    const parsed = new URL(fileUrl);
    const decodedPath = decodeURIComponent(parsed.pathname || '');

    // Handles both public and signed Supabase URL styles:
    // /storage/v1/object/public/<bucket>/<path>
    // /storage/v1/object/sign/<bucket>/<path>
    const marker = `/${STORAGE_BUCKET}/`;
    const markerIndex = decodedPath.indexOf(marker);
    if (markerIndex === -1) return null;

    return decodedPath.slice(markerIndex + marker.length);
  } catch (_err) {
    return null;
  }
}

function normalizeStoragePath(input) {
  if (!input || typeof input !== 'string') return null;

  let value = input.trim();
  if (!value) return null;

  // Legacy rows may store a full URL in file_storage_path. Try extracting a bucket-relative path.
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const extracted = extractStoragePathFromUrl(value);
    return extracted || null;
  }

  // Remove query string if any leaked into stored path.
  value = value.split('?')[0];

  // Normalize common accidental prefixes.
  if (value.startsWith(`/${STORAGE_BUCKET}/`)) {
    value = value.slice(STORAGE_BUCKET.length + 2);
  }

  if (value.startsWith(`${STORAGE_BUCKET}/`)) {
    value = value.slice(STORAGE_BUCKET.length + 1);
  }

  // Strip leading slashes and decode URL-encoded path.
  value = value.replace(/^\/+/, '');
  try {
    value = decodeURIComponent(value);
  } catch (_err) {
    // Keep original value if it is not valid URI-encoded text.
  }

  return value || null;
}

async function createSignedUrl(storagePath, expiresInSeconds = SIGNED_URL_TTL_SECONDS) {
  const normalizedPath = normalizeStoragePath(storagePath);
  if (!normalizedPath) return null;

  if (typeof supabase.createSignedFileUrl === 'function') {
    return supabase.createSignedFileUrl(normalizedPath, expiresInSeconds, STORAGE_BUCKET);
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(normalizedPath, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data?.signedUrl || null;
}

async function resolvePaperFileUrl(paper) {
  if (!paper) return null;

  if (isPublicPaperStatus(paper.status)) {
    return paper.file_url || null;
  }

  const storagePath = normalizeStoragePath(paper.file_storage_path) || extractStoragePathFromUrl(paper.file_url);

  if (!storagePath) {
    return paper.file_url || null;
  }

  try {
    const signedUrl = await createSignedUrl(storagePath);
    return signedUrl || paper.file_url || null;
  } catch (error) {
    // Avoid spamming identical errors every polling cycle.
    const key = `${paper.id || 'unknown'}:${storagePath}:${error.message}`;
    if (!seenSignedUrlErrors.has(key)) {
      seenSignedUrlErrors.add(key);
      console.error('Failed to create signed URL:', error.message, { paperId: paper.id, storagePath });
    }
    return paper.file_url || null;
  }
}

module.exports = {
  canAccessPaper,
  canDownloadPaper,
  createSignedUrl,
  extractStoragePathFromUrl,
  isPublicPaperStatus,
  resolvePaperFileUrl,
};
