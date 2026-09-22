/**
 * errorHandler.js
 * Centralised Express error-handling middleware (4-argument signature).
 * Must be registered LAST in server.js — after all routes.
 *
 * - In development: includes stack trace in the response for easier debugging.
 * - In production:  returns only a safe message; stack is logged server-side only.
 * - Mongoose ValidationError and duplicate-key errors are mapped to 400.
 * - JWT errors are mapped to 401.
 * - Everything else defaults to 500.
 */

const PROD = process.env.NODE_ENV === 'production';

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Always log the full error server-side
  console.error(`[Error] ${req.method} ${req.path} —`, err.message);
  if (!PROD) console.error(err.stack);

  // Determine HTTP status
  let status = err.status || err.statusCode || 500;

  if (err.name === 'ValidationError')          status = 400;
  if (err.code === 11000)                      status = 400;
  if (err.name === 'TokenExpiredError')        status = 401;
  if (err.name === 'JsonWebTokenError')        status = 401;
  if (err.name === 'CastError')                status = 400;

  // Build safe message
  let message = 'An unexpected error occurred';

  if (status < 500) {
    // Client errors — safe to surface the message
    if (err.name === 'ValidationError') {
      message = Object.values(err.errors || {}).map(e => e.message).join('; ') || err.message;
    } else if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'field';
      message = `Duplicate value for ${field}`;
    } else {
      message = err.message || message;
    }
  } else if (!PROD) {
    // 5xx in development — show the real message
    message = err.message;
  }

  const body = { message };
  if (!PROD && err.stack) body.stack = err.stack;

  res.status(status).json(body);
};

module.exports = errorHandler;
