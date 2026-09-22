/**
 * recoveryController.js
 * ──────────────────────────────────────────────────────────────────────────
 * AI Auto-Recovery engine for failed ETL jobs.
 *
 * Flow:
 *   1. A failed job triggers triggerAutoRecovery() from the API endpoint.
 *   2. Up to MAX_ATTEMPTS retries are scheduled with exponential back-off.
 *   3. Each attempt is recorded in job.autoRecovery.history[].
 *   4. On success the job status becomes "success" and autoRecovery.status = "recovered".
 *   5. After MAX_ATTEMPTS all fail → autoRecovery.status = "max_retries_reached".
 *
 * Routes exposed:
 *   GET  /api/recovery/:jobId          — get recovery state for one job
 *   POST /api/recovery/:jobId/trigger  — manually kick off recovery
 *   GET  /api/recovery/stats           — fleet-wide recovery summary
 */

const { isConnected } = require('../config/db');
const { getStore }    = require('../data/store');
const logService      = require('../utils/logService');

let Job = null;
const getJobModel = () => { if (!Job) Job = require('../models/Job'); return Job; };

/* ── constants ──────────────────────────────────────────────────────────── */
const MAX_ATTEMPTS      = 3;
const BASE_DELAY_MS     = 4000;   // 4 s base delay; doubles each retry (4s, 8s, 16s)
const SUCCESS_CHANCE    = 0.55;   // 55 % chance each retry succeeds

/* ── helpers ────────────────────────────────────────────────────────────── */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Load a job from MongoDB or in-memory store */
async function loadJob(jobId) {
  if (isConnected()) return getJobModel().findOne({ jobId });
  return getStore().find(j => j.jobId === jobId) || null;
}

/** Persist recovery state changes */
async function saveRecovery(jobId, patch) {
  if (isConnected()) {
    await getJobModel().findOneAndUpdate({ jobId }, { $set: patch });
  } else {
    const job = getStore().find(j => j.jobId === jobId);
    if (job) {
      if (!job.autoRecovery) job.autoRecovery = {};
      // Apply dot-notation keys to nested objects
      for (const [k, v] of Object.entries(patch)) {
        if (k.startsWith('autoRecovery.')) {
          const field = k.slice('autoRecovery.'.length);
          job.autoRecovery[field] = v;
        } else {
          job[k] = v;
        }
      }
    }
  }
}

/** Append a new history entry */
async function pushHistoryEntry(jobId, entry) {
  if (isConnected()) {
    await getJobModel().findOneAndUpdate(
      { jobId },
      { $push: { 'autoRecovery.history': entry } }
    );
  } else {
    const job = getStore().find(j => j.jobId === jobId);
    if (job) {
      if (!job.autoRecovery) job.autoRecovery = { history: [] };
      if (!job.autoRecovery.history) job.autoRecovery.history = [];
      job.autoRecovery.history.push(entry);
    }
  }
}

/* ── core recovery engine ───────────────────────────────────────────────── */
/**
 * Executes a single retry attempt, waits for simulated outcome, then either
 * schedules the next attempt or finalises the recovery.
 */
