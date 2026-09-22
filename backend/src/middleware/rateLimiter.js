/**
 * rateLimiter.js
 * In-memory sliding-window rate limiter — no external dependencies.
 *
 * Usage:
 *   const { rateLimiter } = require('../middleware/rateLimiter');
 *   app.use('/api/auth', rateLimiter({ max: 10, windowMs: 60_000 }));
 *   app.use('/api',      rateLimiter({ max: 200, windowMs: 60_000 }));
 *
 * Each unique IP gets its own sliding window.
 * The store is pruned every `windowMs` to prevent unbounded memory growth.
 */

const rateLimiter = ({ max = 100, windowMs = 60_000, message = 'Too many requests, please try again later.' } = {}) => {
  // store: Map<ip, number[]>  — array of request timestamps within the window
  const store = new Map();

  // Prune stale entries periodically
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of store.entries()) {
      const fresh = timestamps.filter(t => t > cutoff);
      if (fresh.length === 0) store.delete(ip);
      else store.set(ip, fresh);
    }
  }, windowMs).unref(); // .unref() so this timer doesn't keep the process alive

  return (req, res, next) => {
    // Prefer X-Forwarded-For (set by Render / proxies) over socket address
    const ip  = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
                  .split(',')[0].trim();
    const now = Date.now();
    const cutoff = now - windowMs;

    const timestamps = (store.get(ip) || []).filter(t => t > cutoff);
    timestamps.push(now);
    store.set(ip, timestamps);

    // Set standard rate-limit headers
    res.setHeader('X-RateLimit-Limit',     max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - timestamps.length));
    res.setHeader('X-RateLimit-Reset',     Math.ceil((now + windowMs) / 1000));

    if (timestamps.length > max) {
      return res.status(429).json({ message });
    }
    next();
  };
};

module.exports = { rateLimiter };
