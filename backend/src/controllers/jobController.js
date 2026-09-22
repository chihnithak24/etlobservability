const Job = require('../models/Job');
const { isConnected } = require('../config/db');
const { getStore } = require('../data/store');
const { sendJobFailureEmail } = require('../utils/emailService');
const { validate, rules } = require('../middleware/validate');

const useDB = () => isConnected();

/* ── validation schemas ──────────────────────────────────────────────────── */
const VALID_STATUSES = ['running', 'success', 'failed', 'warning', 'pending'];
const VALID_SORT_FIELDS = ['startTime', 'endTime', 'duration', 'cpuUsage', 'memoryUsage',
                           'aiRiskScore', 'retryCount', 'recordsProcessed', 'jobId', 'jobName', 'status'];

const validateCreateJob = validate({
  jobName:     [rules.required, rules.isString, rules.minLen(2), rules.maxLen(120), rules.noScript],
  source:      [rules.required, rules.isString, rules.maxLen(80),  rules.noScript],
  destination: [rules.required, rules.isString, rules.maxLen(80),  rules.noScript],
});

const validateUpdateJob = validate({
  jobName:     [rules.isString, rules.minLen(2), rules.maxLen(120), rules.noScript],
  source:      [rules.isString, rules.maxLen(80),  rules.noScript],
  destination: [rules.isString, rules.maxLen(80),  rules.noScript],
  status:      [rules.isIn(VALID_STATUSES)],
});

/* ── helpers ─────────────────────────────────────────────────────────────── */

// Extract a clean validation error message from a Mongoose ValidationError
const validationMessage = (err) => {
  if (err.name === 'ValidationError') {
    return Object.values(err.errors).map(e => e.message).join(', ');
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return `Duplicate value for ${field}`;
  }
  return err.message;
};

// Fields the client must never be allowed to set/overwrite
const IMMUTABLE = ['jobId', 'retryCount', 'logs', 'createdAt', 'updatedAt', '__v'];

const stripImmutable = (body) => {
  const clean = { ...body };
  IMMUTABLE.forEach(k => delete clean[k]);
  return clean;
};

