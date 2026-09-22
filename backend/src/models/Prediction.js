const mongoose = require('mongoose');

/**
 * Persisted prediction record — one document per prediction run.
 * Stores all inputs, outputs, and the job reference so we can
 * serve prediction history per job and across the fleet.
 */
const predictionSchema = new mongoose.Schema(
  {
    // Reference to the job (null for ad-hoc / manual predictions)
    jobId:   { type: String, default: null, index: true },
    jobName: { type: String, default: null },

    // Trigger context
    source: {
      type: String,
      enum: ['pre_execution', 'manual', 'live_job', 'airflow', 'simulator'],
      default: 'manual',
    },

    // ── Input features ───────────────────────────────────────────
    cpuUsage:         { type: Number, default: 0 },
    memoryUsage:      { type: Number, default: 0 },
    retryCount:       { type: Number, default: 0 },
    duration:         { type: Number, default: 0 },
    recordsProcessed: { type: Number, default: 0 },
    historyPenalty:   { type: Number, default: 0 },

    // ── Model outputs ────────────────────────────────────────────
    riskScore:        { type: Number, required: true, min: 0, max: 100 },
    confidence:       { type: Number, required: true, min: 0, max: 100 },
    predictedStatus:  {
      type: String,
      enum: ['stable', 'at_risk', 'likely_fail'],
      required: true,
    },
    // Human-readable display label — "Success" / "Warning" / "Failed"
    statusLabel: {
      type: String,
      enum: ['Success', 'Warning', 'Failed'],
      required: true,
    },
    recommendedAction: { type: String, default: '' },
    rootCause:         { type: String, default: '' },
    recoveryActions:   [{ type: String }],
    anomalies:         [{ type: String }],

    // Feature-contribution breakdown (stored as raw JSON)
    features: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Model metadata
    modelVersion: { type: String, default: 'v2' },
    scoredAt:     { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    // Keep last 5000 predictions (TTL index on scoredAt, 30 days)
  }
);

predictionSchema.index({ scoredAt: -1 });
predictionSchema.index({ jobId: 1, scoredAt: -1 });
predictionSchema.index({ predictedStatus: 1, scoredAt: -1 });

// Auto-expire documents after 30 days
predictionSchema.index({ scoredAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Prediction', predictionSchema);
