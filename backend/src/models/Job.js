const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  { timestamp: { type: Date, default: Date.now }, level: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'], default: 'INFO' }, message: { type: String, required: true } },
  { _id: false }
);

/* ── Root Cause Analysis sub-document ─────────────────────────── */
const rcaSchema = new mongoose.Schema(
  {
    category:    { type: String, default: null },
    severity:    { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: null },
    confidence:  { type: Number, min: 0, max: 100, default: null },
    description: { type: String, default: null },
    signals:     [{ type: String }],
    solutions:   [{ type: String }],
    analysedAt:  { type: Date, default: null },
  },
  { _id: false }
);

/* ── Auto-Recovery attempt record ───────────────────────────────── */
const recoveryAttemptSchema = new mongoose.Schema(
  {
    attempt:     { type: Number, required: true },          // 1, 2, 3
    startedAt:   { type: Date,   default: Date.now },
    resolvedAt:  { type: Date,   default: null },
    outcome:     { type: String, enum: ['success', 'failed', 'running'], default: 'running' },
    durationMs:  { type: Number, default: null },           // ms to complete
    message:     { type: String, default: '' },             // human note
  },
  { _id: false }
);

/* ── Auto-Recovery sub-document ─────────────────────────────────── */
const autoRecoverySchema = new mongoose.Schema(
  {
    enabled:      { type: Boolean, default: true },
    status:       { type: String, enum: ['idle', 'recovering', 'recovered', 'failed', 'max_retries_reached'], default: 'idle' },
    totalAttempts:{ type: Number, default: 0, min: 0 },
    maxAttempts:  { type: Number, default: 3 },
    startedAt:    { type: Date,   default: null },
    resolvedAt:   { type: Date,   default: null },
    lastAttemptAt:{ type: Date,   default: null },
    history:      [recoveryAttemptSchema],
  },
  { _id: false }
);

/* ── Task-instance sub-document (Airflow) ──────────────────────────── */
const taskInstanceSchema = new mongoose.Schema(
  {
    taskId:    { type: String, required: true },
    state:     { type: String, default: 'unknown' },
    tryNumber: { type: Number, default: 1 },
    duration:  { type: Number, default: null },
    startDate: { type: Date,   default: null },
    endDate:   { type: Date,   default: null },
    operator:  { type: String, default: null },
    note:      { type: String, default: null },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema({
  jobId:            { type: String, required: true, unique: true, trim: true },
  jobName:          { type: String, required: [true, 'jobName is required'], trim: true, minlength: [2, 'jobName must be at least 2 characters'] },
  source:           { type: String, required: [true, 'source is required'], trim: true },
  destination:      { type: String, required: [true, 'destination is required'], trim: true },
  status:           { type: String, enum: { values: ['running', 'success', 'failed', 'warning', 'pending'], message: 'status must be one of: running, success, failed, warning, pending' }, default: 'pending' },
  startTime:        { type: Date },
  endTime:          { type: Date },
  duration:         { type: Number, min: [0, 'duration cannot be negative'] },
  cpuUsage:         { type: Number, min: [0, 'cpuUsage cannot be negative'], max: [100, 'cpuUsage cannot exceed 100'] },
  memoryUsage:      { type: Number, min: [0, 'memoryUsage cannot be negative'], max: [100, 'memoryUsage cannot exceed 100'] },
  recordsProcessed: { type: Number, default: 0, min: [0, 'recordsProcessed cannot be negative'] },
  failureReason:    { type: String, default: null },
  retryCount:       { type: Number, default: 0, min: [0, 'retryCount cannot be negative'] },
  aiRiskScore:      { type: Number, default: 0, min: [0, 'aiRiskScore cannot be negative'], max: [100, 'aiRiskScore cannot exceed 100'] },
  predictedStatus:  { type: String, enum: { values: ['stable', 'at_risk', 'likely_fail'], message: 'Invalid predictedStatus' }, default: null },
  logs:             [logSchema],
  recoveryActions:  [{ type: String }],
  anomalies:        [{ type: String }],
  rootCauseAnalysis: { type: rcaSchema, default: null },
  autoRecovery:      { type: autoRecoverySchema, default: () => ({}) },

  /* ── Airflow-specific & Simulator fields ───────────────────────────── */
  dagId:          { type: String, default: null, index: true },
  taskId:         { type: String, default: null },
  dagRunId:       { type: String, default: null },
  executionDate:  { type: Date,   default: null },
  dagState:       { type: String, default: null },   // raw Airflow state string
  runType:        { type: String, default: null },   // scheduled | manual | backfill
  externalTrigger:{ type: Boolean, default: false },
  note:           { type: String, default: null },
  tasks:          { type: [taskInstanceSchema], default: [] },
  progress:       { type: Number, default: 0, min: 0, max: 100 },
  currentStage:   { type: String, default: 'QUEUED' },
  lastHeartbeat:  { type: Date, default: null },
}, { timestamps: true });

/* ── Indexes ──────────────────────────────────────────────────────── */
// Core query indexes
jobSchema.index({ status:    1 });
jobSchema.index({ startTime: -1 });
jobSchema.index({ aiRiskScore: -1 });
jobSchema.index({ source:    1 });

// Airflow dedup: the pair (dagId, dagRunId) must be unique among Airflow jobs.
// Partial filter so it only applies to documents where both fields are valid strings,
// leaving manual/seed/simulator jobs (dagId: null) unaffected and avoiding E11000 null collisions.
jobSchema.index(
  { dagId: 1, dagRunId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dagId: { $type: 'string' },
      dagRunId: { $type: 'string' }
    },
    name: 'airflow_run_unique'
  }
);

module.exports = mongoose.model('Job', jobSchema);
