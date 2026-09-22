/**
 * airflowService.js
 *
 * Low-level wrapper around the Apache Airflow Stable REST API (v1).
 * Docs: https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html
 *
 * All functions throw on non-2xx responses so callers can catch them uniformly.
 * Auth: HTTP Basic (username / password) sent on every request via an axios
 * instance created once at module load time.
 *
 * Env vars consumed:
 *   AIRFLOW_BASE_URL   – e.g. http://localhost:8080  (no trailing slash)
 *   AIRFLOW_USERNAME   – Airflow web-server user
 *   AIRFLOW_PASSWORD   – Airflow web-server password
 *   AIRFLOW_API_TIMEOUT_MS – per-request timeout in ms (default 10000)
 */

const axios = require('axios');

/* ── singleton axios instance ───────────────────────────────────────────── */
let _client = null;

const isAirflowDisabled = () => process.env.AIRFLOW_ENABLED === 'false' || !(process.env.AIRFLOW_BASE_URL || '').trim();

const extractAirflowError = (err) => {
  const status = err.response?.status;
  const data = err.response?.data;
  const detail = data?.detail || data?.message || (typeof data === 'string' ? data : JSON.stringify(data || {}));
  const url = err.config ? `${err.config.baseURL}${err.config.url}` : 'unknown endpoint';
  const code = err.code ? ` (${err.code})` : '';
  return { status, detail, url, code };
};

const validateAirflowBaseUrl = (rawBaseUrl) => {
  if (!rawBaseUrl) {
    throw new Error('AIRFLOW_BASE_URL must be set to the Airflow webserver URL, e.g. http://localhost:8080');
  }

  let parsed;
  try {
    parsed = new URL(rawBaseUrl);
  } catch (err) {
    throw new Error('AIRFLOW_BASE_URL must be a valid URL, including scheme, e.g. http://localhost:8080');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('AIRFLOW_BASE_URL must use http or https protocol, e.g. http://localhost:8080');
  }
  if (!parsed.hostname) {
    throw new Error('AIRFLOW_BASE_URL must include a host name or IP address.');
  }

  return parsed.origin;
};

