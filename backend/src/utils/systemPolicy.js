const supabase = require('../config/supabase');

const SUPPORTED_FILE_TYPES = ['pdf', 'doc', 'docx'];
const MIME_BY_TYPE = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

const DEFAULT_POLICY = {
  maxFileSizeMb: 10,
  allowedFileTypes: ['pdf'],
};

function normalizeFileTypes(fileTypes) {
  const list = Array.isArray(fileTypes)
    ? fileTypes
    : String(fileTypes || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

  const normalized = [...new Set(list.map((value) => String(value).toLowerCase().replace(/^\./, '')))]
    .filter((value) => SUPPORTED_FILE_TYPES.includes(value));

  return normalized;
}

function toPolicyResponse(row) {
  if (!row) {
    return { ...DEFAULT_POLICY };
  }

  const normalizedTypes = normalizeFileTypes(row.allowed_file_types);
  const maxFileSizeMb = Number(row.max_file_size_mb) || DEFAULT_POLICY.maxFileSizeMb;

  return {
    maxFileSizeMb,
    allowedFileTypes: normalizedTypes.length > 0 ? normalizedTypes : [...DEFAULT_POLICY.allowedFileTypes],
  };
}

async function getSystemPolicy() {
  try {
    const { data, error } = await supabase
      .from('system_policy_settings')
      .select('max_file_size_mb, allowed_file_types')
      .eq('id', true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return toPolicyResponse(data);
  } catch (error) {
    return { ...DEFAULT_POLICY };
  }
}

async function updateSystemPolicy({ maxFileSizeMb, allowedFileTypes, updatedBy = null }) {
  const parsedMax = Number(maxFileSizeMb);
  if (!Number.isFinite(parsedMax) || parsedMax <= 0 || parsedMax > 100) {
    const err = new Error('maxFileSizeMb must be a number between 1 and 100');
    err.code = 'INVALID_MAX_FILE_SIZE';
    throw err;
  }

  const normalizedTypes = normalizeFileTypes(allowedFileTypes);
  if (normalizedTypes.length === 0) {
    const err = new Error('At least one allowed file type is required');
    err.code = 'INVALID_ALLOWED_FILE_TYPES';
    throw err;
  }

  const payload = {
    id: true,
    max_file_size_mb: parsedMax,
    allowed_file_types: normalizedTypes,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('system_policy_settings')
    .upsert(payload)
    .select('max_file_size_mb, allowed_file_types')
    .single();

  if (error) {
    throw error;
  }

  return toPolicyResponse(data);
}

function isFileAllowedByPolicy(file, allowedFileTypes) {
  if (!file) return true;

  const normalizedTypes = normalizeFileTypes(allowedFileTypes);
  const ext = String(file.originalname || '').split('.').pop()?.toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  return normalizedTypes.some((type) => {
    const extMatches = ext === type;
    const mimeMatches = (MIME_BY_TYPE[type] || []).includes(mime);
    return extMatches || mimeMatches;
  });
}

module.exports = {
  DEFAULT_POLICY,
  SUPPORTED_FILE_TYPES,
  getSystemPolicy,
  updateSystemPolicy,
  isFileAllowedByPolicy,
};
