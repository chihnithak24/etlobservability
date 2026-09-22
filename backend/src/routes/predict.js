const express = require('express');
const router  = express.Router();
const {
  predict, predictJob, getAtRiskJobs, getModelInfo,
  getPredictionHistory, preExecutePredict
} = require('../controllers/predictionController');
const auth = require('../middleware/auth');

router.get('/model',        auth, getModelInfo);          // model metadata
router.get('/at-risk',      auth, getAtRiskJobs);         // top at-risk jobs
router.get('/history',      auth, getPredictionHistory);  // stored prediction log
router.post('/pre-execute', auth, preExecutePredict);     // pre-execution prediction
router.post('/',            auth, predict);               // manual/custom prediction
router.get('/:jobId',       auth, predictJob);            // predict for a live job by ID

module.exports = router;
