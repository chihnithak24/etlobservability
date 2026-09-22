/**
 * airflowController.js
 *
 * Proxy endpoints that let the frontend query the Airflow REST API
 * (or our normalised view of it) without exposing Airflow credentials
 * to the browser.
 *
 * Routes exposed:
 *   GET  /api/airflow/dags                              – list all DAGs
 *   GET  /api/airflow/dags/:dagId/runs                  – list runs for a DAG
 *   GET  /api/airflow/dags/:dagId/runs/:dagRunId        – single run detail
 *   GET  /api/airflow/dags/:dagId/runs/:dagRunId/tasks  – task instances for a run
 *   POST /api/airflow/dags/:dagId/trigger               – trigger a new run
 *   POST /api/airflow/dags/:dagId/runs/:dagRunId/clear  – clear (retry) a run
 *   GET  /api/airflow/runs                              – all recent DAG runs (normalised)
 *   GET  /api/airflow/events                            – activity-feed ring-buffer
 *   GET  /api/airflow/status                            – sync poller status
 */

'use strict';

const {
  listDags,
  listDagRuns,
  listAllDagRuns,
  getDagRun,
  listTaskInstances,
  triggerDagRun,
  clearDagRun,
  normaliseDagRun,
}                         = require('../services/airflowService');
const { getRecentEvents, getSyncStatus } = require('../services/airflowSync');

/* ── small helper ───────────────────────────────────────────────── */
const wrap = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || (err.upstream?.code === 'ECONNREFUSED' ? 503 : 502);
    res.status(status).json({ message: err.message });
  }
};

/* ── GET /api/airflow/dags ───────────────────────────────────────── */
const getDags = wrap(async (req, res) => {
  const { limit = 200, offset = 0, only_active } = req.query;
  const dags = await listDags({
    limit:      parseInt(limit,  10),
    offset:     parseInt(offset, 10),
    onlyActive: only_active !== 'false',
  });
  res.json({ dags, total: dags.length });
});

/* ── GET /api/airflow/ping ───────────────────────────────────────── */
const pingAirflow = wrap(async (_req, res) => {
  const { checkAirflowConnection } = require('../services/airflowService');
  const result = await checkAirflowConnection();
  res.json(result);
});

/* ── GET /api/airflow/dags/:dagId/runs ──────────────────────────── */
const getDagRuns = wrap(async (req, res) => {
  const { dagId } = req.params;
  const { limit = 25, state } = req.query;
  const runs = await listDagRuns(dagId, {
    limit: parseInt(limit, 10),
    state: state || undefined,
  });
  res.json({ dag_runs: runs, total: runs.length });
});

/* ── GET /api/airflow/dags/:dagId/runs/:dagRunId ────────────────── */
const getDagRunDetail = wrap(async (req, res) => {
  const { dagId, dagRunId } = req.params;
  const [run, tasks] = await Promise.all([
    getDagRun(dagId, dagRunId),
    listTaskInstances(dagId, dagRunId),
  ]);
  const { always, onInsert } = normaliseDagRun(run, tasks);
  const normalised = { ...always, ...onInsert };
  res.json({ raw: run, tasks, normalised });
});

/* ── GET /api/airflow/dags/:dagId/runs/:dagRunId/tasks ──────────── */
const getTaskInstances = wrap(async (req, res) => {
  const { dagId, dagRunId } = req.params;
  const tasks = await listTaskInstances(dagId, dagRunId);
  res.json({ task_instances: tasks, total: tasks.length });
});

/* ── POST /api/airflow/dags/:dagId/trigger ──────────────────────── */
const triggerRun = wrap(async (req, res) => {
  const { dagId } = req.params;
  const { conf, logicalDate } = req.body || {};
  try {
    const run = await triggerDagRun(dagId, { conf: conf || {}, logicalDate });
    res.status(201).json(run);
  } catch (err) {
    const { spawnJob } = require('../services/simulatorService');
    const job = await spawnJob(false);
    res.status(201).json({
      dag_id: dagId,
      dag_run_id: job.dagRunId,
      execution_date: new Date().toISOString(),
      state: 'running',
      simulated: true,
      job,
    });
  }
});

/* ── POST /api/airflow/dags/:dagId/runs/:dagRunId/clear ─────────── */
const clearRun = wrap(async (req, res) => {
  const { dagId, dagRunId } = req.params;
  try {
    const result = await clearDagRun(dagId, dagRunId);
    res.json({ message: 'DAG run cleared successfully', result });
  } catch (err) {
    res.json({ message: 'DAG run cleared (simulator mode)', result: { dagId, dagRunId, status: 'running' } });
  }
});

/* ── GET /api/airflow/runs  (all recent, normalised) ─────────────── */
const getAllRuns = wrap(async (req, res) => {
  const { limit = 100, state, order_by = '-execution_date' } = req.query;
  const dagRuns = await listAllDagRuns({
    limit:   parseInt(limit, 10),
    state:   state || undefined,
    orderBy: order_by,
  });

  /* Fetch task instances for each run in parallel */
  const CONCURRENCY = 8;
  const normalised  = [];
  for (let i = 0; i < dagRuns.length; i += CONCURRENCY) {
    const slice   = dagRuns.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async run => {
        let tasks = [];
        try { tasks = await listTaskInstances(run.dag_id, run.dag_run_id); } catch (_) {}
        const { always, onInsert } = normaliseDagRun(run, tasks);
        return { ...always, ...onInsert };
      })
    );
    normalised.push(...results);
  }

  res.json({ runs: normalised, total: normalised.length });
});

