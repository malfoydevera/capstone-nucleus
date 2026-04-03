const { createRateLimiter, normalizeIp } = require('../../middleware/rateLimiter');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };
}

describe('rateLimiter middleware', () => {
  test('allows requests until max then returns 429', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, bucketPrefix: 'test' });
    const req = { ip: '10.0.0.1', headers: {} };
    const next = jest.fn();

    limiter(req, createRes(), next);
    limiter(req, createRes(), next);

    const blockedRes = createRes();
    limiter(req, blockedRes, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({ error: 'Too many requests. Please try again later.' });
    expect(blockedRes.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  test('uses isolated buckets per IP', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, bucketPrefix: 'test' });
    const next = jest.fn();

    const reqA = { ip: '10.0.0.1', headers: {} };
    const reqB = { ip: '10.0.0.2', headers: {} };

    limiter(reqA, createRes(), next);
    limiter(reqB, createRes(), next);

    const blockedResA = createRes();
    limiter(reqA, blockedResA, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedResA.status).toHaveBeenCalledWith(429);
  });

  test('resets after window expiration', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_050)
      .mockReturnValueOnce(2_500);

    const limiter = createRateLimiter({ windowMs: 1_000, maxRequests: 1, bucketPrefix: 'test' });
    const req = { ip: '10.0.0.3', headers: {} };
    const next = jest.fn();

    limiter(req, createRes(), next);

    const blockedRes = createRes();
    limiter(req, blockedRes, next);
    expect(blockedRes.status).toHaveBeenCalledWith(429);

    const allowedResAfterReset = createRes();
    limiter(req, allowedResAfterReset, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(allowedResAfterReset.status).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  test('normalizeIp falls back to x-forwarded-for and unknown', () => {
    expect(normalizeIp({ ip: '127.0.0.1', headers: {} })).toBe('127.0.0.1');
    expect(normalizeIp({ headers: { 'x-forwarded-for': '203.0.113.10, 70.41.3.18' } })).toBe('203.0.113.10');
    expect(normalizeIp({ headers: {} })).toBe('unknown');
  });
});
