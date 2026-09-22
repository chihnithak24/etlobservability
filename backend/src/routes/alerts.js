const express = require('express');
const router = express.Router();
const { getAlerts, markAlertRead, markAllRead, simulateEmailAlert } = require('../controllers/alertController');
const auth = require('../middleware/auth');
router.get('/', auth, getAlerts);
router.put('/read-all', auth, markAllRead);
router.put('/:id/read', auth, markAlertRead);
router.post('/email', auth, simulateEmailAlert);
module.exports = router;
