const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  getRecoveryStats,
  getRecoveryForJob,
  triggerRecoveryForJob,
} = require('../controllers/recoveryController');

router.get('/stats',            auth, getRecoveryStats);
router.get('/:jobId',           auth, getRecoveryForJob);
router.post('/:jobId/trigger',  auth, triggerRecoveryForJob);

module.exports = router;