async function runAttempt(jobId, jobName, source, destination, attemptNo) {
  const attemptStartedAt = new Date();

  // Mark job as "running" and record this attempt start
  await saveRecovery(jobId, {
    status:       'running',
    'autoRecovery.status':        'recovering',
    'autoRecovery.totalAttempts': attemptNo,
    'autoRecovery.lastAttemptAt': attemptStartedAt,
  });

  // Write attempt-start history entry
  await pushHistoryEntry(jobId, {
    attempt:   attemptNo,
    startedAt: attemptStartedAt,
    outcome:   'running',
    message:   `Auto-recovery attempt #${attemptNo} started`,
  });

  // Log to EtlLog + Job.logs
  await logService.write({
    jobId, jobName, source, destination, status: 'running', level: 'INFO',
    message: `[AutoRecovery] Attempt #${attemptNo}/${MAX_ATTEMPTS} started`,
    meta: { event: 'auto_recovery_attempt', attemptNo },
  });

  console.log(`[AutoRecovery] ${jobId} — attempt #${attemptNo} started`);

  // Simulate async work (4s, 8s, 16s base delay × attempt)
  const workDelay = BASE_DELAY_MS * attemptNo + rand(500, 1500);

  setTimeout(async () => {
    try {
      const success      = Math.random() < SUCCESS_CHANCE;
      const resolvedAt   = new Date();
      const durationMs   = resolvedAt - attemptStartedAt;

      if (success) {
        // ── Recovery succeeded ────────────────────────────────────────────
        const patch = {
          status:                       'success',
          endTime:                      resolvedAt,
          duration:                     Math.floor(durationMs / 1000),
          failureReason:                null,
          'autoRecovery.status':        'recovered',
          'autoRecovery.resolvedAt':    resolvedAt,
          'autoRecovery.totalAttempts': attemptNo,
        };
        await saveRecovery(jobId, patch);

        // Update the last history entry outcome
        if (isConnected()) {
          await getJobModel().findOneAndUpdate(
            { jobId, 'autoRecovery.history.attempt': attemptNo },
            { $set: {
                'autoRecovery.history.$.outcome':    'success',
                'autoRecovery.history.$.resolvedAt': resolvedAt,
                'autoRecovery.history.$.durationMs': durationMs,
                'autoRecovery.history.$.message':    `Attempt #${attemptNo} succeeded — job recovered`,
            }}
          );
        } else {
          const job = getStore().find(j => j.jobId === jobId);
          if (job?.autoRecovery?.history) {
            const h = job.autoRecovery.history.find(e => e.attempt === attemptNo);
            if (h) Object.assign(h, { outcome: 'success', resolvedAt, durationMs, message: `Attempt #${attemptNo} succeeded` });
          }
        }

        await logService.write({
          jobId, jobName, source, destination, status: 'success', level: 'INFO',
          message: `[AutoRecovery] Attempt #${attemptNo} SUCCEEDED — job recovered after ${(durationMs / 1000).toFixed(1)}s`,
          meta: { event: 'auto_recovery_success', attemptNo, durationMs },
        });

        console.log(`[AutoRecovery] ${jobId} — attempt #${attemptNo} SUCCEEDED`);

      } else {
        // ── This attempt failed ───────────────────────────────────────────
        if (isConnected()) {
          await getJobModel().findOneAndUpdate(
            { jobId, 'autoRecovery.history.attempt': attemptNo },
            { $set: {
                'autoRecovery.history.$.outcome':    'failed',
                'autoRecovery.history.$.resolvedAt': resolvedAt,
                'autoRecovery.history.$.durationMs': durationMs,
                'autoRecovery.history.$.message':    `Attempt #${attemptNo} failed — ${attemptNo < MAX_ATTEMPTS ? 'scheduling next retry' : 'max retries reached'}`,
            }}
          );
        } else {
          const job = getStore().find(j => j.jobId === jobId);
          if (job?.autoRecovery?.history) {
            const h = job.autoRecovery.history.find(e => e.attempt === attemptNo);
            if (h) Object.assign(h, { outcome: 'failed', resolvedAt, durationMs,
              message: `Attempt #${attemptNo} failed` });
          }
        }

        await logService.write({
          jobId, jobName, source, destination, status: 'failed', level: 'WARN',
          message: `[AutoRecovery] Attempt #${attemptNo} failed (${(durationMs / 1000).toFixed(1)}s)${attemptNo < MAX_ATTEMPTS ? ' — scheduling retry' : ' — max retries reached'}`,
          meta: { event: 'auto_recovery_attempt_failed', attemptNo, durationMs },
        });

        console.log(`[AutoRecovery] ${jobId} — attempt #${attemptNo} FAILED`);

        if (attemptNo < MAX_ATTEMPTS) {
          // Schedule next attempt with exponential back-off
          const nextDelay = BASE_DELAY_MS * Math.pow(2, attemptNo - 1) + rand(500, 1000);
          setTimeout(() => runAttempt(jobId, jobName, source, destination, attemptNo + 1), nextDelay);
        } else {
          // All retries exhausted
          await saveRecovery(jobId, {
            status:                       'failed',
            'autoRecovery.status':        'max_retries_reached',
            'autoRecovery.resolvedAt':    resolvedAt,
            'autoRecovery.totalAttempts': MAX_ATTEMPTS,
          });

          await logService.write({
            jobId, jobName, source, destination, status: 'failed', level: 'ERROR',
            message: `[AutoRecovery] All ${MAX_ATTEMPTS} recovery attempts exhausted — job permanently failed`,
            meta: { event: 'auto_recovery_exhausted', maxAttempts: MAX_ATTEMPTS },
          });

          console.log(`[AutoRecovery] ${jobId} — all ${MAX_ATTEMPTS} attempts exhausted`);
        }
      }
    } catch (err) {
      console.error(`[AutoRecovery] attempt error for ${jobId}:`, err.message);
    }
  }, workDelay);
}

