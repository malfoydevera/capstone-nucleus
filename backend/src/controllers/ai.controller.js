const { getModel } = require('../config/gemini');
const axios = require('axios');

// Import pdf-parse with fallback
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  console.log('pdf-parse loaded:', typeof pdfParse);
} catch (err) {
  console.error('Failed to load pdf-parse:', err);
}

const chatWithPaper = async (req, res) => {
  try {
    console.log('=== Chat Request Started ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { paperId, message, fileUrl } = req.body;

    // Validate inputs
    if (!message) {
      console.error('Error: Message is missing');
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!fileUrl) {
      console.error('Error: File URL is missing');
      return res.status(400).json({ error: 'File URL is required' });
    }

    console.log('Fetching PDF from:', fileUrl);

    // Fetch the PDF using axios
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'arraybuffer'
    });

    console.log('PDF fetched successfully');

    const buffer = Buffer.from(response.data);
    console.log('Buffer size:', buffer.length, 'bytes');

    // Extract text from PDF
    console.log('Starting PDF text extraction...');
    console.log('pdfParse function type:', typeof pdfParse);
    
    if (typeof pdfParse !== 'function') {
      console.error('pdf-parse is not a function! Type:', typeof pdfParse);
      return res.status(500).json({ 
        error: 'PDF parser not properly initialized',
        details: 'pdf-parse module failed to load correctly'
      });
    }

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return res.status(400).json({ 
        error: 'Failed to parse PDF. The file may be corrupted or protected.',
        details: pdfError.message
      });
    }

    const extractedText = pdfData.text;

    console.log('Text extracted, length:', extractedText.length, 'characters');
    console.log('First 200 chars:', extractedText.substring(0, 200));

    if (!extractedText || extractedText.trim().length === 0) {
      console.error('No text could be extracted from PDF');
      return res.status(400).json({ 
        error: 'Could not extract text from PDF. The file may be image-based or corrupted.' 
      });
    }

    // Truncate text if too long (Gemini has token limits)
    const maxChars = 30000;
    const truncatedText = extractedText.length > maxChars 
      ? extractedText.substring(0, maxChars) + '\n\n[Text truncated due to length...]'
      : extractedText;

    console.log('Preparing prompt for Gemini...');

    // Prepare the context-aware prompt
    const prompt = `You are an AI assistant helping a student understand a research paper. Here is the full text of the paper:

---
${truncatedText}
---

Based ONLY on the content above, please answer the following question. If the answer cannot be found in the paper, say so clearly.

Question: ${message}

Answer:`;

    console.log('Sending request to Gemini API...');

    // Send to Gemini
    const model = getModel();
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    console.log('Gemini response received, length:', aiResponse.length);
    console.log('=== Chat Request Completed Successfully ===');

    res.json({
      success: true,
      response: aiResponse,
      paperId
    });

  } catch (error) {
    console.error('=== ERROR in chatWithPaper ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Send more specific error messages
    let errorMessage = 'Failed to process request';
    let statusCode = 500;

    if (error.message && error.message.includes('API key')) {
      errorMessage = 'Invalid or missing Google API key';
      statusCode = 500;
    } else if (error.response) {
      errorMessage = 'Failed to download PDF file';
      statusCode = 400;
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      errorMessage = 'Network error: Could not reach the server';
      statusCode = 503;
    }

    res.status(statusCode).json({ 
      error: errorMessage, 
      details: error.message 
    });
  }
};

module.exports = {
  chatWithPaper
};