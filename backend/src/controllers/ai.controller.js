const { generateContentWithRetry } = require('../config/gemini');
const axios = require('axios');
const supabase = require('../config/supabase');
const { canAccessPaper, resolvePaperFileUrl } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');

const AI_DEBUG = process.env.AI_DEBUG === 'true';
const debugLog = (...args) => {
  if (AI_DEBUG) {
    console.log(...args);
  }
};

// Import pdf-parse with fallback
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  debugLog('pdf-parse loaded:', typeof pdfParse);
} catch (err) {
  console.error('Failed to load pdf-parse:', err);
}

const chatWithPaper = async (req, res) => {
  try {
    debugLog('=== Chat Request Started ===');
    const { paperId, message } = req.body;
    const requester = req.user;

    // Validate inputs
    if (!message) {
      debugLog('Error: Message is missing');
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

    debugLog('Fetching PDF from:', fileUrl);

    // Fetch the PDF using axios
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 15 * 1024 * 1024,
    });

    debugLog('PDF fetched successfully');

    const buffer = Buffer.from(response.data);
    debugLog('Buffer size:', buffer.length, 'bytes');

    // Extract text from PDF
    debugLog('Starting PDF text extraction...');
    debugLog('pdfParse function type:', typeof pdfParse);
    
    if (typeof pdfParse !== 'function') {
      debugLog('pdf-parse is not a function! Type:', typeof pdfParse);
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

    debugLog('Text extracted, length:', extractedText.length, 'characters');
    debugLog('First 200 chars:', extractedText.substring(0, 200));

    if (!extractedText || extractedText.trim().length === 0) {
      debugLog('No text could be extracted from PDF');
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

    debugLog('Preparing prompt for Gemini...');

    // Prepare the context-aware prompt
    const prompt = `You are an AI assistant helping a student understand a research paper. Here is the full text of the paper:

---
${truncatedText}
---

Based ONLY on the content above, please answer the following question. If the answer cannot be found in the paper, say so clearly.

Question: ${message}

Answer:`;

    debugLog('Sending request to Gemini API...');

    // Send to Gemini (retries + fallback models on 503/429)
    const aiResponse = await generateContentWithRetry(prompt);

    debugLog('Gemini response received, length:', aiResponse.length);
    debugLog('=== Chat Request Completed Successfully ===');

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
    } else if (error.message && (error.message.includes('503') || error.message.includes('high demand') || error.message.includes('429'))) {
      errorMessage = 'AI service is temporarily busy. Please try again in a moment.';
      statusCode = 503;
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

const generateReviewSummary = async (req, res) => {
  try {
    const { paperId } = req.body;
    const requester = req.user;

    if (!paperId) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Paper ID is required' });
    }

    if (!['faculty', 'dean', 'program_chair', 'staff', 'admin'].includes(requester.role)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Only reviewers can use AI summary' });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, title, abstract, status, file_url, file_storage_path, author_id, faculty_id, dean_chair_id')
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

    if (typeof pdfParse !== 'function') {
      return sendError(res, {
        status: 500,
        code: 'PDF_PARSER_INIT_FAILED',
        message: 'PDF parser not properly initialized',
      });
    }

    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 15 * 1024 * 1024,
    });

    const buffer = Buffer.from(response.data);
    const pdfData = await pdfParse(buffer);
    const extractedText = (pdfData?.text || '').trim();

    if (!extractedText) {
      return sendError(res, {
        status: 400,
        code: 'PDF_TEXT_EXTRACTION_FAILED',
        message: 'Could not extract text from PDF',
      });
    }

    const maxChars = 25000;
    const truncatedText = extractedText.length > maxChars
      ? `${extractedText.substring(0, maxChars)}\n\n[Text truncated due to length]`
      : extractedText;

    const prompt = `You are assisting an academic reviewer. Read the paper content below and produce:
1) A concise 3-5 sentence summary.
2) Three strengths.
3) Three potential concerns or questions for reviewers.

Return strict JSON with this shape only:
{"summary":"...","strengths":["..."],"concerns":["..."]}

Paper title: ${paper.title}
Paper abstract: ${paper.abstract || ''}

Paper content:
---
${truncatedText}
---`;

    const aiResponse = await generateContentWithRetry(prompt);

    let parsed;
    try {
      let clean = aiResponse.trim();
      if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        summary: aiResponse,
        strengths: [],
        concerns: [],
      };
    }

    return sendSuccess(res, {
      data: {
        paperId,
        summary: parsed.summary || '',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 5) : [],
      },
    });
  } catch (error) {
    console.error('AI review summary error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'AI_REVIEW_SUMMARY_FAILED',
      message: 'Failed to generate review summary',
      details: error.message,
    });
  }
};

// Extract title and abstract from uploaded PDF
const extractPdfMetadata = async (req, res) => {
  try {
    debugLog('=== PDF Metadata Extraction Started ===');
    
    if (!req.file) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'No PDF file uploaded' });
    }

    const buffer = req.file.buffer;
    debugLog('PDF buffer size:', buffer.length, 'bytes');

    if (typeof pdfParse !== 'function') {
      debugLog('pdf-parse is not a function!');
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
    debugLog('Text extracted, length:', extractedText.length, 'characters');

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

    debugLog('Preparing extraction prompt for Gemini...');

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

    debugLog('Gemini response:', aiResponse);

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

    debugLog('=== PDF Metadata Extraction Completed ===');
    debugLog('Title:', metadata.title?.substring(0, 50) + '...');
    debugLog('Abstract length:', metadata.abstract?.length);

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
  extractPdfMetadata,
  generateReviewSummary,
};