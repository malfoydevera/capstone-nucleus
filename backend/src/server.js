const express = require('express');
const cors = require('cors');
const compression = require('compression');
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
const { initSentry, captureException } = require('./config/sentry');
const logger = require('./utils/logger');
const pinoHttp = require('pino-http');
// #region agent log
(() => {
  try {
    const pinoHttpPino = require('pino-http/node_modules/pino');
    const rootPino = require('pino');
    const symHttp = pinoHttpPino.symbols.stringifySym;
    const symRoot = rootPino.symbols.stringifySym;
    fetch('http://127.0.0.1:7699/ingest/31ab08dd-a09a-416f-8c2d-d8ca10ba795d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c1e1a' }, body: JSON.stringify({ sessionId: '7c1e1a', runId: 'pre-fix', hypothesisId: 'H1-H4', location: 'server.js:startup', message: 'pino symbol compatibility check', data: { rootPinoVersion: require('pino/package.json').version, pinoHttpPinoVersion: require('pino-http/node_modules/pino/package.json').version, sameStringifySym: symHttp === symRoot, loggerHasHttpSym: typeof logger[symHttp], loggerHasRootSym: typeof logger[symRoot], customPropsConfigured: true }, timestamp: Date.now() }) }).catch(() => {});
  } catch (e) {
    fetch('http://127.0.0.1:7699/ingest/31ab08dd-a09a-416f-8c2d-d8ca10ba795d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c1e1a' }, body: JSON.stringify({ sessionId: '7c1e1a', runId: 'pre-fix', hypothesisId: 'H2', location: 'server.js:startup', message: 'pino check failed', data: { error: e.message }, timestamp: Date.now() }) }).catch(() => {});
  }
})();
// #endregion
const { registerProcessHandlers, requestIdMiddleware } = require('./utils/processHandlers');
const { checkReadiness } = require('./utils/readiness');
const { MAX_MB } = require('./config/upload');
const { sendError } = require('./utils/response');

dotenv.config();

const validateRequiredEnv = () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
};

validateRequiredEnv();
initSentry();

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

const schedulerTimers = [];

const startInlineSchedulers = () => {
  if (process.env.ENABLE_INLINE_SCHEDULERS !== 'true') {
    logger.info('Inline schedulers disabled — use scripts/run-jobs.js via cron worker');
    return;
  }

  logger.info('Starting inline schedulers (dev mode)');
  schedulerTimers.push(startEscalationScheduler());
  schedulerTimers.push(startRecycleBinCleanupScheduler());
  schedulerTimers.push(startReviewDeadlineReminderScheduler());
};

const stopSchedulers = () => {
  schedulerTimers.forEach((timer) => clearInterval(timer));
  schedulerTimers.length = 0;
};

app.use(requestIdMiddleware);

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customProps: (req) => ({ requestId: req.id }),
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/ready',
  },
}));

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
app.use(compression());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

app.use((req, res, next) => {
  res.locals.requestId = req.id;
  // #region agent log
  res.on('finish', () => {
    fetch('http://127.0.0.1:7699/ingest/31ab08dd-a09a-416f-8c2d-d8ca10ba795d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c1e1a' }, body: JSON.stringify({ sessionId: '7c1e1a', runId: 'pre-fix', hypothesisId: 'H3', location: 'server.js:res-finish', message: 'request completed without crash', data: { url: req.url, statusCode: res.statusCode, requestId: req.id }, timestamp: Date.now() }) }).catch(() => {});
  });
  // #endregion
  next();
});

const mountApiRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/research`, researchRoutes);
  app.use(`${prefix}/ai`, aiRoutes);
  app.use(`${prefix}/departments`, departmentRoutes);
};

mountApiRoutes('/api');
mountApiRoutes('/api/v1');

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running', requestId: req.id });
});

app.get('/ready', async (req, res) => {
  const result = await checkReadiness();
  if (!result.ok) {
    return sendError(res, {
      status: 503,
      code: 'NOT_READY',
      message: result.error || 'Service not ready',
      requestId: req.id,
    });
  }
  return res.json({ status: 'READY', requestId: req.id });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File size too large. Maximum ${MAX_MB}MB allowed.`,
        requestId: req.id,
      });
    }
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload', requestId: req.id });
  }

  if (err.message === 'CORS origin denied') {
    return res.status(403).json({ error: 'CORS origin denied', requestId: req.id });
  }

  logger.error({ err: err.message, requestId: req.id, stack: err.stack }, 'Server error');
  captureException(err, { requestId: req.id });

  const responseMessage = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message || 'Server error');

  return sendError(res, {
    status: err.status || 500,
    code: 'SERVER_ERROR',
    message: responseMessage,
    requestId: req.id,
  });
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server running');
  startInlineSchedulers();
});

registerProcessHandlers({ server, stopSchedulers });

module.exports = app;
