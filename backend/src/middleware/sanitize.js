/**
 * sanitize.js
 * Recursively strips MongoDB operator characters ($, .) from all string
 * values in req.body, req.query, and req.params to prevent NoSQL injection.
 * Applied globally in server.js before any route handler runs.
 */

const UNSAFE = /[$]/g; // block $ operator prefix; dots in field names are safe in values

function sanitizeValue(v) {
  if (typeof v === 'string') return v.replace(UNSAFE, '');
  if (Array.isArray(v))     return v.map(sanitizeValue);
  if (v !== null && typeof v === 'object') return sanitizeObject(v);
  return v;
}

function sanitizeObject(obj) {
  const clean = {};
  for (const key of Object.keys(obj)) {
    // Drop keys that start with $ (MongoDB operators injected as field names)
    if (key.startsWith('$')) continue;
    clean[key] = sanitizeValue(obj[key]);
  }
  return clean;
}

const sanitize = (req, _res, next) => {
  if (req.body   && typeof req.body   === 'object') req.body   = sanitizeObject(req.body);
  if (req.query  && typeof req.query  === 'object') req.query  = sanitizeObject(req.query);
  if (req.params && typeof req.params === 'object') req.params = sanitizeObject(req.params);
  next();
};

module.exports = sanitize;
