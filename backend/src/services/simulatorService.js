/**
 * simulatorService.js
 * 
 * ETL Simulator Engine for development, demo, and standalone monitoring.
 * Simulates real-time ETL DAG runs, task executions, metric telemetry,
 * heartbeat updates, proactive AI failure prediction, alerts, RCA, and recovery.
 */

'use strict';

const { isConnected } = require('../config/db');
const { getStore } = require('../data/store');
const Job = require('../models/Job');
const { runPrediction } = require('../controllers/predictionController');
const { createAlert } = require('../controllers/alertController');
const { triggerAutoRecovery } = require('../controllers/recoveryController');
const logService = require('../utils/logService');

/* ── Configuration from env ────────────────────────────────────────── */
const JOB_INTERVAL_MS    = parseInt(process.env.SIMULATOR_JOB_INTERVAL_MS    || '10000', 10);
const JOB_DURATION_MS    = parseInt(process.env.SIMULATOR_JOB_DURATION_MS    || '45000', 10);
const UPDATE_INTERVAL_MS = parseInt(process.env.SIMULATOR_UPDATE_INTERVAL_MS || '2000',  10);

/* ── Sample ETL Pipelines ─────────────────────────────────────────── */
const PIPELINES = [
  { dagId: 'sales_analytics_etl',   jobName: 'Sales Analytics ETL',    source: 'PostgreSQL_OLTP', destination: 'Snowflake_DW',      tasks: ['extract_orders', 'transform_sales', 'load_fact_sales'] },
  { dagId: 'customer_360_sync',     jobName: 'Customer 360 Sync',      source: 'Salesforce_API',  destination: 'BigQuery_CDP',      tasks: ['fetch_accounts', 'enrich_profiles', 'upsert_customers'] },
  { dagId: 'inventory_stream_etl',  jobName: 'Inventory Stream ETL',   source: 'Kafka_Cluster',   destination: 'Redshift_Warehouse',tasks: ['consume_events', 'aggregate_stock', 'write_inventory'] },
  { dagId: 'financial_reconcile',   jobName: 'Financial Reconciliation',source: 'Oracle_ERP',     destination: 'S3_DataLake',       tasks: ['pull_ledger', 'reconcile_tx', 'export_reports'] },
  { dagId: 'user_behavior_logs',    jobName: 'User Behavior Logs',     source: 'Segment_Events',  destination: 'ClickHouse_Analytics',tasks: ['ingest_logs', 'parse_json', 'load_clickstream'] },
];

const STAGES = ['EXTRACT', 'TRANSFORM', 'LOAD'];

let isRunning = false;
let spawnTimer = null;
let updateTimer = null;
let activeSimulatedJobs = new Map(); // jobId -> internal state
let jobCounter = 100;

const useDB = () => isConnected();

/**
 * Generate unique job ID for simulated runs
 */
const generateJobId = () => {
  jobCounter++;
  const timeSuffix = Date.now().toString().slice(-4);
  return `SIM-JOB-${timeSuffix}-${String(jobCounter % 1000).padStart(3, '0')}`;
};

/**
 * Helper to update job state in DB or in-memory store
 */
const updateJobRecord = async (jobId, patch) => {
  if (useDB()) {
    try {
      return await Job.findOneAndUpdate({ jobId }, { $set: patch }, { new: true, lean: true });
    } catch (err) {
      console.error(`[Simulator] DB update error for ${jobId}:`, err.message);
    }
  } else {
    const store = getStore();
    const idx = store.findIndex(j => j.jobId === jobId);
    if (idx !== -1) {
      store[idx] = { ...store[idx], ...patch };
      return store[idx];
    }
  }
  return null;
};

/**
 * Create a new simulated job instance
 */