// Generate next jobId by finding the current numeric max — O(1) aggregation
const nextJobId = async () => {
  if (useDB()) {
    const result = await Job.aggregate([
      { $project: { num: { $toInt: { $arrayElemAt: [{ $split: ['$jobId', '-'] }, 1] } } } },
      { $group: { _id: null, max: { $max: '$num' } } }
    ]);
    const max = result[0]?.max ?? 0;
    return `JOB-${String(max + 1).padStart(4, '0')}`;
  }
  const store = getStore();
  const max = store.reduce((m, j) => {
    const n = parseInt((j.jobId || '').split('-')[1], 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `JOB-${String(max + 1).padStart(4, '0')}`;
};

/* ── GET /jobs ───────────────────────────────────────────────────────────── */
const getJobs = async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const sortBy  = VALID_SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'startTime';
    const order   = req.query.order === 'asc' ? 'asc' : 'desc';
    const status  = req.query.status  || '';
    const search  = req.query.search  || '';
    const skip    = (page - 1) * limit;
    const sortDir = order === 'asc' ? 1 : -1;

    if (useDB()) {
      const query = {};
      if (status && status !== 'all') query.status = status;
      if (search) query.$or = [
        { jobName: { $regex: search, $options: 'i' } },
        { jobId:   { $regex: search, $options: 'i' } }
      ];
      const [jobs, total] = await Promise.all([
        Job.find(query).sort({ [sortBy]: sortDir }).skip(skip).limit(limit).lean(),
        Job.countDocuments(query)
      ]);
      return res.json({ jobs, total, page, pages: Math.ceil(total / limit) });
    }

    // in-memory fallback
    let jobs = getStore();
    if (status && status !== 'all') jobs = jobs.filter(j => j.status === status);
    if (search) jobs = jobs.filter(j =>
      j.jobName.toLowerCase().includes(search.toLowerCase()) ||
      j.jobId.toLowerCase().includes(search.toLowerCase())
    );
    jobs = [...jobs].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      return sortDir === -1 ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
    const total = jobs.length;
    return res.json({ jobs: jobs.slice(skip, skip + limit), total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /jobs/:id ───────────────────────────────────────────────────────── */
const getJobById = async (req, res) => {
  try {
    const job = useDB()
      ? await Job.findOne({ jobId: req.params.id }).lean()
      : getStore().find(j => j.jobId === req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /jobs ──────────────────────────────────────────────────────────── */
const createJob = async (req, res) => {
  try {
    const missing = ['jobName', 'source', 'destination'].filter(f => !req.body[f]?.toString().trim());
    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }

    const jobId = await nextJobId();
    const safe = stripImmutable(req.body);
    const jobData = {
      ...safe,
      jobId,
      status:       'pending',
      retryCount:   0,
      aiRiskScore:  0,
      logs:         [],
      recoveryActions: [],
      anomalies:    [],
      startTime:    new Date()
    };

    if (useDB()) {
      const job = await Job.create(jobData);
      return res.status(201).json(job);
    }
    getStore().unshift(jobData);
    res.status(201).json(jobData);
  } catch (err) {
    const status = err.name === 'ValidationError' || err.code === 11000 ? 400 : 500;
    res.status(status).json({ message: validationMessage(err) });
  }
};

/* ── PUT /jobs/:id ───────────────────────────────────────────────────────── */
const updateJob = async (req, res) => {
  try {
    const updates = stripImmutable(req.body);

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    if (useDB()) {
      const job = await Job.findOneAndUpdate(
        { jobId: req.params.id },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      if (!job) return res.status(404).json({ message: 'Job not found' });
      return res.json(job);
    }

    const store = getStore();
    const idx = store.findIndex(j => j.jobId === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Job not found' });
    store[idx] = { ...store[idx], ...updates };
    res.json(store[idx]);
  } catch (err) {
    const status = err.name === 'ValidationError' || err.code === 11000 ? 400 : 500;
    res.status(status).json({ message: validationMessage(err) });
  }
};

/* ── DELETE /jobs/:id ────────────────────────────────────────────────────── */
const deleteJob = async (req, res) => {
  try {
    if (useDB()) {
      const job = await Job.findOneAndDelete({ jobId: req.params.id });
      if (!job) return res.status(404).json({ message: 'Job not found' });
      return res.json({ message: 'Job deleted', jobId: req.params.id });
    }
    const store = getStore();
    const idx = store.findIndex(j => j.jobId === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Job not found' });
    store.splice(idx, 1);
    res.json({ message: 'Job deleted', jobId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /jobs/:id/retry ────────────────────────────────────────────────── */
const retryJob = async (req, res) => {
  try {
    if (useDB()) {
      const job = await Job.findOne({ jobId: req.params.id });
      if (!job) return res.status(404).json({ message: 'Job not found' });

      if (job.status === 'running') {
        return res.status(409).json({ message: 'Job is already running' });
      }

      job.retryCount += 1;
      job.status     = 'running';
      job.startTime  = new Date();
      job.endTime    = undefined;
      job.logs.push({ timestamp: new Date(), level: 'INFO', message: `Auto-retry attempt #${job.retryCount} initiated` });
      await job.save();

      // Simulate async completion after 3 s
      const retryStart = job.startTime;
      setTimeout(async () => {
        try {
          const succeeded = Math.random() > 0.3;
          const endTime   = new Date();
          await Job.findOneAndUpdate(
            { jobId: req.params.id },
            {
              $set:  { status: succeeded ? 'success' : 'failed', endTime, duration: Math.floor((endTime - retryStart) / 1000) },
              $push: { logs: { timestamp: endTime, level: succeeded ? 'INFO' : 'ERROR', message: `Retry ${succeeded ? 'succeeded' : 'failed again'}` } }
            }
          );
          if (!succeeded) {
            const j = await Job.findOne({ jobId: req.params.id }).lean();
            if (j) sendJobFailureEmail({
              jobId: j.jobId, jobName: j.jobName, source: j.source, destination: j.destination,
              failureReason: 'Retry failed again', retryCount: j.retryCount,
              cpuUsage: j.cpuUsage, memoryUsage: j.memoryUsage, aiRiskScore: j.aiRiskScore
            });
          }
        } catch { /* silent — client will poll */ }
      }, 3000);

      return res.json({ message: `Retry initiated for ${job.jobId}`, job });
    }

    // in-memory fallback
    const job = getStore().find(j => j.jobId === req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.status === 'running') return res.status(409).json({ message: 'Job is already running' });

    job.retryCount = (job.retryCount || 0) + 1;
    job.status     = 'running';
    job.startTime  = new Date();
    job.endTime    = null;
    job.logs       = [...(job.logs || []), { timestamp: new Date(), level: 'INFO', message: `Auto-retry attempt #${job.retryCount} initiated` }];

    const retryStart = job.startTime;
    setTimeout(() => {
      job.status   = Math.random() > 0.3 ? 'success' : 'failed';
      job.endTime  = new Date();
      job.duration = Math.floor((job.endTime - retryStart) / 1000);
      job.logs.push({ timestamp: new Date(), level: job.status === 'success' ? 'INFO' : 'ERROR', message: `Retry ${job.status === 'success' ? 'succeeded' : 'failed again'}` });
    }, 3000);

    res.json({ message: `Retry initiated for ${job.jobId}`, job });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getJobs, getJobById, createJob, updateJob, deleteJob, retryJob, validateCreateJob, validateUpdateJob };
