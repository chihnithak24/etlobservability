const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  jobId: { type: String, required: true },
  jobName: { type: String },
  type: { type: String, enum: ['failure', 'warning', 'prediction', 'recovery'], required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  read: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
