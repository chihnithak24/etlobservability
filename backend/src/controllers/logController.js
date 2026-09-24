const { isConnected } = require('../config/db');
const { getStore }    = require('../data/store');
const Job    = require('../models/Job');

let EtlLog = null;
const getEtlLog = () => { if (!EtlLog) EtlLog = require('../models/EtlLog'); return EtlLog; };

/* ── GET /api/logs ───────────────────────────────────────────────────────── */
// Returns a flat, paginated list of log entries from the EtlLog collection.
// Falls back to unwinding Job.logs when no EtlLog records exist.
// Query params: page, limit, level (INFO|WARN|ERROR|DEBUG), jobId, search, dateFrom, dateTo
const getLogs = async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const level    = req.query.level    || '';
    const jobId    = req.query.jobId    || '';
    const search   = req.query.search   || '';
    const dateFrom = req.query.dateFrom || '';
    const dateTo   = req.query.dateTo   || '';
    const skip     = (page - 1) * limit;

    if (isConnected()) {
      const EtlLogModel = getEtlLog();

      // Check if dedicated log collection has data
      const hasEtlLogs = await EtlLogModel.countDocuments({}, { limit: 1 }) > 0;

      if (hasEtlLogs) {
        // ── Query dedicated EtlLog collection ──────────────────────────────
        const filter = {};
        if (jobId)  filter.jobId = jobId;
        if (level)  filter.level = level;
        if (search) filter.message = { $regex: search, $options: 'i' };
        if (dateFrom || dateTo) {
          filter.timestamp = {};
          if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
          if (dateTo)   filter.timestamp.$lte = new Date(dateTo);
        }

        const [total, logs] = await Promise.all([
          EtlLogModel.countDocuments(filter),
          EtlLogModel.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .select('-__v')
            .lean()
        ]);

        return res.json({ logs, total, page, pages: Math.ceil(total / limit) });
      }

      // ── Fallback: unwind Job.logs via aggregation ──────────────────────
      const jobMatch = {};
      if (jobId) jobMatch.jobId = jobId;

      const pipeline = [
        { $match: jobMatch },
        { $unwind: '$logs' },
        ...(level  ? [{ $match: { 'logs.level': level } }] : []),
        ...(search ? [{ $match: { 'logs.message': { $regex: search, $options: 'i' } } }] : []),
        ...(dateFrom ? [{ $match: { 'logs.timestamp': { $gte: new Date(dateFrom) } } }] : []),
        ...(dateTo   ? [{ $match: { 'logs.timestamp': { $lte: new Date(dateTo)   } } }] : []),
        { $sort: { 'logs.timestamp': -1 } },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 0,
                  jobId: 1, jobName: 1, source: 1, destination: 1, status: 1,
                  timestamp: '$logs.timestamp',
                  level:     '$logs.level',
                  message:   '$logs.message',
                  meta:      { $ifNull: ['$logs.meta', {}] }
                }
              }
            ],
            total: [{ $count: 'n' }]
          }
        }
      ];

      const [result] = await Job.aggregate(pipeline);
      const total = result.total[0]?.n ?? 0;
      return res.json({ logs: result.data, total, page, pages: Math.ceil(total / limit) });
    }

    // ── in-memory fallback ──────────────────────────────────────────────────
    let entries = [];
    const store = getStore();
    for (const job of store) {
      if (jobId && job.jobId !== jobId) continue;
      for (const log of (job.logs || [])) {
        if (level  && log.level   !== level)  continue;
        if (search && !log.message.toLowerCase().includes(search.toLowerCase())) continue;
        entries.push({ jobId: job.jobId, jobName: job.jobName, source: job.source, destination: job.destination, status: job.status, ...log });
      }
    }
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total = entries.length;
    return res.json({ logs: entries.slice(skip, skip + limit), total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

  /* ── GET /api/logs/stats ─────────────────────────────────────────────────── */
// Returns aggregate counts by level + counts per job for the summary bar
const getLogStats = async (req, res) => {
  try {
    if (isConnected()) {
      const EtlLogModel = getEtlLog();
      const hasEtlLogs  = await EtlLogModel.countDocuments({}, { limit: 1 }) > 0;

      if (hasEtlLogs) {
        const [byLevel, total] = await Promise.all([
          EtlLogModel.aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }]),
          EtlLogModel.countDocuments()
        ]);
        const counts = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
        byLevel.forEach(r => { if (r._id in counts) counts[r._id] = r.count; });
        return res.json({ total, ...counts });
      }

      // Fallback: aggregate Job.logs when EtlLog collection has not been seeded
      const byLevel = await Job.aggregate([
        { $unwind: '$logs' },
        { $group: { _id: '$logs.level', count: { $sum: 1 } } }
      ]);
      const counts = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
      let total = 0;
      byLevel.forEach(r => {
        if (r._id in counts) counts[r._id] = r.count;
        total += r.count;
      });
      return res.json({ total, ...counts });
    }

    // in-memory fallback
    const counts = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    for (const job of getStore()) {
      for (const log of (job.logs || [])) if (log.level in counts) counts[log.level]++;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ total, ...counts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/logs/:jobId ────────────────────────────────────────────────── */
// Returns all logs for a single job
const getLogsByJob = async (req, res) => {
  try {
    if (isConnected()) {
      const EtlLogModel = getEtlLog();
      const hasEtlLogs  = await EtlLogModel.countDocuments({ jobId: req.params.jobId }, { limit: 1 }) > 0;

      if (hasEtlLogs) {
        const logs = await EtlLogModel.find({ jobId: req.params.jobId })
          .sort({ timestamp: 1 })
          .lean();
        const job = await Job.findOne({ jobId: req.params.jobId }, 'jobId jobName status').lean();
        if (!job && !logs.length) return res.status(404).json({ message: 'Job not found' });
        return res.json({ jobId: req.params.jobId, jobName: job?.jobName, status: job?.status, logs });
      }

      const job = await Job.findOne({ jobId: req.params.jobId }, 'jobId jobName status logs').lean();
      if (!job) return res.status(404).json({ message: 'Job not found' });
      return res.json({ jobId: job.jobId, jobName: job.jobName, status: job.status, logs: job.logs });
    }
    const job = getStore().find(j => j.jobId === req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ jobId: job.jobId, jobName: job.jobName, status: job.status, logs: job.logs || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getLogs, getLogStats, getLogsByJob };
