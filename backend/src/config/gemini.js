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

const DEFAULT_MODELS = (process.env.GEMINI_MODELS || 'gemini-2.0-flash,gemini-1.5-flash,gemini-flash-latest')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableGeminiError = (error) => {
  const message = String(error?.message || '');
  return (
    message.includes('503')
    || message.includes('429')
    || message.includes('high demand')
    || message.includes('Resource exhausted')
    || message.includes('overloaded')
  );
};

const getModel = (modelName = DEFAULT_MODELS[0]) => {
  logger.info({ model: modelName }, 'Gemini model configured');

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });
};

const generateContentWithRetry = async (prompt, { maxAttempts = 3 } = {}) => {
  let lastError;

  for (const modelName of DEFAULT_MODELS) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const model = getModel(modelName);
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        lastError = error;
        logger.warn(
          { model: modelName, attempt, message: error?.message },
          'Gemini generateContent attempt failed'
        );

        if (!isRetryableGeminiError(error) || attempt === maxAttempts) {
          break;
        }

        await sleep(500 * attempt);
      }
    }
  }

  throw lastError;
};

// Embedding model for semantic/thematic search.
// `gemini-embedding-001` is available on the Generative Language API; we request
// 768 dimensions to match the pgvector column (default output is 3072).
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

const getEmbeddingModel = () => genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

module.exports = {
  getModel,
  generateContentWithRetry,
  getEmbeddingModel,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};
