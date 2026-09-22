/**
 * routes/monitoring.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getLiveMonitoring,
  getSimulatorStatusHandler,
  spawnSimulatedJob,
} = require('../controllers/monitoringController');

/* Live monitoring telemetry */
router.get('/live', auth, getLiveMonitoring);

/* Simulator control & status */
router.get('/simulator/status', auth, getSimulatorStatusHandler);
router.post('/simulator/spawn', auth, spawnSimulatedJob);

module.exports = router;
