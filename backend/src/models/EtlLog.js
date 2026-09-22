const mongoose = require('mongoose');

/**
 * EtlLog — a dedicated collection for all ETL job log entries.
 * Every log event produced by the job controller is stored here
 * so the Log Viewer can query, filter, and paginate without unwinding the
 * Job.logs array.
 */
const etlLogSchema = new mongoose.Schema(
  {
    jobId:    { type: String, required: true, index: true },
    jobName:  { type: String, required: true },
    source:   { type: String, default: '' },
    destination: { type: String, default: '' },
    status:   { type: String, default: 'unknown' },
    level:    { type: String, enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'], default: 'INFO', index: true },
    message:  { type: String, required: true },
    meta:     { type: mongoose.Schema.Types.Mixed, default: {} },  // optional structured context
    timestamp:{ type: Date, default: Date.now, index: true }
  },
  { timestamps: false, collection: 'etllogs' }
);

// Compound index used by the Log Viewer filters
etlLogSchema.index({ timestamp: -1, level: 1 });
etlLogSchema.index({ jobId: 1, timestamp: -1 });

module.exports = mongoose.model('EtlLog', etlLogSchema);
