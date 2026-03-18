const { getModel } = require('../config/gemini');
const axios = require('axios');
const supabase = require('../config/supabase');
const { canAccessPaper, resolvePaperFileUrl } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');

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
    const { paperId, message } = req.body;
    const requester = req.user;

    // Validate inputs
    if (!message) {
      console.error('Error: Message is missing');
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Message is required' });
    }

    if (!paperId) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Paper ID is required' });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('*')
      .eq('id', paperId)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(requester, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'You do not have access to this paper' });
    }

    const fileUrl = await resolvePaperFileUrl(paper);

    if (!fileUrl) {
      return sendError(res, { status: 400, code: 'FILE_UNAVAILABLE', message: 'Paper file is not available' });
    }

    console.log('Fetching PDF from:', fileUrl);

    // Fetch the PDF using axios
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 15 * 1024 * 1024,
    });

    console.log('PDF fetched successfully');

    const buffer = Buffer.from(response.data);
    console.log('Buffer size:', buffer.length, 'bytes');

    // Extract text from PDF
    console.log('Starting PDF text extraction...');
    console.log('pdfParse function type:', typeof pdfParse);
    
    if (typeof pdfParse !== 'function') {
      console.error('pdf-parse is not a function! Type:', typeof pdfParse);
      return sendError(res, {
        status: 500,
        code: 'PDF_PARSER_INIT_FAILED',
        message: 'PDF parser not properly initialized',
        details: 'pdf-parse module failed to load correctly'
      });
    }

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return sendError(res, {
        status: 400,
        code: 'PDF_PARSE_FAILED',
        message: 'Failed to parse PDF. The file may be corrupted or protected.',
        details: pdfError.message
      });
    }

    const extractedText = pdfData.text;

    console.log('Text extracted, length:', extractedText.length, 'characters');
    console.log('First 200 chars:', extractedText.substring(0, 200));

    if (!extractedText || extractedText.trim().length === 0) {
      console.error('No text could be extracted from PDF');
      return sendError(res, {
        status: 400,
        code: 'PDF_TEXT_EXTRACTION_FAILED',
        message: 'Could not extract text from PDF. The file may be image-based or corrupted.'
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

    return sendSuccess(res, {
      data: {
        response: aiResponse,
        paperId,
      },
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

    return sendError(res, {
      status: statusCode,
      code: 'AI_CHAT_FAILED',
      message: errorMessage,
      details: error.message,
    });
  }
};

// Extract title and abstract from uploaded PDF
const extractPdfMetadata = async (req, res) => {
  try {
    console.log('=== PDF Metadata Extraction Started ===');
    
    if (!req.file) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'No PDF file uploaded' });
    }

    const buffer = req.file.buffer;
    console.log('PDF buffer size:', buffer.length, 'bytes');

    if (typeof pdfParse !== 'function') {
      console.error('pdf-parse is not a function!');
      return sendError(res, {
        status: 500,
        code: 'PDF_PARSER_INIT_FAILED',
        message: 'PDF parser not properly initialized',
        details: 'pdf-parse module failed to load correctly',
      });
    }

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return sendError(res, {
        status: 400,
        code: 'PDF_PARSE_FAILED',
        message: 'Failed to parse PDF. The file may be corrupted or protected.',
        details: pdfError.message,
      });
    }

    const extractedText = pdfData.text;
    console.log('Text extracted, length:', extractedText.length, 'characters');

    if (!extractedText || extractedText.trim().length === 0) {
      return sendError(res, {
        status: 400,
        code: 'PDF_TEXT_EXTRACTION_FAILED',
        message: 'Could not extract text from PDF. The file may be image-based or corrupted.'
      });
    }

    // Truncate text if too long
    const maxChars = 15000;
    const truncatedText = extractedText.length > maxChars 
      ? extractedText.substring(0, maxChars)
      : extractedText;

    console.log('Preparing extraction prompt for Gemini...');

    // Prompt for extracting title and abstract
    const prompt = `You are an expert at analyzing academic research papers. I need you to extract the title and abstract from the following research paper text.

Research Paper Text:
---
${truncatedText}
---

Please extract and return the following in JSON format:
1. "title": The exact title of the research paper (usually at the beginning, in larger font or prominent position)
2. "abstract": The abstract section of the paper (usually labeled "Abstract" and summarizes the research)

If you cannot find the title, make your best guess based on the content.
If you cannot find a formal abstract, create a brief 2-3 sentence summary of what the paper appears to be about.

IMPORTANT: Return ONLY valid JSON in this exact format, with no additional text or markdown:
{"title": "extracted title here", "abstract": "extracted abstract here"}`;

    const model = getModel();
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    console.log('Gemini response:', aiResponse);

    // Parse the JSON response
    let metadata;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      metadata = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Try to extract manually if JSON parsing fails
      metadata = {
        title: '',
        abstract: ''
      };
      
      // Attempt basic extraction
      const titleMatch = aiResponse.match(/"title"\s*:\s*"([^"]+)"/);
      const abstractMatch = aiResponse.match(/"abstract"\s*:\s*"([^"]+)"/);
      
      if (titleMatch) metadata.title = titleMatch[1];
      if (abstractMatch) metadata.abstract = abstractMatch[1];
    }

    console.log('=== PDF Metadata Extraction Completed ===');
    console.log('Title:', metadata.title?.substring(0, 50) + '...');
    console.log('Abstract length:', metadata.abstract?.length);

    return sendSuccess(res, {
      data: {
        title: metadata.title || '',
        abstract: metadata.abstract || '',
      },
    });

  } catch (error) {
    console.error('=== ERROR in extractPdfMetadata ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    return sendError(res, {
      status: 500,
      code: 'AI_METADATA_EXTRACTION_FAILED',
      message: 'Failed to extract PDF metadata',
      details: error.message,
    });
  }
};

module.exports = {
  chatWithPaper,
  extractPdfMetadata
};