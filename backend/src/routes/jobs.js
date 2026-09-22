const express = require('express');
const router = express.Router();

const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  retryJob,
  validateCreateJob,
  validateUpdateJob
} = require('../controllers/jobController');

const auth = require('../middleware/auth');

router.get('/', auth, getJobs);
router.get('/:id', auth, getJobById);
router.post('/', auth, validateCreateJob, createJob);
router.put('/:id', auth, validateUpdateJob, updateJob);
router.delete('/:id', auth, deleteJob);
router.post('/:id/retry', auth, retryJob);

module.exports = router;