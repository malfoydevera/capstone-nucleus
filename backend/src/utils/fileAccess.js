const supabase = require('../config/supabase');

const PUBLIC_STATUSES = new Set(['approved', 'published']);
const SIGNED_URL_TTL_SECONDS = Number.parseInt(process.env.SIGNED_URL_TTL_SECONDS || '3600', 10);
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'research-papers';

function isPublicPaperStatus(status) {
  return PUBLIC_STATUSES.has(status);
}

function canAccessPaper(user, paper) {
  if (!user || !paper) return false;

  if (isPublicPaperStatus(paper.status)) return true;
  if (paper.author_id === user.id) return true;
  if (paper.faculty_id === user.id) return true;
  if (paper.dean_chair_id === user.id) return true;
  if (['admin', 'staff'].includes(user.role)) return true;

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

async function createSignedUrl(storagePath, expiresInSeconds = SIGNED_URL_TTL_SECONDS) {
  if (!storagePath) return null;

  if (typeof supabase.createSignedFileUrl === 'function') {
    return supabase.createSignedFileUrl(storagePath, expiresInSeconds, STORAGE_BUCKET);
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

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

  const storagePath = paper.file_storage_path || extractStoragePathFromUrl(paper.file_url);

  if (!storagePath) {
    return paper.file_url || null;
  }

  try {
    const signedUrl = await createSignedUrl(storagePath);
    return signedUrl || paper.file_url || null;
  } catch (error) {
    console.error('Failed to create signed URL:', error.message);
    return paper.file_url || null;
  }
}

module.exports = {
  canAccessPaper,
  createSignedUrl,
  extractStoragePathFromUrl,
  isPublicPaperStatus,
  resolvePaperFileUrl,
};
