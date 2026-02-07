const express = require('express');
const router = express.Router();
const multer = require('multer');
const { chatWithPaper, extractPdfMetadata } = require('../controllers/ai.controller');

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

router.post('/chat', chatWithPaper);
router.post('/extract-pdf', upload.single('file'), extractPdfMetadata);

module.exports = router;