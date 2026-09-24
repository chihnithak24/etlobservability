require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const { connectDB }       = require('./config/db');
const { seedDB }          = require('./data/seedData');
const { startSync } = require('./services/airflowSync');
const { startSimulator } = require('./services/simulatorService');
const sanitize     = require('./middleware/sanitize');
const { rateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app  = express();
const PROD = process.env.NODE_ENV === 'production';

// ── Security headers ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Only send HSTS over real HTTPS connections and never on localhost/127.0.0.1
  const host = (req.headers.host || '').toLowerCase();
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (PROD && isSecure && !isLocal) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(u => u.trim().replace(/\/+$/, '')).filter(Boolean)
  : (PROD ? [] : ['http://localhost:3000', 'http://localhost:5173']);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser, same-origin, or server-to-server requests (no Origin header)
    if (!origin) return callback(null, true);

    const normOrigin = origin.trim().replace(/\/+$/, '');

    // Development mode or wildcard allows all origins
    if (!PROD || allowedOrigins.includes('*')) {
      return callback(null, normOrigin);
    }

    // Check if matching any configured allowed origins (case-insensitive)
    const isAllowed = allowedOrigins.some(allowed => allowed.toLowerCase() === normOrigin.toLowerCase());
    if (isAllowed) {
      return callback(null, normOrigin);
    }

    // If FRONTEND_URL is not set in production, allow requests and log warning so deployment is not broken out-of-the-box
    if (!process.env.FRONTEND_URL || allowedOrigins.length === 0) {
      return callback(null, normOrigin);
    }

    console.warn(`[CORS] Request blocked from origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── Body parsing — cap at 50 kb to block oversized payload attacks ─────────
app.use(express.json({ limit: '50kb' }));

// ── NoSQL injection sanitizer — runs before every route ───────────────────
app.use(sanitize);

// ── Rate limiting ─────────────────────────────────────────────────────────
// Generous limit on auth endpoint to allow quick sign-in / registration attempts
app.use('/api/auth', rateLimiter({ max: 60, windowMs: 60_000, message: 'Too many authentication attempts, please try again in a minute.' }));
// General API limit — generous enough for rapid polling dashboards
app.use('/api',      rateLimiter({ max: 500, windowMs: 60_000 }));

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/jobs',       require('./routes/jobs'));
app.use('/api/logs',       require('./routes/logs'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/alerts',     require('./routes/alerts'));
app.use('/api/predict',    require('./routes/predict'));
app.use('/api/rca',        require('./routes/rca'));
app.use('/api/recovery',   require('./routes/recovery'));
app.use('/api/airflow',    require('./routes/airflow'));
app.use('/api/monitoring', require('./routes/monitoring'));

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  mode: process.env.ETL_MONITOR_MODE || 'simulator',
  timestamp: new Date()
}));

// ── Dedicated JSON 404 for unmatched API routes ───────────────────────────
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.path}` });
});

const fs = require('fs');

// ── Serve frontend static build with guaranteed SPA fallback ───────────────
const candidateDistDirs = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../dist'),
  path.resolve(process.cwd(), 'public'),
  path.resolve(process.cwd(), 'dist'),
];

const getDistPath = () => {
  for (const candidate of candidateDistDirs) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
};

// Mount static asset directories
const mountedStatic = new Set();
candidateDistDirs.forEach(dir => {
  if (fs.existsSync(dir) && !mountedStatic.has(dir)) {
    mountedStatic.add(dir);
    console.log('[Server] Serving static frontend build from:', dir);
    app.use(express.static(dir, { index: false, maxAge: '1h' }));
  }
});

// Dynamic static resolver — serves any static asset that exists
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const dist = getDistPath();
  if (dist) {
    const assetPath = path.join(dist, req.path);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return res.sendFile(assetPath);
    }
  }
  next();
});

// SPA catch-all route — serves index.html for ALL React client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  const dist = getDistPath();
  if (dist) {
    const indexPath = path.join(dist, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    }
  }

  // Graceful fallback if static build is pending or not yet generated
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ETL Observability System</title>
  <meta http-equiv="refresh" content="2">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #131b2e; border: 1px solid #1e293b; padding: 32px; border-radius: 12px; text-align: center; max-width: 440px; box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
    h2 { margin: 0 0 12px; color: #38bdf8; font-size: 20px; }
    p { margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h2>ETL Observability System</h2>
    <p>Loading application resources. Refreshing automatically in a moment...</p>
  </div>
</body>
</html>`);
});

// ── Centralised error handler — must be last ──────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────
connectDB()
  .then(async () => {
    if (process.env.SEED_DB === 'true') {
      await seedDB();
    }
    const mode = (process.env.ETL_MONITOR_MODE || 'simulator').toLowerCase();
    if (mode === 'airflow' || process.env.AIRFLOW_ENABLED === 'true') {
      console.log('[Server] Starting Airflow Integration Sync service...');
      startSync();
    }
    if (mode === 'simulator' || process.env.AIRFLOW_ENABLED !== 'true') {
      console.log('[Server] Starting ETL Simulator Engine...');
      startSimulator();
    }
  })
  .catch(err => {
    console.error('[Server] Startup error:', err.message);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
