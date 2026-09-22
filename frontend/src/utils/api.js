import axios from 'axios';

// In development Vite proxies /api → localhost:5000 so baseURL stays '/api'.
// In production VITE_API_URL is set to the Render backend URL at build time,
// e.g. https://etl-predict-api.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
