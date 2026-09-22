/**
 * monitoringController.js
 * 
 * Exposes live monitoring endpoints and simulator controls.
 */

'use strict';

const { getLiveMonitoringData, getSimulatorStatus, spawnJob } = require('../services/simulatorService');

/* ── GET /api/monitoring/live ────────────────────────────────────────── */
const getLiveMonitoring = async (req, res) => {
  try {
    const data = await getLiveMonitoringData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/simulator/status ───────────────────────────────────────── */
const getSimulatorStatusHandler = async (req, res) => {
  try {
    const status = getSimulatorStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/simulator/spawn ───────────────────────────────────────── */
const spawnSimulatedJob = async (req, res) => {
  try {
    const forceFailure = req.body?.forceFailure === true;
    const job = await spawnJob(forceFailure);
    res.status(201).json({ message: 'Simulated job spawned', job });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getLiveMonitoring,
  getSimulatorStatusHandler,
  spawnSimulatedJob,
};
