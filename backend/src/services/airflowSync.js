/**
 * airflowSync.js
 *
 * On a configurable interval, polls the Airflow REST API, fetches real DAG
 * runs + their task instances, normalises the data, and upserts it into
 * MongoDB (or the in-memory store when DB is not connected).
 *
 * Duplicate-prevention strategy
 * ─────────────────────────────
 * Each DAG run maps to a stable jobId = "<dagId>__<dagRunId>".  The Job model
 * has a sparse unique compound index on (dagId, dagRunId).  On every sync tick
 * we use findOneAndUpdate with:
 *
 *   $set        – live Airflow fields that change (status, duration, tasks…)
 *   $setOnInsert – app-layer fields written ONCE on first insert and never
 *                  overwritten (aiRiskScore, predictedStatus, logs, recoveryActions,
 *                  anomalies, autoRecovery, rootCauseAnalysis)
 *
 * This guarantees:
 *   • No duplicate documents — upsert on unique jobId
 *   • AI scores / logs / recovery state survive subsequent sync ticks
 *   • Running→success/failed transitions always preserved
 *
 * Env vars consumed (all optional):
 *   AIRFLOW_SYNC_INTERVAL_MS  – polling cadence in ms          (default 30000)
 *   AIRFLOW_SYNC_LIMIT        – max DAG runs fetched per poll  (default 50)
 *   AIRFLOW_ENABLED           – set to "false" to disable sync (default true)
 */

'use strict';

const { isConnected, onConnected } = require('../config/db');
const { getStore }                 = require('../data/store');
const Job                          = require('../models/Job');
const logService                   = require('../utils/logService');
const { runPrediction }            = require('../controllers/predictionController');
const { createAlert }              = require('../controllers/alertController');
const { sendJobFailureEmail, sendHighRiskEmail } = require('../utils/emailService');
const {
  listAllDagRuns,
  listTaskInstances,
  normaliseDagRun,
  checkAirflowConnection,
}                                  = require('./airflowService');

/* ── ring-buffer for Dashboard activity feed ───────────────────────── */
const recentEvents  = [];
const pushEvent = (event) => {
  recentEvents.unshift(event);
  if (recentEvents.length > 50) recentEvents.pop();
};

/* ── module-level state ──────────────────────────────────────────────── */
let syncCount  = 0;
let startedAt  = null;
let lastSyncAt = null;
let nextSyncAt = null;
let lastRunId  = null;
let syncIntervalRef = null;
let connectionRetryRef = null;

const SYNC_INTERVAL = parseInt(process.env.AIRFLOW_SYNC_INTERVAL_MS || '30000', 10);
const SYNC_LIMIT    = parseInt(process.env.AIRFLOW_SYNC_LIMIT       || '50',    10);
const ENABLED       = process.env.AIRFLOW_ENABLED !== 'false';
const CONNECTION_RETRY_INTERVAL_MS = Math.max(15000, SYNC_INTERVAL);

const useDB = () => isConnected();