const spawnJob = async (forceFailure = false) => {
  const pipeline = PIPELINES[Math.floor(Math.random() * PIPELINES.length)];
  const jobId = generateJobId();
  const dagRunId = `sim_run_${Date.now()}`;
  const now = new Date();

  // Determine whether this job is designated to fail or experience high risk
  const willFail = forceFailure || Math.random() < 0.35; 
  const willSpikeCpu = willFail || Math.random() < 0.4;
  const willSpikeMem = willFail || Math.random() < 0.4;

  const initialTasks = pipeline.tasks.map((taskId, idx) => ({
    taskId,
    state: idx === 0 ? 'running' : 'pending',
    tryNumber: 1,
    duration: null,
    startDate: idx === 0 ? now : null,
    endDate: null,
    operator: 'PythonOperator',
  }));

  const jobData = {
    jobId,
    jobName: pipeline.jobName,
    source: pipeline.source,
    destination: pipeline.destination,
    dagId: pipeline.dagId,
    dagRunId,
    taskId: pipeline.tasks[0],
    status: 'running',
    currentStage: 'EXTRACT',
    progress: 5,
    cpuUsage: Math.floor(Math.random() * 25) + 30, // initial CPU 30-55%
    memoryUsage: Math.floor(Math.random() * 20) + 40, // initial Mem 40-60%
    recordsProcessed: Math.floor(Math.random() * 5000) + 1000,
    startTime: now,
    lastHeartbeat: now,
    duration: 0,
    retryCount: 0,
    aiRiskScore: 15,
    predictedStatus: 'stable',
    tasks: initialTasks,
    runType: 'scheduled',
    logs: [
      { timestamp: now, level: 'INFO', message: `[Simulator] Job ${jobId} initialized for ${pipeline.jobName}` },
      { timestamp: now, level: 'INFO', message: `[Simulator] Stage EXTRACT started — processing ${pipeline.source}` }
    ]
  };

  // Persist new job
  if (useDB()) {
    try {
      await Job.create(jobData);
    } catch (err) {
      console.error(`[Simulator] Error creating job ${jobId}:`, err.message);
    }
  } else {
    getStore().unshift(jobData);
  }

  // Register internal state for ticks
  activeSimulatedJobs.set(jobId, {
    jobId,
    pipeline,
    willFail,
    willSpikeCpu,
    willSpikeMem,
    startTimeMs: now.getTime(),
    targetDurationMs: JOB_DURATION_MS + (Math.floor(Math.random() * 10000) - 5000),
    warnAlertSent: false,
    retryAttempt: 0,
  });

  console.log(`[Simulator] Spawned new running job: ${jobId} (${pipeline.jobName}) [willFail: ${willFail}]`);
  return jobData;
};

/**
 * Perform one tick of simulation updates for all active running jobs
 */
