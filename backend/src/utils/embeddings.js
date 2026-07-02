/**
 * embeddings.js
 * Gemini text-embedding helpers for AI-powered thematic search.
 *
 * Responsibilities:
 *   - Build the canonical embedding input from a paper (title + abstract + keywords).
 *   - Generate document/query embeddings via Gemini `text-embedding-004` (768-dim).
 *   - Provide a stable content hash so callers can skip re-embedding unchanged text.
 *
 * Design notes:
 *   - All failures are swallowed into `null` returns. Embedding is an enhancement,
 *     never a hard dependency of paper submission or search availability.
 *   - Uses the correct Gemini `taskType` for retrieval (asymmetric document vs.
 *     query embeddings improve relevance materially).
 */
const crypto = require('crypto');
const { getEmbeddingModel, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = require('../config/gemini');

const EMBED_OPTIONS = { outputDimensionality: EMBEDDING_DIMENSIONS };

const TASK_TYPE = {
  DOCUMENT: 'RETRIEVAL_DOCUMENT',
  QUERY: 'RETRIEVAL_QUERY',
};

// Gemini rejects very long inputs; keep well under the model limit. Title +
// abstract + keywords for a paper is tiny, but we clamp defensively.
const MAX_INPUT_CHARS = 8000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hasApiKey = () => Boolean(process.env.GOOGLE_API_KEY);

/**
 * Normalize a paper's searchable fields into a single embedding input string.
 * Keywords may arrive as an array (DB) or comma string (form payload).
 * @param {{ title?: string, abstract?: string, keywords?: string[]|string }} paper
 * @returns {string}
 */
const buildEmbeddingInput = ({ title, abstract, keywords } = {}) => {
  const keywordList = Array.isArray(keywords)
    ? keywords
    : String(keywords || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

  const parts = [
    title ? `Title: ${String(title).trim()}` : '',
    abstract ? `Abstract: ${String(abstract).trim()}` : '',
    keywordList.length ? `Keywords: ${keywordList.join(', ')}` : '',
  ].filter(Boolean);

  return parts.join('\n').slice(0, MAX_INPUT_CHARS);
};

/**
 * Deterministic sha256 of the embedding input. Used to detect when a paper's
 * embeddable content changed and avoid redundant API calls.
 * @param {string} text
 * @returns {string|null}
 */
const contentHash = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const embedWithRetry = async (text, taskType) => {
  const input = String(text || '').trim();
  if (!input) return null;
  if (!hasApiKey()) {
    console.warn('[embeddings] GOOGLE_API_KEY not set — skipping embedding generation');
    return null;
  }

  const model = getEmbeddingModel();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await model.embedContent({
        content: { parts: [{ text: input.slice(0, MAX_INPUT_CHARS) }] },
        taskType,
        ...EMBED_OPTIONS,
      });

      const values = result?.embedding?.values;
      if (Array.isArray(values) && values.length === EMBEDDING_DIMENSIONS) {
        return values;
      }

      console.warn(
        `[embeddings] Unexpected embedding shape (len=${values?.length}); expected ${EMBEDDING_DIMENSIONS}`
      );
      return null;
    } catch (error) {
      const isLast = attempt === MAX_RETRIES;
      console.warn(
        `[embeddings] embedContent failed (attempt ${attempt}/${MAX_RETRIES}): ${error?.message || error}`
      );
      if (isLast) return null;
      await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  return null;
};

/**
 * Embed text as a stored document (RETRIEVAL_DOCUMENT task type).
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
const embedDocument = (text) => embedWithRetry(text, TASK_TYPE.DOCUMENT);

/**
 * Embed a user search query (RETRIEVAL_QUERY task type).
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
const embedQuery = (text) => embedWithRetry(text, TASK_TYPE.QUERY);

module.exports = {
  buildEmbeddingInput,
  contentHash,
  embedDocument,
  embedQuery,
  hasApiKey,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};
