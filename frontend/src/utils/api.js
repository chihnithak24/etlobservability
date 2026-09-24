import axios from 'axios';

// Base API URL configuration:
// - Relative '/api' works out of the box when frontend is served by Express or reverse-proxy
// - External backend URL can be set via VITE_API_URL (e.g. https://etlobservability-2.onrender.com/api)
// - In production, accidental localhost/127.0.0.1 URLs are stripped automatically
let rawBaseURL = import.meta.env.VITE_API_URL || '/api';

if (typeof rawBaseURL === 'string') {
  rawBaseURL = rawBaseURL.trim().replace(/\/+$/, '');

  // Strip localhost / port 5000 from production bundles
  if (import.meta.env.PROD && (
    rawBaseURL.includes('localhost') ||
    rawBaseURL.includes('127.0.0.1') ||
    rawBaseURL.includes('0.0.0.0') ||
    rawBaseURL.includes(':5000')
  )) {
    console.warn('[API] Production environment detected localhost backend address. Falling back to same-origin /api.');
    rawBaseURL = '/api';
  }

  // If an absolute URL is supplied without /api, ensure /api suffix is appended
  if (rawBaseURL.startsWith('http://') || rawBaseURL.startsWith('https://')) {
    if (!rawBaseURL.endsWith('/api')) {
      rawBaseURL = `${rawBaseURL}/api`;
    }
  }
}

if (!rawBaseURL) {
  rawBaseURL = '/api';
}

const api = axios.create({
  baseURL: rawBaseURL,
  timeout: 20000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      if (!window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login?reason=session_expired';
      }
    }
    return Promise.reject(err);
  }
);

/* ── Airflow convenience helpers ─────────────────────────────────── */
export const airflow = {
  /** List all active DAGs */
  getDags: (params = {}) => api.get('/airflow/dags', { params }),

  /** List DAG runs for a specific DAG */
  getDagRuns: (dagId, params = {}) => api.get(`/airflow/dags/${encodeURIComponent(dagId)}/runs`, { params }),

  /** Full detail (run + tasks) for a single DAG run */
  getDagRunDetail: (dagId, dagRunId) =>
    api.get(`/airflow/dags/${encodeURIComponent(dagId)}/runs/${encodeURIComponent(dagRunId)}`),

  /** Task instances for a DAG run */
  getTaskInstances: (dagId, dagRunId) =>
    api.get(`/airflow/dags/${encodeURIComponent(dagId)}/runs/${encodeURIComponent(dagRunId)}/tasks`),

  /** All recent DAG runs (normalised job documents) */
  getAllRuns: (params = {}) => api.get('/airflow/runs', { params }),

  /** Activity-feed ring-buffer */
  getEvents: () => api.get('/airflow/events'),

  /** Sync poller status */
  getSyncStatus: () => api.get('/airflow/status'),

  /** Check Airflow connectivity and credentials */
  ping: () => api.get('/airflow/ping'),

  /** Airflow-specific analytics (DAG breakdown, status counts, 7-day trend, sync status) */
  getAnalytics: () => api.get('/airflow/analytics'),

  /** Trigger a new DAG run */
  triggerRun: (dagId, body = {}) =>
    api.post(`/airflow/dags/${encodeURIComponent(dagId)}/trigger`, body),

  /** Clear (retry) a DAG run */
  clearRun: (dagId, dagRunId) =>
    api.post(`/airflow/dags/${encodeURIComponent(dagId)}/runs/${encodeURIComponent(dagRunId)}/clear`),
};

/* ── Live Telemetry & Simulator convenience helpers ──────────────── */
export const monitoring = {
  /** Real-time live monitoring telemetry endpoint */
  getLive: () => api.get('/monitoring/live'),

  /** Simulator status */
  getSimulatorStatus: () => api.get('/monitoring/simulator/status'),

  /** Spawn simulated test job */
  spawnSimulatedJob: (forceFailure = false) => api.post('/monitoring/simulator/spawn', { forceFailure }),
};

export default api;