const simulationTick = async () => {
  if (!isRunning) return;

  const now = new Date();
  const nowMs = now.getTime();

  for (const [jobId, state] of activeSimulatedJobs.entries()) {
    try {
      const elapsedMs = nowMs - state.startTimeMs;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const rawProgress = Math.min(99, Math.floor((elapsedMs / state.targetDurationMs) * 100));

      // Determine current stage & task
      let currentStage = 'EXTRACT';
      let taskId = state.pipeline.tasks[0];
      if (rawProgress >= 70) {
        currentStage = 'LOAD';
        taskId = state.pipeline.tasks[2] || state.pipeline.tasks[1];
      } else if (rawProgress >= 30) {
        currentStage = 'TRANSFORM';
        taskId = state.pipeline.tasks[1];
      }

      // Compute resource metrics
      let cpuUsage = 35 + Math.floor(Math.sin(elapsedSec / 3) * 15) + (elapsedSec % 5);
      let memoryUsage = 45 + Math.floor(elapsedSec * 0.8);

      if (state.willSpikeCpu && rawProgress > 40) {
        cpuUsage = Math.min(98, 75 + Math.floor(Math.random() * 20));
      }
      if (state.willSpikeMem && rawProgress > 40) {
        memoryUsage = Math.min(96, 78 + Math.floor(Math.random() * 18));
      }

      const recordsProcessed = Math.floor(elapsedSec * (1200 + Math.random() * 800));

      // Evaluate AI risk score proactively
      const prediction = await runPrediction({
        cpuUsage,
        memoryUsage,
        retryCount: state.retryAttempt,
        duration: elapsedSec,
        recordsProcessed,
        jobId,
        jobName: state.pipeline.jobName,
        source: 'simulator'
      });

      const aiRiskScore = prediction?.riskScore ?? 20;
      const predictedStatus = prediction?.predictedStatus ?? 'stable';

      // Update tasks array states
      const tasks = state.pipeline.tasks.map((tName, idx) => {
        let taskState = 'pending';
        if (currentStage === 'EXTRACT' && idx === 0) taskState = 'running';
        else if (currentStage === 'TRANSFORM' && idx === 0) taskState = 'success';
        else if (currentStage === 'TRANSFORM' && idx === 1) taskState = 'running';
        else if (currentStage === 'LOAD' && idx < 2) taskState = 'success';
        else if (currentStage === 'LOAD' && idx === 2) taskState = 'running';
        return {
          taskId: tName,
          state: taskState,
          tryNumber: 1,
          duration: taskState === 'success' ? 12 : null,
          startDate: now,
          operator: 'PythonOperator'
        };
      });

      // Proactive Risk Alerting — trigger early warning before failure
      if (aiRiskScore >= 70 && !state.warnAlertSent) {
        state.warnAlertSent = true;
        await createAlert({
          jobId,
          jobName: state.pipeline.jobName,
          type: 'warning',
          severity: 'high',
          message: `Proactive Alert: High risk of failure detected for ${state.pipeline.jobName} (Risk Score: ${aiRiskScore}%, CPU: ${cpuUsage}%, Mem: ${memoryUsage}%)`,
          emailSent: false,
        });
        console.log(`[Simulator] PROACTIVE ALERT sent for ${jobId}: Risk score ${aiRiskScore}%`);
      }

      // Check for completion or failure threshold
      const isTimeUp = elapsedMs >= state.targetDurationMs;
      const isCriticalExceeded = cpuUsage > 92 && memoryUsage > 92 && rawProgress > 50;

      if (isTimeUp || isCriticalExceeded) {
        if (state.willFail) {
          // ── JOB FAILED ──────────────────────────────────────────
          const failureReason = memoryUsage > 85 
            ? `MemoryExceededError: OOM killer terminated process during ${currentStage} stage (Memory: ${memoryUsage}%)`
            : cpuUsage > 85
            ? `CpuExhaustionTimeout: Process timed out during ${currentStage} stage under ${cpuUsage}% CPU load`
            : `DatabaseTimeoutError: Connection refused by target database ${state.pipeline.destination}`;

          const failedPatch = {
            status: 'failed',
            currentStage,
            progress: rawProgress,
            cpuUsage,
            memoryUsage,
            recordsProcessed,
            duration: elapsedSec,
            lastHeartbeat: now,
            endTime: now,
            failureReason,
            aiRiskScore,
            predictedStatus: 'likely_fail',
            tasks: tasks.map(t => t.state === 'running' ? { ...t, state: 'failed' } : t)
          };

          await updateJobRecord(jobId, failedPatch);
          activeSimulatedJobs.delete(jobId);

          // Log failure
          await logService.write({
            jobId, jobName: state.pipeline.jobName, source: state.pipeline.source, destination: state.pipeline.destination,
            status: 'failed', level: 'ERROR', message: `[Simulator] Job FAILED: ${failureReason}`
          });

          // Create Critical Failure Alert
          await createAlert({
            jobId,
            jobName: state.pipeline.jobName,
            type: 'failure',
            severity: 'critical',
            message: `ETL Job FAILED: ${failureReason}`,
            emailSent: true,
          });

          // Trigger Auto-Recovery
          triggerAutoRecovery(jobId, state.pipeline.jobName, state.pipeline.source, state.pipeline.destination);

          console.log(`[Simulator] Job FAILED: ${jobId} (${failureReason})`);
        } else {
          // ── JOB SUCCEEDED ───────────────────────────────────────
          const successPatch = {
            status: 'success',
            currentStage: 'COMPLETED',
            progress: 100,
            cpuUsage: 22,
            memoryUsage: 35,
            recordsProcessed: recordsProcessed + 5000,
            duration: elapsedSec,
            lastHeartbeat: now,
            endTime: now,
            failureReason: null,
            aiRiskScore: Math.min(25, aiRiskScore),
            predictedStatus: 'stable',
            tasks: tasks.map(t => ({ ...t, state: 'success', duration: 15 }))
          };

          await updateJobRecord(jobId, successPatch);
          activeSimulatedJobs.delete(jobId);

          await logService.write({
            jobId, jobName: state.pipeline.jobName, source: state.pipeline.source, destination: state.pipeline.destination,
            status: 'success', level: 'INFO', message: `[Simulator] Job COMPLETED successfully in ${elapsedSec}s`
          });

          console.log(`[Simulator] Job SUCCEEDED: ${jobId} in ${elapsedSec}s`);
        }
      } else {
        // ── JOB STILL RUNNING (Update Telemetry & Heartbeat) ──────
        const livePatch = {
          status: 'running',
          currentStage,
          taskId,
          progress: rawProgress,
          cpuUsage,
          memoryUsage,
          recordsProcessed,
          duration: elapsedSec,
          lastHeartbeat: now,
          aiRiskScore,
          predictedStatus,
          tasks,
        };

        await updateJobRecord(jobId, livePatch);
      }
    } catch (err) {
      console.error(`[Simulator] Error processing tick for ${jobId}:`, err.message);
    }
  }
};

/**
 * Get active running jobs for /api/monitoring/live
 */
