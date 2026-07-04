const logger = require('../utils/logger');

let Sentry = null;

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    logger.info('Sentry initialized');
  } catch (err) {
    logger.warn({ err: err.message }, 'Sentry init failed — continuing without error tracking');
    Sentry = null;
  }

  return Sentry;
}

function captureException(err, context = {}) {
  if (Sentry) {
    Sentry.captureException(err, { extra: context });
  }
}

module.exports = { initSentry, captureException, getSentry: () => Sentry };
