const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { validate, rules } = require('../middleware/validate');

// In-memory users fallback (passwords comply with: min 8 chars, 1 uppercase, 1 lowercase, 1 special char)
const inMemoryUsers = [
  { _id: '1', name: 'Admin User',  email: 'admin@etl.com',  password: bcrypt.hashSync('Admin@123',  10), role: 'admin',  isFirstLogin: true, otpCode: null, otpExpiresAt: null },
  { _id: '2', name: 'Viewer User', email: 'viewer@etl.com', password: bcrypt.hashSync('Viewer@123', 10), role: 'viewer', isFirstLogin: true, otpCode: null, otpExpiresAt: null }
];

let User;
try { User = require('../models/User'); } catch {}

// Password Strength Rule: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 special character
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const validateLogin = validate({
  email:    [rules.required, rules.isEmail],
  password: [rules.required, rules.minLen(8), rules.maxLen(128)],
});

/**
 * Generate a 6-digit numeric OTP
 */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/* ── POST /api/auth/login ────────────────────────────────────────── */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Check password strength
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long and contain 1 capital letter, 1 small letter, and 1 special character (!@#$%).'
      });
    }

    let user = null;
    if (User && typeof User.findOne === 'function') {
      try { user = await User.findOne({ email: cleanEmail }); } catch { /* ignore */ }
    }
    if (!user) user = inMemoryUsers.find(u => u.email === cleanEmail);

    const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    const hashToCompare = user ? user.password : dummyHash;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const forceOtp = req.body.forceOtp === true || req.body.forceOtp === 'true';
    if (forceOtp || user.isFirstLogin === true || user.isFirstLogin === undefined) {
      const otpCode = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      if (user.save) {
        user.otpCode = otpCode;
        user.otpExpiresAt = otpExpiresAt;
        await user.save();
      } else {
        user.otpCode = otpCode;
        user.otpExpiresAt = otpExpiresAt;
      }

      console.log(`[Auth] Security OTP generated for ${user.email}: ${otpCode}`);

      return res.json({
        requiresOtp: true,
        email: user.email,
        message: 'Security Check: 6-digit OTP code sent to your email.',
        otpDemo: otpCode
      });
    }

    // Standard returning user: Issue JWT immediately
    const jwtSecret = process.env.JWT_SECRET || 'etl_super_secret_jwt_key_2026';
    const token = jwt.sign(
      { id: user._id || user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id || user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

/* ── POST /api/auth/verify-otp ────────────────────────────────────── */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = null;
    if (User && typeof User.findOne === 'function') {
      try { user = await User.findOne({ email: cleanEmail }); } catch {}
    }
    if (!user) user = inMemoryUsers.find(u => u.email === cleanEmail);

    if (!user || !user.otpCode) {
      return res.status(400).json({ message: 'No pending OTP verification found for this account' });
    }

    // Verify expiration
    if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
      return res.status(400).json({ message: 'Security OTP has expired. Please request a new OTP.' });
    }

    // Verify OTP match
    if (String(user.otpCode).trim() !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid OTP code. Please check and try again.' });
    }

    // Mark as verified & no longer first-time login
    if (user.save) {
      user.isFirstLogin = false;
      user.otpCode = null;
      user.otpExpiresAt = null;
      await user.save();
    } else {
      user.isFirstLogin = false;
      user.otpCode = null;
      user.otpExpiresAt = null;
    }

    const jwtSecret = process.env.JWT_SECRET || 'etl_super_secret_jwt_key_2026';
    const token = jwt.sign(
      { id: user._id || user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    console.log(`[Auth] OTP Verified successfully for ${user.email}`);

    res.json({
      success: true,
      token,
      user: { id: user._id || user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[Auth] Verify OTP error:', err);
    res.status(500).json({ message: 'OTP verification failed' });
  }
};

/* ── POST /api/auth/resend-otp ────────────────────────────────────── */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const cleanEmail = email.toLowerCase().trim();
    let user = null;
    if (User && typeof User.findOne === 'function') {
      try { user = await User.findOne({ email: cleanEmail }); } catch {}
    }
    if (!user) user = inMemoryUsers.find(u => u.email === cleanEmail);

    if (!user) return res.status(404).json({ message: 'User account not found' });

    const freshOtp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (user.save) {
      user.otpCode = freshOtp;
      user.otpExpiresAt = otpExpiresAt;
      await user.save();
    } else {
      user.otpCode = freshOtp;
      user.otpExpiresAt = otpExpiresAt;
    }

    console.log(`[Auth] Resent fresh Security OTP for ${user.email}: ${freshOtp}`);

    res.json({
      message: 'A fresh Security OTP has been sent to your email.',
      otpDemo: freshOtp
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not resend OTP' });
  }
};

module.exports = { login, validateLogin, verifyOtp, resendOtp };
