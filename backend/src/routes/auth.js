const express = require('express');
const router  = express.Router();
const { login, validateLogin, verifyOtp, resendOtp } = require('../controllers/authController');

router.post('/login', validateLogin, login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

module.exports = router;