/* ────────────────────────────────────────────────────────────────────
   upsertJob
   ─────────
   Persists a normalised DAG run without overwriting app-layer data.

   MongoDB path uses two-phase $set/$setOnInsert so that fields owned by
   the app (AI scores, logs, recovery) are never wiped on a re-sync of an
   existing document.

   Duplicate-key safety: concurrent sync ticks racing on the same jobId
   may both attempt an insert.  MongoDB will throw error code 11000 for
   the second one.  We catch that and fall back to a plain $set update so
   no data is lost and no crash propagates to the caller.

   Returns { doc, isNew }
────────────────────────────────────────────────────────────────────── */
const upsertJob = async (always, onInsert) => {
  const { jobId, ...setFields } = always;

  if (useDB()) {
    try {
      /* rawResult:true wraps the response as { value, lastErrorObject, ok }
         so we must NOT chain .lean() — lean() operates on the document query
         and conflicts with the raw-result wrapper.  We read updatedExisting
         from the wrapper and return the plain-object value separately. */
      const result = await Job.findOneAndUpdate(
        { jobId },
        {
          $set:         setFields,             // Airflow live data — always current
          $setOnInsert: { jobId, ...onInsert }, // app data — written once, never clobbered
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
      );

      /* result.lastErrorObject.updatedExisting is false on first insert */
      const isNew = !result?.lastErrorObject?.updatedExisting;
      /* result.value is the Mongoose document — call toObject() if defined */
      const doc = result?.value?.toObject ? result.value.toObject() : result?.value;
      return { doc, isNew };
    } catch (err) {
      /* Duplicate-key: a parallel sync tick beat us to the insert.
         Retry as a plain update — app-layer fields are already in DB. */
      if (err.code === 11000) {
        const doc = await Job.findOneAndUpdate(
          { jobId },
          { $set: setFields },
          { new: true }
        ).lean();
        return { doc, isNew: false };
      }
      throw err;
    }
  }

  /* ── in-memory store ── */
  const store = getStore();
  const idx   = store.findIndex(j => j.jobId === jobId);
  if (idx !== -1) {
    /* Merge only the always-fields; do NOT overwrite app-layer fields */
    store[idx] = { ...store[idx], ...always };
    return { doc: store[idx], isNew: false };
  }
  /* New document — include both sets */
  const doc = { jobId, ...always, ...onInsert };
  store.unshift(doc);
  return { doc, isNew: true };
};

/* ────────────────────────────────────────────────────────────────────
   getPreviousDoc
   ──────────────
   Fetches status + aiRiskScore for an existing document so we can
   decide whether a status change occurred and whether scoring is needed.
────────────────────────────────────────────────────────────────────── */
const getPreviousDoc = async (jobId) => {
  if (useDB()) {
    const doc = await Job.findOne({ jobId }).select('status aiRiskScore').lean();
    return doc ? { status: doc.status, aiRiskScore: doc.aiRiskScore ?? 0 } : null;
  }
  const j = getStore().find(j => j.jobId === jobId);
  return j ? { status: j.status, aiRiskScore: j.aiRiskScore ?? 0 } : null;
};

/* ── write log lines for a run into EtlLog + Job.logs ───────────── */
const persistRunLogs = async (jobData) => {
  const entries = (jobData.tasks || []).map(t => ({
    jobId:       jobData.jobId,
    jobName:     jobData.jobName,
    source:      jobData.source,
    destination: jobData.destination,
    status:      t.state,
    level:       t.state === 'failed' ? 'ERROR' : t.state === 'retrying' ? 'WARN' : 'INFO',
    message:     `[${jobData.dagRunId}] task=${t.taskId} state=${t.state} try=${t.tryNumber}${t.duration != null ? ` duration=${t.duration}s` : ''}`,
    timestamp:   t.endDate ? new Date(t.endDate) : new Date(),
    meta: {
      dagId:     jobData.dagId,
      dagRunId:  jobData.dagRunId,
      taskId:    t.taskId,
      operator:  t.operator,
      tryNumber: t.tryNumber,
    },
  }));
  if (entries.length) await logService.writeBulk(entries);
};

/* ── run AI risk prediction and stamp the result ───────────────────── */
/**
 * Scores a normalised Airflow job with the AI engine and writes the result
 * back to MongoDB / the in-memory store.
 *
 * Uses real Airflow-supplied values wherever available:
 *   • retryCount  — sum of task try_number - 1 (set by normaliseDagRun)
 *   • duration    — elapsed seconds (null while running → use 0 so scoring
 *                   isn't skewed by the 600s default)
 *   • cpuUsage / memoryUsage — not available from Airflow directly, left as 0
 *
 * Returns the prediction result so callers can use the scored aiRiskScore
 * in follow-on actions (e.g. failure email) without a second DB read.
 */
const stampPrediction = async (jobData) => {
  try {
    const prediction = await runPrediction({
      cpuUsage:         jobData.cpuUsage         ?? 0,
      memoryUsage:      jobData.memoryUsage       ?? 0,
      retryCount:       jobData.retryCount        ?? 0,
      /* duration is null while the run is still in progress — use 0 rather
         than the 600s fallback so we don't artificially inflate the score */
      duration:         jobData.duration          ?? 0,
      recordsProcessed: jobData.recordsProcessed  ?? 0,
      jobId:            jobData.jobId,
      jobName:          jobData.jobName,
      source:           'airflow',
    });

    const updates = {
      aiRiskScore:     prediction.riskScore,
      predictedStatus: prediction.predictedStatus,
      recoveryActions: prediction.recoveryActions,
      anomalies:       prediction.anomalies,
    };

    if (useDB()) {
      await Job.findOneAndUpdate({ jobId: jobData.jobId }, { $set: updates });
    } else {
      const liveJob = getStore().find(j => j.jobId === jobData.jobId);
      if (liveJob) Object.assign(liveJob, updates);
    }

    /* Activity-feed event for every scored job (not just high-risk) so the
       Dashboard shows AI analysis results as they arrive */
    pushEvent({
      id:    `${jobData.jobId}-prediction`,
      type:  'prediction',
      jobId: jobData.jobId,
      msg:   `AI scored ${jobData.dagId} run "${jobData.dagRunId}" → risk ${prediction.riskScore} (${prediction.predictedStatus})`,
      time:  new Date().toISOString(),
    });

    /* High-risk email */
    const threshold = parseInt(process.env.EMAIL_RISK_THRESHOLD || '70', 10);
    if (prediction.riskScore >= threshold) {
      sendHighRiskEmail({
        jobId:           jobData.jobId,
        jobName:         jobData.jobName,
        source:          jobData.source,
        destination:     jobData.destination,
        aiRiskScore:     prediction.riskScore,
        predictedStatus: prediction.predictedStatus,
        cpuUsage:        jobData.cpuUsage    ?? 0,
        memoryUsage:     jobData.memoryUsage ?? 0,
      });
    }

    return prediction;
  } catch (err) {
    console.error(`[AirflowSync] prediction error for ${jobData.jobId}:`, err.message);
    return null;
  }
};

/* ────────────────────────────────────────────────────────────────────
   processRun
   ──────────
   Handles a single DAG run from the Airflow poll response.
   Returns 'new' | 'updated' | 'unchanged' for tick-level summary logging.
────────────────────────────────────────────────────────────────────── */
const processRun = async (dagRun) => {
  const { dag_id, dag_run_id } = dagRun;

  /* Fetch task instances for this run */
  let taskInstances = [];
  try {
    taskInstances = await listTaskInstances(dag_id, dag_run_id);
  } catch (err) {
    console.warn(`[AirflowSync] Could not fetch tasks for ${dag_id}/${dag_run_id}: ${err.message}`);
  }

  const { always, onInsert } = normaliseDagRun(dagRun, taskInstances);

  /* Check existing document BEFORE upserting so we know whether this is
     a new run and whether the status has changed */
  const prev          = await getPreviousDoc(always.jobId);
  const isNew         = prev === null;
  const statusChanged = !isNew && prev.status !== always.status;
  /* Score on first ingest or whenever the run reaches a terminal/changed state */
  const needsPrediction = isNew ||
    (statusChanged && ['success', 'failed', 'warning'].includes(always.status));

  /* Upsert — $set only the Airflow-owned fields */
  await upsertJob(always, onInsert);

  /* Persist task-level logs only on first ingest or status transitions */
  if (isNew || statusChanged) {
    await persistRunLogs({ ...always, ...onInsert });
  }

  /* AI prediction — run first so the scored aiRiskScore is available for
     the failure email that follows */
  let scored = null;
  if (needsPrediction) {
    /* Pass the merged object so stampPrediction has all Airflow fields */
    scored = await stampPrediction({ ...always, ...onInsert });
  }

  /* Failure email / alert — on transition to failed, or on a newly discovered
     failed run after the first poll tick. This avoids duplicate startup noise
     while still alerting on live failures. */
  const notifyOnFailedRun = statusChanged && always.status === 'failed';
  const notifyOnNewFailedRun = isNew && always.status === 'failed' && syncCount > 0;

  if (notifyOnFailedRun || notifyOnNewFailedRun) {
    await createAlert({
      jobId:     always.jobId,
      jobName:   always.jobName,
      type:      'failure',
      message:   `Airflow DAG run ${always.dagId}/${always.dagRunId} failed${always.failureReason ? `: ${always.failureReason}` : ''}`,
      severity:  'critical',
      emailSent: true,
    });

    sendJobFailureEmail({
      jobId:         always.jobId,
      jobName:       always.jobName,
      source:        'Airflow',
      destination:   dag_id,
      failureReason: always.failureReason,
      retryCount:    always.retryCount,
      cpuUsage:      always.cpuUsage    ?? 0,
      memoryUsage:   always.memoryUsage ?? 0,
      aiRiskScore:   scored?.riskScore ?? prev?.aiRiskScore ?? 0,
    });
  }

  /* Activity-feed events */
  if (isNew) {
    pushEvent({
      id:    `${always.jobId}-created`,
      type:  always.status,
      jobId: always.jobId,
      msg:   `DAG "${dag_id}" run "${dag_run_id}" ingested — state=${dagRun.state}`,
      time:  new Date().toISOString(),
    });
    lastRunId = always.jobId;
  } else if (statusChanged) {
    pushEvent({
      id:    `${always.jobId}-update`,
      type:  always.status,
      jobId: always.jobId,
      msg:   `DAG "${dag_id}" run "${dag_run_id}" ${prev.status} → ${always.status}`,
      time:  new Date().toISOString(),
    });
  }

  return isNew ? 'new' : statusChanged ? 'updated' : 'unchanged';
};

/* ── main sync tick ─────────────────────────────────────────────────── */
const syncTick = async () => {
  try {
    console.log(`[AirflowSync] tick #${syncCount + 1} — fetching up to ${SYNC_LIMIT} DAG runs`);

    const dagRuns = await listAllDagRuns({ limit: SYNC_LIMIT });

    if (!dagRuns.length) {
      console.log('[AirflowSync] No DAG runs returned — Airflow may have no runs yet');
    }

    /* Process all runs in parallel (cap concurrency at 10) */
    const CONCURRENCY = 10;
    const outcomes = { new: 0, updated: 0, unchanged: 0 };

    for (let i = 0; i < dagRuns.length; i += CONCURRENCY) {
      const slice   = dagRuns.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(run =>
          processRun(run).catch(err => {
            console.error(`[AirflowSync] processRun error for ${run.dag_id}/${run.dag_run_id}:`, err.message);
            return 'unchanged';
          })
        )
      );
      results.forEach(r => { outcomes[r] = (outcomes[r] || 0) + 1; });
    }

    syncCount++;
    lastSyncAt = new Date();
    nextSyncAt = new Date(Date.now() + SYNC_INTERVAL);

    console.log(
      `[AirflowSync] tick #${syncCount} complete — ` +
      `${dagRuns.length} run(s): ${outcomes.new} new, ${outcomes.updated} updated, ${outcomes.unchanged} unchanged`
    );
  } catch (err) {
    console.error('[AirflowSync] tick error:', err.message);
    pushEvent({
      id:    `airflow-error-${Date.now()}`,
      type:  'warning',
      jobId: null,
      msg:   `Airflow sync failed: ${err.message}`,
      time:  new Date().toISOString(),
    });
  }
};

