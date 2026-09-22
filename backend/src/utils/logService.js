/**
 * logService.js
 * Writes log entries to the dedicated EtlLog collection (and Job.logs for backward-compat).
 */
const { isConnected } = require('../config/db');
const { getStore }    = require('../data/store');

let EtlLog = null;
let Job    = null;

const getEtlLog = () => { if (!EtlLog) EtlLog = require('../models/EtlLog'); return EtlLog; };
const getJob    = () => { if (!Job)    Job    = require('../models/Job');    return Job;    };

const write = async ({ jobId, jobName, source = '', destination = '', status = 'running',
                        level = 'INFO', message, meta = {}, timestamp = new Date() }) => {
  const entry = { timestamp, level, message };

  if (isConnected()) {
    try { await getJob().findOneAndUpdate({ jobId }, { $push: { logs: entry } }); } catch (_) {}
    try {
      await getEtlLog().create({ jobId, jobName, source, destination, status, level, message, meta, timestamp });
    } catch (err) {
      console.error('[logService] EtlLog write error:', err.message);
    }
  } else {
    const job = getStore().find(j => j.jobId === jobId);
    if (job) job.logs = [...(job.logs || []), entry];
  }
};

/**
 * Bulk-write using insertMany for performance (avoids N sequential awaits).
 */
const writeBulk = async (entries) => {
  if (!entries || entries.length === 0) return;

  if (isConnected()) {
    // Bulk insert into EtlLog
    try {
      await getEtlLog().insertMany(entries.map(e => ({
        jobId:       e.jobId,
        jobName:     e.jobName,
        source:      e.source      || '',
        destination: e.destination || '',
        status:      e.status      || 'running',
        level:       e.level       || 'INFO',
        message:     e.message,
        meta:        e.meta        || {},
        timestamp:   e.timestamp   || new Date(),
      })), { ordered: false });
    } catch (err) {
      console.error('[logService] writeBulk EtlLog error:', err.message);
    }

    // Bulk push into Job.logs (one update per job)
    const byJob = {};
    entries.forEach(e => {
      if (!byJob[e.jobId]) byJob[e.jobId] = [];
      byJob[e.jobId].push({ timestamp: e.timestamp || new Date(), level: e.level || 'INFO', message: e.message });
    });
    await Promise.all(
      Object.entries(byJob).map(([jobId, logs]) =>
        getJob().findOneAndUpdate({ jobId }, { $push: { logs: { $each: logs } } }).catch(() => {})
      )
    );
  } else {
    const store = getStore();
    entries.forEach(e => {
      const job = store.find(j => j.jobId === e.jobId);
      if (job) job.logs = [...(job.logs || []), { timestamp: e.timestamp || new Date(), level: e.level || 'INFO', message: e.message }];
    });
  }
};

module.exports = { write, writeBulk };
