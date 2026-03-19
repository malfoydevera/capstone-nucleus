const { getModel } = require('../config/gemini');
const axios = require('axios');
const supabase = require('../config/supabase');
const { canAccessPaper, resolvePaperFileUrl } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');

// Import pdf-parse with fallback
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (err) {
  console.error('[ai.controller] Failed to load pdf-parse:', err.message);
}

// ─── S-003: Production-safe logger ────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';
const log = {
  debug: (...args) => { if (!isProduction) console.log(...args); },
  info: (...args) => { if (!isProduction) console.log(...args); },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

// ─── P-004: In-memory PDF text cache (keyed by paperId, 30-min TTL) ──────────
const pdfTextCache = new Map();
const PDF_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCachedText(paperId) {
  const entry = pdfTextCache.get(paperId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PDF_CACHE_TTL_MS) {
    pdfTextCache.delete(paperId);
    return null;
  }
  return entry.text;
}

function setCachedText(paperId, text) {
  pdfTextCache.set(paperId, { text, timestamp: Date.now() });
}

// ─── SSRF (A10): Validate URL is within the expected Supabase storage domain ──
function isAllowedStorageUrl(url) {
  try {
    const parsed = new URL(url);
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;
    // Allow *.supabase.co or the configured Supabase host
    return (
      parsed.hostname.endsWith('.supabase.co') ||
      (supabaseHost && parsed.hostname === supabaseHost)
    );
  } catch {
    return false;
  }
}

const chatWithPaper = async (req, res) => {
  try {
    log.info('=== Chat Request Started ===');
    const { paperId, message } = req.body;
    const requester = req.user;

    if (!message) {
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

    // ── P-004: Check cache before downloading PDF ──
    let extractedText = getCachedText(paperId);

    if (!extractedText) {
      const fileUrl = await resolvePaperFileUrl(paper);
      if (!fileUrl) {
        return sendError(res, { status: 400, code: 'FILE_UNAVAILABLE', message: 'Paper file is not available' });
      }

      // ── SSRF guard ──
      if (!isAllowedStorageUrl(fileUrl)) {
        log.error('[ai.controller] SSRF guard: blocked URL:', fileUrl);
        return sendError(res, { status: 400, code: 'INVALID_FILE_URL', message: 'Paper file URL is not permitted' });
      }

      log.debug('[ai.controller] Fetching PDF for paperId:', paperId);

      const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 15 * 1024 * 1024,
      });

      const buffer = Buffer.from(response.data);
      log.debug('[ai.controller] PDF fetched, buffer size:', buffer.length, 'bytes');

      if (typeof pdfParse !== 'function') {
        log.error('[ai.controller] pdf-parse not loaded correctly');
        return sendError(res, {
          status: 500,
          code: 'PDF_PARSER_INIT_FAILED',
          message: 'PDF parser not properly initialized',
        });
      }

      let pdfData;
      try {
        pdfData = await pdfParse(buffer);
      } catch (pdfError) {
        log.error('[ai.controller] PDF parsing error:', pdfError.message);
        return sendError(res, {
          status: 400,
          code: 'PDF_PARSE_FAILED',
          message: 'Failed to parse PDF. The file may be corrupted or protected.',
        });
      }

      extractedText = pdfData.text;
      log.debug('[ai.controller] Text extracted, length:', extractedText.length);

      if (!extractedText || extractedText.trim().length === 0) {
        return sendError(res, {
          status: 400,
          code: 'PDF_TEXT_EXTRACTION_FAILED',
          message: 'Could not extract text from PDF. The file may be image-based or corrupted.',
        });
      }

      // Store in cache for subsequent messages
      setCachedText(paperId, extractedText);
      log.debug('[ai.controller] PDF text cached for paperId:', paperId);
    } else {
      log.debug('[ai.controller] PDF text served from cache for paperId:', paperId);
    }

    // Truncate text if too long (Gemini has token limits)
    const maxChars = 30000;
    const truncatedText = extractedText.length > maxChars
      ? extractedText.substring(0, maxChars) + '\n\n[Text truncated due to length...]'
      : extractedText;

    const prompt = `You are an AI assistant helping a student understand a research paper. Here is the full text of the paper:

---
${truncatedText}
---

Based ONLY on the content above, please answer the following question. If the answer cannot be found in the paper, say so clearly.

Question: ${message}

Answer:`;

    const model = getModel();
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    log.info('[ai.controller] Chat request completed for paperId:', paperId);

    return sendSuccess(res, {
      data: {
        response: aiResponse,
        paperId,
      },
    });

  } catch (error) {
    log.error('[ai.controller] Error in chatWithPaper:', error.message);

    let errorMessage = 'Failed to process request';
    let statusCode = 500;

    if (error.message && error.message.includes('API key')) {
      errorMessage = 'Invalid or missing Google API key';
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
      // S-007: Only expose details in development
      ...(isProduction ? {} : { details: error.message }),
    });
  }
};

// Extract title and abstract from uploaded PDF
const extractPdfMetadata = async (req, res) => {
  try {
    log.info('[ai.controller] PDF Metadata Extraction Started');

    if (!req.file) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'No PDF file uploaded' });
    }

    const buffer = req.file.buffer;
    log.debug('[ai.controller] PDF buffer size:', buffer.length, 'bytes');

    if (typeof pdfParse !== 'function') {
      log.error('[ai.controller] pdf-parse not loaded correctly');
      return sendError(res, {
        status: 500,
        code: 'PDF_PARSER_INIT_FAILED',
        message: 'PDF parser not properly initialized',
      });
    }

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (pdfError) {
      log.error('[ai.controller] PDF parsing error:', pdfError.message);
      return sendError(res, {
        status: 400,
        code: 'PDF_PARSE_FAILED',
        message: 'Failed to parse PDF. The file may be corrupted or protected.',
      });
    }

    const extractedText = pdfData.text;
    log.debug('[ai.controller] Text extracted, length:', extractedText.length);

    if (!extractedText || extractedText.trim().length === 0) {
      return sendError(res, {
        status: 400,
        code: 'PDF_TEXT_EXTRACTION_FAILED',
        message: 'Could not extract text from PDF. The file may be image-based or corrupted.',
      });
    }

    const maxChars = 15000;
    const truncatedText = extractedText.length > maxChars
      ? extractedText.substring(0, maxChars)
      : extractedText;

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

    let metadata;
    try {
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      metadata = JSON.parse(cleanResponse);
    } catch (parseError) {
      log.warn('[ai.controller] Failed to parse AI JSON response, attempting manual extraction');
      metadata = { title: '', abstract: '' };
      const titleMatch = aiResponse.match(/"title"\s*:\s*"([^"]+)"/);
      const abstractMatch = aiResponse.match(/"abstract"\s*:\s*"([^"]+)"/);
      if (titleMatch) metadata.title = titleMatch[1];
      if (abstractMatch) metadata.abstract = abstractMatch[1];
    }

    log.info('[ai.controller] PDF Metadata Extraction Completed');

    return sendSuccess(res, {
      data: {
        title: metadata.title || '',
        abstract: metadata.abstract || '',
      },
    });

  } catch (error) {
    log.error('[ai.controller] Error in extractPdfMetadata:', error.message);
    return sendError(res, {
      status: 500,
      code: 'AI_METADATA_EXTRACTION_FAILED',
      message: 'Failed to extract PDF metadata',
      ...(isProduction ? {} : { details: error.message }),
    });
  }
};

module.exports = {
  chatWithPaper,
  extractPdfMetadata,
};