const { randomUUID } = require('crypto');
const logger = require('./logger');
const { captureException } = require('../config/sentry');

const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 15000;

function registerProcessHandlers({ server, stopSchedulers }) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown started');

    if (typeof stopSchedulers === 'function') {
      stopSchedulers();
    }

    if (!server) {
      process.exit(0);
      return;
    }

    server.close((err) => {
      if (err) {
        logger.error({ err: err.message }, 'Error during server close');
        process.exit(1);
        return;
      }
      logger.info('Server closed — exiting');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Shutdown timeout — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason: String(reason) }, 'Unhandled promise rejection');
    captureException(reason instanceof Error ? reason : new Error(String(reason)));
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception');
    captureException(err);
    process.exit(1);
  });
}

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

module.exports = { registerProcessHandlers, requestIdMiddleware };
