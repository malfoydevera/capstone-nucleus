const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
  console.error('⚠️  WARNING: GOOGLE_API_KEY is not set in .env file');
} else {
  console.log('✅ Google API Key loaded successfully');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const getModel = () => {
  // Try gemini-flash-latest which should have free tier access
  // Alternative free models: 'gemini-2.5-flash-lite', 'gemma-3-4b-it'
  const modelName = 'gemini-flash-latest';
  console.log(`Using model: ${modelName}`);
  
  return genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    }
  });
};

module.exports = { getModel };