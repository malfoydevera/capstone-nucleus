const MAX_MB = Number(process.env.RESEARCH_UPLOAD_MAX_MB) || 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAGIC_SIGNATURES = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE/doc
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK/docx
];

function matchesMagicBytes(buffer, signature) {
  if (!buffer || buffer.length < signature.bytes.length) return false;
  return signature.bytes.every((byte, i) => buffer[i] === byte);
}

function validateResearchFileBuffer(buffer, declaredMime) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, message: 'File is empty' };
  }

  if (buffer.length > MAX_BYTES) {
    return { valid: false, message: `File size too large. Maximum ${MAX_MB}MB allowed.` };
  }

  if (!ALLOWED_MIMES.includes(declaredMime)) {
    return { valid: false, message: 'Unsupported file type' };
  }

  const magicMatch = MAGIC_SIGNATURES.some(
    (sig) => sig.mime === declaredMime && matchesMagicBytes(buffer, sig)
  );

  if (!magicMatch) {
    return { valid: false, message: 'File content does not match its declared type' };
  }

  return { valid: true, message: '' };
}

module.exports = {
  MAX_MB,
  MAX_BYTES,
  ALLOWED_MIMES,
  validateResearchFileBuffer,
};
