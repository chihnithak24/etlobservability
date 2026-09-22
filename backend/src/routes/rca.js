const express = require('express');
const router  = express.Router();
const { getRca, analyseJob } = require('../controllers/rcaController');
const auth = require('../middleware/auth');

router.get('/:jobId',          auth, getRca);       // get cached or run lazy analysis
router.post('/:jobId/analyse', auth, analyseJob);   // force re-analysis

module.exports = router;
