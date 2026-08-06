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

const getModel = () => {
  // Use gemini-2.0-flash which is the current available model
  const modelName = 'gemini-flash-latest';
  logger.info({ model: modelName }, 'Gemini model configured');
  
  return genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    }
  });
};

// Embedding model for semantic/thematic search.
// `gemini-embedding-001` is available on the Generative Language API; we request
// 768 dimensions to match the pgvector column (default output is 3072).
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

const getEmbeddingModel = () => genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

module.exports = { getModel, getEmbeddingModel, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };