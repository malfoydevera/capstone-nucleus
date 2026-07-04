/**
 * Structured logging via pino. Falls back to console when pino is unavailable.
 */
let pino;
try {
  pino = require('pino');
} catch {
  pino = null;
}

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = pino
  ? pino({
      level,
      ...(process.env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    })
  : {
      info: (...args) => console.log(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
      debug: (...args) => console.debug(...args),
      fatal: (...args) => console.error('[FATAL]', ...args),
      child: () => logger,
    };

module.exports = logger;
