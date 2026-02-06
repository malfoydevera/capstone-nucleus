const express = require('express');
const router = express.Router();
const { chatWithPaper } = require('../controllers/ai.controller');

router.post('/chat', chatWithPaper);

module.exports = router;