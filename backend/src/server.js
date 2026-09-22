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
  if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigin = process.env.FRONTEND_URL || '*';
app.use(cors({
  origin: PROD ? allowedOrigin : '*',
  credentials: true,
}));

// ── Body parsing — cap at 50 kb to block oversized payload attacks ─────────
app.use(express.json({ limit: '50kb' }));

// ── NoSQL injection sanitizer — runs before every route ───────────────────
app.use(sanitize);

// ── Rate limiting ─────────────────────────────────────────────────────────
// Strict limit on auth endpoint to slow brute-force attacks
app.use('/api/auth', rateLimiter({ max: 10, windowMs: 60_000, message: 'Too many login attempts, please wait a minute.' }));
// General API limit — generous enough for polling dashboards
app.use('/api',      rateLimiter({ max: 200, windowMs: 60_000 }));

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

// ── Serve frontend static build in production ─────────────────────────────
if (PROD) {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

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
app.listen(PORT, () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`));