/* ── public trigger ─────────────────────────────────────────────────────── */
/**
 * Kick off auto-recovery for a job.
 * Safe to call from the manual API endpoint.
 * Returns immediately; recovery runs asynchronously.
 */
async function triggerAutoRecovery(jobId, jobName, source, destination) {
  try {
    const job = await loadJob(jobId);
    if (!job) return;

    // Don't start if already recovering or already recovered
    const arStatus = job.autoRecovery?.status;
    if (arStatus === 'recovering' || arStatus === 'recovered') return;
    // Only attempt recovery for failed jobs
    if (job.status !== 'failed') return;

    const startedAt = new Date();
    await saveRecovery(jobId, {
      'autoRecovery.status':        'recovering',
      'autoRecovery.enabled':       true,
      'autoRecovery.startedAt':     startedAt,
      'autoRecovery.totalAttempts': 0,
      'autoRecovery.maxAttempts':   MAX_ATTEMPTS,
      'autoRecovery.history':       [],
    });

    console.log(`[AutoRecovery] Triggered for ${jobId} — up to ${MAX_ATTEMPTS} attempts`);
    // Slight initial delay so the job creation settles first
    setTimeout(() => runAttempt(jobId, jobName, source, destination, 1), 2000);
  } catch (err) {
    console.error(`[AutoRecovery] trigger error for ${jobId}:`, err.message);
  }
}

/* ── GET /api/recovery/stats ────────────────────────────────────────────── */
const getRecoveryStats = async (req, res) => {
  try {
    if (isConnected()) {
      const [total, recovering, recovered, exhausted, recentRecovered] = await Promise.all([
        getJobModel().countDocuments({ 'autoRecovery.status': { $exists: true, $ne: 'idle' } }),
        getJobModel().countDocuments({ 'autoRecovery.status': 'recovering' }),
        getJobModel().countDocuments({ 'autoRecovery.status': 'recovered' }),
        getJobModel().countDocuments({ 'autoRecovery.status': 'max_retries_reached' }),
        getJobModel().find({ 'autoRecovery.status': { $in: ['recovered', 'max_retries_reached', 'recovering'] } })
          .sort({ 'autoRecovery.lastAttemptAt': -1 }).limit(10).lean(),
      ]);
      return res.json({ total, recovering, recovered, exhausted, recentRecovered });
    }

    // in-memory fallback
    const store = getStore();
    const withRecovery = store.filter(j => j.autoRecovery && j.autoRecovery.status && j.autoRecovery.status !== 'idle');
    return res.json({
      total:            withRecovery.length,
      recovering:       withRecovery.filter(j => j.autoRecovery.status === 'recovering').length,
      recovered:        withRecovery.filter(j => j.autoRecovery.status === 'recovered').length,
      exhausted:        withRecovery.filter(j => j.autoRecovery.status === 'max_retries_reached').length,
      recentRecovered:  withRecovery.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/recovery/:jobId ───────────────────────────────────────────── */
const getRecoveryForJob = async (req, res) => {
  try {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job.autoRecovery || { status: 'idle', history: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/recovery/:jobId/trigger ──────────────────────────────────── */
const triggerRecoveryForJob = async (req, res) => {
  try {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.status !== 'failed') return res.status(400).json({ message: 'Job is not in a failed state' });
    const arStatus = job.autoRecovery?.status;
    if (arStatus === 'recovering') return res.status(409).json({ message: 'Recovery already in progress' });

    // Reset recovery state before re-triggering
    await saveRecovery(job.jobId, {
      'autoRecovery.status':        'idle',
      'autoRecovery.history':       [],
      'autoRecovery.totalAttempts': 0,
      'autoRecovery.startedAt':     null,
      'autoRecovery.resolvedAt':    null,
    });

    await triggerAutoRecovery(job.jobId, job.jobName, job.source, job.destination);
    res.json({ message: `Auto-recovery triggered for ${job.jobId}`, jobId: job.jobId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getRecoveryStats, getRecoveryForJob, triggerRecoveryForJob, triggerAutoRecovery };
