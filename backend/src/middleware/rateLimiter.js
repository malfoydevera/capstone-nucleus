const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_AUTH_MAX_REQUESTS = 5;

const toPositiveNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const normalizeIp = (req) => {
  if (req.ip) return req.ip;

  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    const [firstIp] = forwardedFor.split(',');
    if (firstIp && firstIp.trim()) return firstIp.trim();
  }

  return 'unknown';
};

const createRateLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests,
  bucketPrefix = 'rate-limit',
  message = 'Too many requests. Please try again later.',
  keyFn,
} = {}) => {
  const resolvedMaxRequests = toPositiveNumber(maxRequests, DEFAULT_AUTH_MAX_REQUESTS);
  const resolvedWindowMs = toPositiveNumber(windowMs, DEFAULT_WINDOW_MS);
  const requestBuckets = new Map();

  const middleware = (req, res, next) => {
    const clientKey = typeof keyFn === 'function' ? keyFn(req) : normalizeIp(req);
    const key = `${bucketPrefix}:${clientKey || 'unknown'}`;
    const now = Date.now();
    const bucket = requestBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      requestBuckets.set(key, { count: 1, resetAt: now + resolvedWindowMs });
      return next();
    }

    if (bucket.count >= resolvedMaxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    bucket.count += 1;
    return next();
  };

  middleware.clear = () => requestBuckets.clear();

  return middleware;
};

const authRateLimiter = createRateLimiter({
  windowMs: toPositiveNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
  maxRequests: toPositiveNumber(process.env.AUTH_RATE_LIMIT_MAX, DEFAULT_AUTH_MAX_REQUESTS),
  bucketPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again later.',
  keyFn: normalizeIp,
});

const publishedRateLimiter = createRateLimiter({
  windowMs: toPositiveNumber(process.env.PUBLISHED_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
  maxRequests: toPositiveNumber(process.env.PUBLISHED_RATE_LIMIT_MAX, 120),
  bucketPrefix: 'published',
  message: 'Too many browse requests. Please try again shortly.',
  keyFn: normalizeIp,
});

module.exports = {
  authRateLimiter,
  publishedRateLimiter,
  createRateLimiter,
  normalizeIp,
};