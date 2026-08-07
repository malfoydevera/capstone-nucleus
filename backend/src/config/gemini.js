const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
  logger.warn('GOOGLE_API_KEY is not set in environment');
} else {
  logger.info('Google API Key loaded');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Low-usage tier: pinned version IDs (not -latest aliases) to avoid shifting model behavior.
// gemini-3.5-flash-lite is the primary lite model; gemini-3.1-flash-lite is the fallback.
const DEFAULT_MODELS = (process.env.GEMINI_MODELS || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error) => String(error?.message || '');

const isModelUnavailableError = (error) => {
  const message = getErrorMessage(error);
  return (
    message.includes('[404')
    || message.includes('not found')
    || message.includes('limit: 0')
    || message.includes('is not supported')
  );
};

const isQuotaExceededError = (error) => {
  const message = getErrorMessage(error);
  return message.includes('429') || message.includes('quota') || message.includes('Quota exceeded');
};

const isRetryableGeminiError = (error) => {
  if (isModelUnavailableError(error)) return false;
  const message = getErrorMessage(error);
  return (
    message.includes('503')
    || message.includes('429')
    || message.includes('high demand')
    || message.includes('Resource exhausted')
    || message.includes('overloaded')
    || message.includes('unavailable')
  );
};

const getModel = (modelName = DEFAULT_MODELS[0]) => genAI.getGenerativeModel({
  model: modelName,
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.7,
  },
});

const generateContentWithRetry = async (prompt, { maxAttempts = 4 } = {}) => {
  let lastError;

  for (const modelName of DEFAULT_MODELS) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        logger.info({ model: modelName, attempt, promptChars: prompt.length }, 'Gemini generateContent');
        const model = getModel(modelName);
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        lastError = error;
        const message = getErrorMessage(error);
        logger.warn({ model: modelName, attempt, message }, 'Gemini generateContent attempt failed');

        if (isModelUnavailableError(error)) {
          break;
        }

        if (!isRetryableGeminiError(error) || attempt === maxAttempts) {
          break;
        }

        // Google's "high demand" 503s are often transient within a few seconds;
        // back off progressively instead of giving up after ~1s total.
        const retryDelayMs = message.includes('retry in') || message.includes('RetryInfo')
          ? 4000
          : 1500 * attempt;
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError;
};

const classifyGeminiError = (error) => {
  const message = getErrorMessage(error);
  if (message.includes('API key') || message.includes('API_KEY')) {
    return { status: 500, message: 'Invalid or missing Google API key' };
  }
  if (isQuotaExceededError(error)) {
    return {
      status: 503,
      message: 'Google AI quota exceeded for this API key. Enable billing or create a new key in Google AI Studio.',
    };
  }
  if (message.includes('503') || message.includes('high demand') || message.includes('unavailable')) {
    return { status: 503, message: 'AI service is temporarily busy. Please try again in a moment.' };
  }
  return { status: 500, message: 'Failed to process AI request' };
};

// Embedding model for semantic/thematic search.
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

const getEmbeddingModel = () => genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

module.exports = {
  getModel,
  generateContentWithRetry,
  classifyGeminiError,
  getEmbeddingModel,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};