/* ── GET /api/airflow/events ─────────────────────────────────────── */
const getEvents = (_req, res) => res.json(getRecentEvents());

/* ── GET /api/airflow/status ─────────────────────────────────────── */
const getSyncStatusHandler = (_req, res) => res.json(getSyncStatus());

/* ── GET /api/airflow/analytics ──────────────────────────────────── */
/**
 * Returns Airflow-specific analytics aggregated from the Job collection
 * (all jobs where source === 'Airflow') plus the live sync-poller status.
 * Used by the Analytics page and Dashboard to show real Airflow data.
 */
const getAirflowAnalytics = wrap(async (_req, res) => {
  const { isConnected } = require('../config/db');
  const { getStore }    = require('../data/store');
  const Job             = require('../models/Job');
  const sync            = getSyncStatus();

  let stats;

  if (isConnected()) {
    /* ── MongoDB path ── */
    const AIRFLOW_MATCH = { source: 'Airflow' };

    const [statusAgg, dagAgg, retryAgg, trendRaw] = await Promise.all([
      /* status breakdown */
      Job.aggregate([
        { $match: AIRFLOW_MATCH },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      /* top DAGs by run count */
      Job.aggregate([
        { $match: { ...AIRFLOW_MATCH, dagId: { $exists: true, $ne: null } } },
        { $group: { _id: '$dagId', count: { $sum: 1 }, lastStatus: { $last: '$status' }, avgRetries: { $avg: '$retryCount' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, dagId: '$_id', count: 1, lastStatus: 1, avgRetries: { $round: ['$avgRetries', 1] } } },
      ]),
      /* total retries on Airflow jobs */
      Job.aggregate([
        { $match: AIRFLOW_MATCH },
        { $group: { _id: null, total: { $sum: '$retryCount' }, max: { $max: '$retryCount' } } },
      ]),
      /* 7-day trend for Airflow jobs only */
      Job.aggregate([
        {
          $match: {
            ...AIRFLOW_MATCH,
            startTime: { $gte: (() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; })() },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$startTime', timezone: 'UTC' },
            },
            success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failed:  { $sum: { $cond: [{ $eq: ['$status', 'failed']  }, 1, 0] } },
            running: { $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const counts = { running: 0, success: 0, failed: 0, warning: 0, pending: 0 };
    statusAgg.forEach(({ _id, count }) => { if (_id in counts) counts[_id] = count; });
    const total = Object.values(counts).reduce((s, v) => s + v, 0);

    /* build full 7-day trend (fill missing days with zeros) */
    const trendMap = {};
    trendRaw.forEach(r => { trendMap[r._id] = r; });
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trend.push({ date: label, ...(trendMap[key] || { success: 0, failed: 0, running: 0 }) });
    }

    stats = {
      total,
      ...counts,
      topDags:      dagAgg,
      totalRetries: retryAgg[0]?.total ?? 0,
      maxRetries:   retryAgg[0]?.max   ?? 0,
      trend,
    };
  } else {
    /* ── in-memory fallback ── */
    const jobs = getStore().filter(j => j.source === 'Airflow');
    const total   = jobs.length;
    const running = jobs.filter(j => j.status === 'running').length;
    const success = jobs.filter(j => j.status === 'success').length;
    const failed  = jobs.filter(j => j.status === 'failed' ).length;
    const warning = jobs.filter(j => j.status === 'warning').length;
    const pending = jobs.filter(j => j.status === 'pending').length;

    const dagMap = {};
    jobs.forEach(j => {
      if (!j.dagId) return;
      if (!dagMap[j.dagId]) dagMap[j.dagId] = { dagId: j.dagId, count: 0, lastStatus: j.status, retrySum: 0 };
      dagMap[j.dagId].count++;
      dagMap[j.dagId].lastStatus = j.status;
      dagMap[j.dagId].retrySum  += (j.retryCount || 0);
    });
    const topDags = Object.values(dagMap)
      .sort((a, b) => b.count - a.count).slice(0, 10)
      .map(({ dagId, count, lastStatus, retrySum }) => ({
        dagId, count, lastStatus,
        avgRetries: Number((retrySum / count).toFixed(1)),
      }));

    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayJobs = jobs.filter(j => new Date(j.startTime).toDateString() === d.toDateString());
      trend.push({
        date:    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        success: dayJobs.filter(j => j.status === 'success').length,
        failed:  dayJobs.filter(j => j.status === 'failed' ).length,
        running: dayJobs.filter(j => j.status === 'running').length,
      });
    }

    stats = {
      total, running, success, failed, warning, pending,
      topDags,
      totalRetries: jobs.reduce((s, j) => s + (j.retryCount || 0), 0),
      maxRetries:   jobs.reduce((m, j) => Math.max(m, j.retryCount || 0), 0),
      trend,
    };
  }

  res.json({ ...stats, sync });
});

module.exports = {
  getDags,
  getDagRuns,
  getDagRunDetail,
  getTaskInstances,
  triggerRun,
  clearRun,
  getAllRuns,
  getEvents,
  getSyncStatusHandler,
  getAirflowAnalytics,
  pingAirflow,
};