const getClient = () => {
  if (_client) return _client;

  const rawBaseUrl = (process.env.AIRFLOW_BASE_URL || '').trim().replace(/\/$/, '');
  const baseURL = validateAirflowBaseUrl(rawBaseUrl);
  const username  = (process.env.AIRFLOW_USERNAME || '').trim();
  const password  = (process.env.AIRFLOW_PASSWORD || '').trim();
  const token     = (process.env.AIRFLOW_API_TOKEN || '').trim();
  const timeout   = parseInt(process.env.AIRFLOW_API_TIMEOUT_MS || '10000', 10);

  if (!username || !password) {
    if (!token) {
      console.warn('[AirflowService] No Airflow auth configured; requests will be sent without authentication.');
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const clientConfig = {
    baseURL: `${baseURL}/api/v1`,
    timeout,
    headers,
  };

  if (username && password) {
    clientConfig.auth = { username, password };
  }

  _client = axios.create(clientConfig);

  /* Attach a response interceptor that surfaces Airflow error detail */
  _client.interceptors.response.use(
    res => res,
    err => {
      const { status, detail, url, code } = extractAirflowError(err);
      const enhanced = new Error(`Airflow API error [${status || 'N/A'}] ${url}${code}: ${detail}`);
      enhanced.status = status;
      enhanced.upstream = err;
      return Promise.reject(enhanced);
    }
  );

  return _client;
};

/* ── helpers ────────────────────────────────────────────────────────────── */

/**
 * Map Airflow DAG-run state → our internal job status.
 * Airflow states: queued | running | success | failed | deferred
 */
const mapRunState = (state = '') => {
  switch (state.toLowerCase()) {
    case 'success':  return 'success';
    case 'failed':   return 'failed';
    case 'running':  return 'running';
    case 'queued':   return 'pending';
    default:         return 'warning';   // deferred, upstream_failed, etc.
  }
};

/**
 * Map Airflow task-instance state → simplified label.
 */
const mapTaskState = (state = '') => {
  switch (state.toLowerCase()) {
    case 'success':           return 'success';
    case 'failed':
    case 'upstream_failed':   return 'failed';
    case 'running':           return 'running';
    case 'skipped':           return 'skipped';
    case 'queued':
    case 'scheduled':         return 'pending';
    case 'up_for_retry':      return 'retrying';
    default:                  return 'unknown';
  }
};

/**
 * Compute elapsed seconds between two ISO timestamps.
 * Returns null if either value is missing.
 */
const elapsedSeconds = (start, end) => {
  if (!start) return null;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.round((e - s) / 1000));
};

/* ── public API ─────────────────────────────────────────────────────────── */

/**
 * List all DAGs (paginated, default up to 200).
 * Returns array of DAG summary objects.
 */
const listDags = async ({ limit = 200, offset = 0, onlyActive = true } = {}) => {
  if (isAirflowDisabled()) return [];
  const client = getClient();
  const params = { limit, offset };
  if (onlyActive) params.only_active = true;
  const { data } = await client.get('/dags', { params });
  return data.dags || [];
};

/**
 * Test connectivity to the configured Airflow instance.
 * Returns the DAG list payload used for validation.
 */
const checkAirflowConnection = async ({ limit = 1 } = {}) => {
  if (isAirflowDisabled()) {
    return {
      healthy: false,
      disabled: true,
      message: 'Airflow sync is disabled or AIRFLOW_BASE_URL is not configured.',
      dagCount: 0,
    };
  }

  const dags = await listDags({ limit, onlyActive: false });
  return { healthy: true, message: `Airflow reachable at ${getClient().defaults.baseURL}`, dagCount: dags.length };
};

/**
 * List DAG runs for a given DAG, ordered by execution_date DESC.
 * @param {string} dagId
 * @param {object} opts
 * @param {number} opts.limit   – max runs to return (default 25)
 * @param {string} opts.state   – filter by state (optional)
 */
const listDagRuns = async (dagId, { limit = 25, state } = {}) => {
  if (isAirflowDisabled()) return [];
  const client = getClient();
  const params = { limit, order_by: '-execution_date' };
  if (state) params.state = state;
  const { data } = await client.get(`/dags/${dagId}/dagRuns`, { params });
  return data.dag_runs || [];
};

/**
 * List ALL DAG runs across all DAGs.
 * Uses the /dags/~/dagRuns endpoint (Airflow ≥ 2.1).
 */
const listAllDagRuns = async ({ limit = 100, state, orderBy = '-execution_date' } = {}) => {
  if (isAirflowDisabled()) return [];
  const client = getClient();
  const params = { limit, order_by: orderBy };
  if (state) params.state = state;
  const { data } = await client.get('/dags/~/dagRuns', { params });
  return data.dag_runs || [];
};

/**
 * Get a single DAG run by dagId + dagRunId.
 */
const getDagRun = async (dagId, dagRunId) => {
  if (isAirflowDisabled()) return null;
  const { data } = await getClient().get(`/dags/${dagId}/dagRuns/${dagRunId}`);
  return data;
};

/**
 * List task instances for a specific DAG run.
 * Returns enriched task objects including retry_number, duration, state.
 */
const listTaskInstances = async (dagId, dagRunId) => {
  if (isAirflowDisabled()) return [];
  const { data } = await getClient().get(`/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`);
  return data.task_instances || [];
};

/**
 * Get a single task instance.
 */
const getTaskInstance = async (dagId, dagRunId, taskId) => {
  const { data } = await getClient().get(`/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`);
  return data;
};

/**
 * Trigger a new DAG run.
 */
const triggerDagRun = async (dagId, { conf = {}, logicalDate } = {}) => {
  if (isAirflowDisabled()) {
    throw new Error('Airflow is disabled or not configured. Set AIRFLOW_ENABLED=true and AIRFLOW_BASE_URL to trigger DAGs.');
  }
  const body = { conf };
  if (logicalDate) body.logical_date = logicalDate;
  const { data } = await getClient().post(`/dags/${dagId}/dagRuns`, body);
  return data;
};

/**
 * Clear (retry) a DAG run — sets all failed task instances back to "none"
 * so Airflow will re-schedule them.
 */
const clearDagRun = async (dagId, dagRunId) => {
  if (isAirflowDisabled()) {
    throw new Error('Airflow is disabled or not configured. Set AIRFLOW_ENABLED=true and AIRFLOW_BASE_URL to clear DAG runs.');
  }
  const body = {
    dry_run:          false,
    dag_run_id:       dagRunId,
    reset_dag_runs:   true,
    only_failed:      true,
    include_subdags:  false,
  };
  const { data } = await getClient().post(`/dags/${dagId}/clearTaskInstances`, body);
  return data;
};

/**
 * Build a normalised "Job" document from an Airflow DAG run + its task instances.
 *
 * Returns two separate objects so the caller can decide what to always overwrite
 * ($set) vs what to write only when inserting a new document ($setOnInsert):
 *
 *   always  – live Airflow state that changes on every tick
 *   onInsert – fields that belong to the app layer (AI scores, logs, recovery);
 *              they must never be wiped by a subsequent Airflow sync tick
 *
 * Callers that only need a flat object (e.g. the in-memory store) can spread
 * both: { ...always, ...onInsert }.
 */
const normaliseDagRun = (dagRun, taskInstances = []) => {
  const state    = dagRun.state || 'queued';
  const status   = mapRunState(state);
  const duration = elapsedSeconds(dagRun.start_date, dagRun.end_date);

  /* aggregate retry count = sum of all try_number - 1 across tasks */
  const retryCount = taskInstances.reduce((sum, t) => sum + Math.max(0, (t.try_number || 1) - 1), 0);

  /* find failed tasks for failure reason */
  const failedTasks = taskInstances.filter(t => t.state === 'failed' || t.state === 'upstream_failed');
  const failureReason = failedTasks.length
    ? `Task(s) failed: ${failedTasks.map(t => t.task_id).join(', ')}`
    : null;

  /* build structured task list */
  const tasks = taskInstances.map(t => ({
    taskId:        t.task_id,
    state:         mapTaskState(t.state),
    tryNumber:     t.try_number || 1,
    duration:      t.duration != null ? Math.round(t.duration) : null,
    startDate:     t.start_date || null,
    endDate:       t.end_date   || null,
    operator:      t.operator_name || t.operator || null,
    note:          t.note || null,
  }));

  /* derive a unique stable jobId from dagId + dagRunId */
  const jobId = `${dagRun.dag_id}__${dagRun.dag_run_id}`;

  /* Fields that Airflow owns and must be kept current on every sync tick */
  const always = {
    jobId,
    jobName:         dagRun.dag_id,
    source:          'Airflow',
    destination:     'Airflow',
    dagId:           dagRun.dag_id,
    dagRunId:        dagRun.dag_run_id,
    dagState:        state,
    executionDate:   dagRun.execution_date || dagRun.logical_date || null,
    status,
    startTime:       dagRun.start_date ? new Date(dagRun.start_date) : null,
    endTime:         dagRun.end_date   ? new Date(dagRun.end_date)   : null,
    duration,
    retryCount,
    failureReason,
    tasks,
    externalTrigger: dagRun.external_trigger || false,
    runType:         dagRun.run_type || 'scheduled',
    note:            dagRun.note || null,
  };

  /* Fields that belong to the app layer — written once on insert, never
     overwritten by subsequent sync ticks so AI scores / logs / recovery
     state are not clobbered. */
  const onInsert = {
    cpuUsage:         null,
    memoryUsage:      null,
    recordsProcessed: 0,
    aiRiskScore:      0,
    predictedStatus:  null,
    logs:             [],
    recoveryActions:  [],
    anomalies:        [],
  };

  return { always, onInsert };
};

/* re-export mapRunState so sync module can use it */
module.exports = {
  listDags,
  listDagRuns,
  listAllDagRuns,
  getDagRun,
  listTaskInstances,
  getTaskInstance,
  triggerDagRun,
  clearDagRun,
  normaliseDagRun,
  mapRunState,
  mapTaskState,
  elapsedSeconds,
  checkAirflowConnection,
  getClient,
  validateAirflowBaseUrl,
};
