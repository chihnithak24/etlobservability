const express = require('express');
const router  = express.Router();
const { getLogs, getLogStats, getLogsByJob } = require('../controllers/logController');
const auth = require('../middleware/auth');

router.get('/stats',   auth, getLogStats);    // must be before /:jobId
router.get('/',        auth, getLogs);
router.get('/:jobId',  auth, getLogsByJob);

module.exports = router;
