/**
 * validate.js
 * Lightweight body-validation middleware — no external dependencies.
 *
 * Usage:
 *   const { validate, rules } = require('../middleware/validate');
 *   router.post('/', validate({ email: [rules.required, rules.isEmail], password: [rules.required, rules.minLen(6)] }), handler);
 *
 * Each rule is a function (value, fieldName) => errorString | null.
 */

/* ── built-in rules ──────────────────────────────────────────────────────── */
const rules = {
  required: (v, field) =>
    v === undefined || v === null || String(v).trim() === ''
      ? `${field} is required`
      : null,

  isEmail: (v, field) =>
    v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())
      ? `${field} must be a valid email address`
      : null,

  isString: (v, field) =>
    v !== undefined && typeof v !== 'string'
      ? `${field} must be a string`
      : null,

  minLen: (min) => (v, field) =>
    v !== undefined && String(v).trim().length < min
      ? `${field} must be at least ${min} characters`
      : null,

  maxLen: (max) => (v, field) =>
    v !== undefined && String(v).trim().length > max
      ? `${field} must not exceed ${max} characters`
      : null,

  isNumber: (v, field) =>
    v !== undefined && (typeof v !== 'number' || isNaN(v))
      ? `${field} must be a number`
      : null,

  min: (min) => (v, field) =>
    v !== undefined && Number(v) < min
      ? `${field} must be at least ${min}`
      : null,

  max: (max) => (v, field) =>
    v !== undefined && Number(v) > max
      ? `${field} must not exceed ${max}`
      : null,

  isIn: (allowed) => (v, field) =>
    v !== undefined && !allowed.includes(v)
      ? `${field} must be one of: ${allowed.join(', ')}`
      : null,

  noScript: (v, field) =>
    v !== undefined && /<script[\s\S]*?>[\s\S]*?<\/script>/i.test(String(v))
      ? `${field} contains invalid content`
      : null,
};

/**
 * validate(schema)
 * schema: { fieldName: [rule, rule, ...], ... }
 * Runs every rule for every field; collects all errors; returns 400 if any.
 */
const validate = (schema) => (req, res, next) => {
  const errors = [];

  for (const [field, fieldRules] of Object.entries(schema)) {
    const value = req.body[field];
    for (const rule of fieldRules) {
      const error = rule(value, field);
      if (error) { errors.push(error); break; } // one error per field
    }
  }

  if (errors.length) {
    return res.status(400).json({ message: errors.join('; ') });
  }
  next();
};

module.exports = { validate, rules };
