/**
 * cache.js — P-001 Server-side caching utility
 * Uses node-cache (in-process, zero infra required).
 * TTLs are chosen based on how frequently the data changes:
 *   categories    — 10 min (static, rarely updated)
 *   faculty/dean  — 5 min  (added/removed occasionally)
 *   departments   — 10 min (static)
 */
let NodeCache;
try {
  NodeCache = require('node-cache');
} catch (_error) {
  NodeCache = null;
}

class FallbackCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key, value, ttlSeconds = 0) {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return true;
  }

  del(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach((key) => this.store.delete(key));
  }

  keys() {
    const now = Date.now();
    const result = [];

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      result.push(key);
    }

    return result;
  }
}

// stdTTL: default TTL in seconds.  checkperiod: scan every 60s for expired keys.
const cache = NodeCache
  ? new NodeCache({ stdTTL: 0, checkperiod: 60, useClones: false })
  : new FallbackCache();

const TTL = {
  CATEGORIES:   600,  // 10 min
  FACULTY:      300,  //  5 min
  DEAN_CHAIR:   300,  //  5 min
  DEPARTMENTS:  600,  // 10 min
  PUBLISHED:     90,  // 90 sec — browse/search listings
  PUBLIC_STATS:   60,  //  1 min — landing/login hero metrics
  ORG_LOOKUPS:  600,  // 10 min — departments/programs
  SYSTEM_HEALTH:  30,  // 30 sec — admin health dashboard
};

/**
 * Fetch from cache, or call `fetcher()` and store the result.
 * @param {string}   key
 * @param {number}   ttl  — seconds
 * @param {Function} fetcher — async function that returns the data
 */
async function getOrSet(key, ttl, fetcher) {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const data = await fetcher();
  cache.set(key, data, ttl);
  return data;
}

/** Invalidate one or more cache keys */
function invalidate(...keys) {
  cache.del(keys);
}

/** Invalidate all keys matching a prefix */
function invalidatePrefix(prefix) {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  if (keys.length) cache.del(keys);
}

/** Invalidate browse/search caches after paper visibility changes. */
function invalidateBrowseCaches() {
  invalidatePrefix('published:');
  invalidatePrefix('semantic:');
  invalidate('public:stats');
}

module.exports = { cache, TTL, getOrSet, invalidate, invalidatePrefix, invalidateBrowseCaches };