const getLiveMonitoringData = async () => {
  let runningJobs = [];
  const now = new Date();

  if (useDB()) {
    runningJobs = await Job.find({ status: 'running' }).sort({ startTime: -1 }).lean();
  } else {
    runningJobs = getStore().filter(j => j.status === 'running');
  }

  const jobs = runningJobs.map(j => {
    const lastHb = j.lastHeartbeat ? new Date(j.lastHeartbeat) : new Date(j.startTime || Date.now());
    const hbAgeSec = Math.floor((now - lastHb) / 1000);
    const heartbeatStatus = hbAgeSec < 10 ? 'LIVE' : hbAgeSec < 25 ? 'STALE' : 'DISCONNECTED';

    return {
      jobId: j.jobId,
      jobName: j.jobName || j.dagId || j.jobId,
      dagId: j.dagId || j.jobName,
      dag_id: j.dagId || j.jobName,
      taskId: j.taskId || 'transform_step',
      task_id: j.taskId || 'transform_step',
      status: j.status || 'running',
      progress: j.progress ?? 45,
      currentStage: j.currentStage || 'TRANSFORM',
      stage: j.currentStage || 'TRANSFORM',
      cpuUsage: j.cpuUsage ?? 50,
      memoryUsage: j.memoryUsage ?? 55,
      recordsProcessed: j.recordsProcessed ?? 12000,
      duration: j.duration ?? 30,
      retryCount: j.retryCount ?? 0,
      aiRiskScore: j.aiRiskScore ?? 25,
      lastHeartbeat: j.lastHeartbeat || now.toISOString(),
      heartbeatStatus,
      hbAgeSec,
      heartbeatAgeSec: hbAgeSec,
    };
  });

  return {
    status: 'live',
    timestamp: now.toISOString(),
    mode: process.env.ETL_MONITOR_MODE || 'simulator',
    runningJobs: jobs.length,
    activeJobs: jobs,
    jobs,
  };
};

/**
 * Start the simulator loop
 */
const startSimulator = async () => {
  if (isRunning) return;
  isRunning = true;
  console.log(`[Simulator] Service started (Job Interval: ${JOB_INTERVAL_MS}ms, Duration: ${JOB_DURATION_MS}ms, Update: ${UPDATE_INTERVAL_MS}ms)`);

  // Clean up any stale orphaned jobs marked as 'running' from previous server sessions/seeds
  const now = new Date();
  if (useDB()) {
    try {
      await Job.updateMany(
        { status: 'running' },
        { 
          $set: { 
            status: 'failed', 
            failureReason: 'Interrupted by server restart',
            endTime: now,
            currentStage: 'FAILED'
          } 
        }
      );
    } catch (err) {
      console.error('[Simulator] Error cleaning stale DB jobs:', err.message);
    }
  } else {
    const store = getStore();
    store.forEach(j => {
      if (j.status === 'running') {
        j.status = 'failed';
        j.failureReason = 'Interrupted by server restart';
        j.endTime = now;
        j.currentStage = 'FAILED';
      }
    });
  }

  // Clear active jobs Map and spawn initial fresh active jobs
  activeSimulatedJobs.clear();
  console.log('[Simulator] Spawning fresh initial live monitoring jobs...');
  await spawnJob(false); // Job 1 (normal execution)
  setTimeout(() => spawnJob(true), 2500); // Job 2 (high risk/failure demo)

  // Set up periodic timers
  updateTimer = setInterval(simulationTick, UPDATE_INTERVAL_MS);

  spawnTimer = setInterval(() => {
    if (activeSimulatedJobs.size < 4) { // keep max 4 concurrent jobs
      spawnJob();
    }
  }, JOB_INTERVAL_MS);
};

/**
 * Stop the simulator
 */
const stopSimulator = () => {
  isRunning = false;
  if (spawnTimer) clearInterval(spawnTimer);
  if (updateTimer) clearInterval(updateTimer);
  spawnTimer = null;
  updateTimer = null;
  console.log('[Simulator] Service stopped');
};

/**
 * Get status of simulator
 */
const getSimulatorStatus = () => ({
  mode: process.env.ETL_MONITOR_MODE || 'simulator',
  active: isRunning,
  runningJobsCount: activeSimulatedJobs.size,
  jobIntervalMs: JOB_INTERVAL_MS,
  jobDurationMs: JOB_DURATION_MS,
  updateIntervalMs: UPDATE_INTERVAL_MS,
});

module.exports = {
  startSimulator,
  stopSimulator,
  getSimulatorStatus,
  getLiveMonitoringData,
  spawnJob,
};