/* ────────────────────────────────────────────────────────────────────
   migrateStoreToMongo
   ───────────────────
   If sync was running before MongoDB connected (e.g. DB was slow to
   start), Airflow jobs may already be in the in-memory store.  This
   function upserts all of them into MongoDB so no data is lost.
   It is called once via the onConnected hook registered in startSync.
────────────────────────────────────────────────────────────────────── */
const migrateStoreToMongo = async () => {
  const airflowJobs = getStore().filter(j => j.dagId && j.dagRunId);
  if (!airflowJobs.length) return;

  console.log(`[AirflowSync] Migrating ${airflowJobs.length} in-memory Airflow job(s) to MongoDB…`);
  let migrated = 0;

  for (const job of airflowJobs) {
    try {
      const { jobId, cpuUsage, memoryUsage, recordsProcessed,
              aiRiskScore, predictedStatus, logs,
              recoveryActions, anomalies, ...setFields } = job;

      await Job.findOneAndUpdate(
        { jobId },
        {
          $set:         setFields,
          $setOnInsert: {
            jobId,
            cpuUsage:         cpuUsage         ?? null,
            memoryUsage:      memoryUsage       ?? null,
            recordsProcessed: recordsProcessed  ?? 0,
            aiRiskScore:      aiRiskScore        ?? 0,
            predictedStatus:  predictedStatus    ?? null,
            logs:             logs               ?? [],
            recoveryActions:  recoveryActions    ?? [],
            anomalies:        anomalies          ?? [],
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      migrated++;
    } catch (err) {
      if (err.code !== 11000) {
        console.warn(`[AirflowSync] Migration skipped for ${job.jobId}: ${err.message}`);
      }
    }
  }

  console.log(`[AirflowSync] Migration complete — ${migrated}/${airflowJobs.length} job(s) persisted to MongoDB`);
};

/* ── public API ──────────────────────────────────────────────────────── */

const startSync = () => {
  if (!ENABLED) {
    console.log('[AirflowSync] Disabled via AIRFLOW_ENABLED=false');
    return;
  }

  /* Ensure the unique sparse index on (dagId, dagRunId) exists in MongoDB.
     syncIndexes() is a no-op when the index is already current. */
  Job.syncIndexes().catch(err =>
    console.warn('[AirflowSync] syncIndexes warning:', err.message)
  );

  /* If DB connects after the sync loop has already started (late connection),
     migrate any Airflow jobs already buffered in the in-memory store. */
  onConnected(migrateStoreToMongo);

  const startPolling = () => {
    if (syncIntervalRef) return; // already started
    startedAt  = new Date();
    nextSyncAt = new Date(Date.now() + SYNC_INTERVAL);
    console.log(`[AirflowSync] Started — polling Airflow every ${SYNC_INTERVAL / 1000}s`);
    syncTick();                              // fire immediately on start
    syncIntervalRef = setInterval(syncTick, SYNC_INTERVAL);
  };

  const retryConnection = async () => {
    try {
      const result = await checkAirflowConnection();
      console.log('[AirflowSync] Airflow connection validated:', result.message);
      startPolling();
      if (connectionRetryRef) {
        clearInterval(connectionRetryRef);
        connectionRetryRef = null;
      }
    } catch (err) {
      console.error('[AirflowSync] Airflow connectivity validation failed:', err.message);
      pushEvent({
        id:    `airflow-connection-failure-${Date.now()}`,
        type:  'warning',
        jobId: null,
        msg:   `Airflow connection failed: ${err.message}`,
        time:  new Date().toISOString(),
      });
      if (!connectionRetryRef) {
        console.log(`[AirflowSync] Airflow unavailable; backend remains online. Retrying connection every ${CONNECTION_RETRY_INTERVAL_MS / 1000}s.`);
        connectionRetryRef = setInterval(retryConnection, CONNECTION_RETRY_INTERVAL_MS);
      }
    }
  };

  retryConnection();
};

const getRecentEvents = () => [...recentEvents];

/** Status object polled by the /api/airflow/status endpoint */
const getSyncStatus = () => ({
  running:     startedAt !== null,
  enabled:     ENABLED,
  syncCount,
  intervalMs:  SYNC_INTERVAL,
  syncLimit:   SYNC_LIMIT,
  startedAt:   startedAt?.toISOString()  ?? null,
  lastSyncAt:  lastSyncAt?.toISOString() ?? null,
  nextSyncAt:  nextSyncAt?.toISOString() ?? null,
  lastRunId,
  recentCount: recentEvents.length,
});

module.exports = { startSync, getRecentEvents, getSyncStatus };
