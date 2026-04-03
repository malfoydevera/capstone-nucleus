const express = require('express');
const router = express.Router();
const multer = require('multer');
const { chatWithPaper, extractPdfMetadata, generateReviewSummary } = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

const windowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const maxRequests = Number(process.env.AI_RATE_LIMIT_MAX || 30);
const requestBuckets = new Map();

const aiRateLimiter = (req, res, next) => {
  const key = `${req.user?.id || 'anonymous'}:${req.ip}`;
  const now = Date.now();
  const bucket = requestBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (bucket.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many AI requests. Please try again later.' });
  }

  bucket.count += 1;
  return next();
};

router.post('/chat', authenticate, aiRateLimiter, chatWithPaper);
router.post('/review-summary', authenticate, aiRateLimiter, generateReviewSummary);
router.post('/extract-pdf', authenticate, aiRateLimiter, upload.single('file'), extractPdfMetadata);

module.exports = router;