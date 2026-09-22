/**
 * routes/airflow.js
 *
 * All routes are protected by the JWT auth middleware.
 * POST routes that mutate Airflow state (trigger / clear) are also rate-limited
 * tightly at the Express level to prevent accidental looping.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const {
  getDags,
  getDagRuns,
  getDagRunDetail,
  getTaskInstances,
  triggerRun,
  clearRun,
  getAllRuns,
  getEvents,
  getSyncStatusHandler,
  getAirflowAnalytics,
  pingAirflow,
} = require('../controllers/airflowController');

/* Read-only — standard API rate limit (200 req/min) already applied globally */
router.get('/dags',                                    auth, getDags);
router.get('/dags/:dagId/runs',                        auth, getDagRuns);
router.get('/dags/:dagId/runs/:dagRunId',              auth, getDagRunDetail);
router.get('/dags/:dagId/runs/:dagRunId/tasks',        auth, getTaskInstances);
router.get('/runs',                                    auth, getAllRuns);
router.get('/events',                                  auth, getEvents);
router.get('/status',                                  auth, getSyncStatusHandler);
router.get('/ping',                                    auth, pingAirflow);
router.get('/analytics',                               auth, getAirflowAnalytics);

/* Mutating — extra tight limit: 10 triggers/min per IP */
router.post('/dags/:dagId/trigger',                    auth, rateLimiter({ max: 10, windowMs: 60_000 }), triggerRun);
router.post('/dags/:dagId/runs/:dagRunId/clear',       auth, rateLimiter({ max: 10, windowMs: 60_000 }), clearRun);

module.exports = router;
