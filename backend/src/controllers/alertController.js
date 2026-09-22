const { isConnected } = require('../config/db');

let Alert = null;
const getAlert = () => { if (!Alert) Alert = require('../models/Alert'); return Alert; };

/* ── in-memory fallback store ─────────────────────────────────────────── */
let nextId = 6;
const genId = () => String(nextId++);

let inMemoryAlerts = [];

/* ── GET /api/alerts ──────────────────────────────────────────────────── */
const getAlerts = async (req, res) => {
  try {
    const { unread, type, severity } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    if (isConnected()) {
      const filter = {};
      if (unread === 'true') filter.read = false;
      if (type && type !== 'all') filter.type = type;
      if (severity && severity !== 'all') filter.severity = severity.toLowerCase();
      const alerts = await getAlert()
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return res.json(alerts);
    }

    let alerts = [...inMemoryAlerts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (unread === 'true') alerts = alerts.filter(a => !a.read);
    if (type && type !== 'all') alerts = alerts.filter(a => a.type === type);
    if (severity && severity !== 'all') alerts = alerts.filter(a => a.severity?.toLowerCase() === severity.toLowerCase());
    res.json(alerts.slice(0, limit));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── PUT /api/alerts/:id/read ─────────────────────────────────────────── */
const markAlertRead = async (req, res) => {
  try {
    if (isConnected()) {
      const alert = await getAlert().findByIdAndUpdate(req.params.id, { read: true }, { new: true }).lean();
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      return res.json(alert);
    }
    const alert = inMemoryAlerts.find(a => a._id === req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    alert.read = true;
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── PUT /api/alerts/read-all ─────────────────────────────────────────── */
const markAllRead = async (req, res) => {
  try {
    if (isConnected()) {
      await getAlert().updateMany({ read: false }, { $set: { read: true } });
      return res.json({ message: 'All alerts marked as read' });
    }
    inMemoryAlerts.forEach(a => { a.read = true; });
    res.json({ message: 'All alerts marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/alerts/email ───────────────────────────────────────────── */
const simulateEmailAlert = async (req, res) => {
  try {
    const { jobId, jobName, reason, severity = 'high', type = 'failure' } = req.body;
    if (!jobId || !jobName) return res.status(400).json({ message: 'jobId and jobName are required' });

    const alertData = {
      jobId, jobName, type,
      message: `Email alert: ${reason || 'Job failure detected'}`,
      severity,
      read: false,
      emailSent: true,
    };

    if (isConnected()) {
      const alert = await getAlert().create(alertData);
      return res.json({ message: 'Email alert simulated', alert });
    }

    const alert = { _id: genId(), ...alertData, createdAt: new Date() };
    inMemoryAlerts.unshift(alert);
    res.json({ message: 'Email alert simulated', alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── helper: create an alert from other controllers ──────────────────── */
const createAlert = async ({ jobId, jobName, type, message, severity = 'medium', emailSent = false }) => {
  try {
    const alertData = { jobId, jobName, type, message, severity, read: false, emailSent };
    if (isConnected()) {
      await getAlert().create(alertData);
    } else {
      inMemoryAlerts.unshift({ _id: genId(), ...alertData, createdAt: new Date() });
      if (inMemoryAlerts.length > 100) inMemoryAlerts = inMemoryAlerts.slice(0, 100);
    }
  } catch (err) {
    console.error('[Alert] createAlert error:', err.message);
  }
};

module.exports = { getAlerts, markAlertRead, markAllRead, simulateEmailAlert, createAlert };
