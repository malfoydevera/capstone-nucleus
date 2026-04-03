const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const researchRoutes = require('./routes/research.routes');
const aiRoutes = require('./routes/ai.routes');
const departmentRoutes = require('./routes/department.routes');
const { startEscalationScheduler } = require('./utils/escalationAlerts');
const { startRecycleBinCleanupScheduler } = require('./utils/recycleBinCleanup');
const { startReviewDeadlineReminderScheduler } = require('./utils/reviewDeadlineReminders');
dotenv.config();

const validateRequiredEnv = () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
};

validateRequiredEnv();

const app = express();
const PORT = process.env.PORT || 5000;

const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === undefined) {
  app.set('trust proxy', 1);
} else if (trustProxy === 'true' || trustProxy === 'false') {
  app.set('trust proxy', trustProxy === 'true');
} else {
  const trustProxyAsNumber = Number(trustProxy);
  app.set('trust proxy', Number.isFinite(trustProxyAsNumber) ? trustProxyAsNumber : trustProxy);
}

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/departments', departmentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
    }
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  console.error('Server error:', err);
  const responseMessage = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Server error');
  res.status(500).json({ error: responseMessage });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  if (process.env.ENABLE_ESCALATION_ALERTS !== 'false') {
    startEscalationScheduler();
  }

  if (process.env.ENABLE_RECYCLE_BIN_CLEANUP !== 'false') {
    startRecycleBinCleanupScheduler();
  }

  if (process.env.ENABLE_REVIEW_DEADLINE_REMINDERS !== 'false') {
    startReviewDeadlineReminderScheduler();
  }
});

