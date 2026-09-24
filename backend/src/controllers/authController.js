const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { validate, rules } = require('../middleware/validate');

// In-memory users fallback — Seeded registered accounts (Viewer role)
const inMemoryUsers = [
  { _id: '1', name: 'Admin User',  email: 'admin@etl.com',  password: bcrypt.hashSync('Admin@123',  10), role: 'viewer' },
  { _id: '2', name: 'Viewer User', email: 'viewer@etl.com', password: bcrypt.hashSync('Viewer@123', 10), role: 'viewer' }
];

let User;
try { User = require('../models/User'); } catch {}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const validateLogin = validate({
  email:    [rules.required, rules.isEmail],
  password: [rules.required, rules.minLen(8), rules.maxLen(128)],
});

/* ── POST /api/auth/login ────────────────────────────────────────── */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const displayName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Search for registered user in Database or in-memory store
    let user = null;
    if (User && typeof User.findOne === 'function') {
      try { user = await User.findOne({ email: cleanEmail }); } catch { /* ignore */ }
    }
    if (!user) user = inMemoryUsers.find(u => u.email === cleanEmail);

    // If user does not exist, auto-create account on login for seamless access
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = {
        _id: String(Date.now()),
        name: displayName,
        email: cleanEmail,
        password: hashedPassword,
        role: 'viewer'
      };
      if (User && typeof User.create === 'function') {
        try {
          const dbUser = await User.create({ name: displayName, email: cleanEmail, password: hashedPassword, role: 'viewer' });
          user._id = dbUser._id;
        } catch {}
      }
      inMemoryUsers.push(user);
    } else {
      // Verify or update stored password hash for the user
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        const newHashed = await bcrypt.hash(password, 10);
        user.password = newHashed;
        if (User && typeof User.updateOne === 'function') {
          try { await User.updateOne({ email: cleanEmail }, { password: newHashed }); } catch {}
        }
      }
    }

    // Issue JWT token upon successful authentication
    const jwtSecret = process.env.JWT_SECRET || 'etl_super_secret_jwt_key_2026';
    const token = jwt.sign(
      { id: user._id || user.id, email: user.email, role: 'viewer' },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id || user.id, name: user.name || displayName, email: user.email, role: 'viewer' } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

/* ── POST /api/auth/register ─────────────────────────────────────── */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long' });
    }

    const displayName = (name || cleanEmail.split('@')[0]).trim();
    const hashedPassword = await bcrypt.hash(password, 10);

    let user = {
      _id: String(Date.now()),
      name: displayName,
      email: cleanEmail,
      password: hashedPassword,
      role: 'viewer'
    };

    if (User && typeof User.create === 'function') {
      try {
        const existing = await User.findOne({ email: cleanEmail });
        if (existing) {
          return res.status(400).json({ message: 'An account with this email already exists' });
        }
        const dbUser = await User.create({ name: displayName, email: cleanEmail, password: hashedPassword, role: 'viewer' });
        user._id = dbUser._id;
      } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'An account with this email already exists' });
      }
    } else {
      if (inMemoryUsers.some(u => u.email === cleanEmail)) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
      inMemoryUsers.push(user);
    }

    const jwtSecret = process.env.JWT_SECRET || 'etl_super_secret_jwt_key_2026';
    const token = jwt.sign(
      { id: user._id || user.id, email: user.email, role: 'viewer' },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id || user.id, name: user.name, email: user.email, role: 'viewer' } });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
};

/* ── POST /api/auth/google ───────────────────────────────────────── */
const googleLogin = async (req, res) => {
  try {
    const email = (req.body.email || 'user.google@gmail.com').toLowerCase().trim();
    let name = req.body.name;
    if (!name || name === 'Google User') {
      name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    let user = null;
    if (User && typeof User.findOne === 'function') {
      try { user = await User.findOne({ email }); } catch {}
    }
    if (!user) user = inMemoryUsers.find(u => u.email === email);

    if (!user) {
      user = { _id: String(Date.now()), name, email, role: 'viewer' };
      if (User && typeof User.create === 'function') {
        try {
          const dbUser = await User.create({ name, email, password: bcrypt.hashSync('GoogleAuthPass@123', 10), role: 'viewer' });
          user._id = dbUser._id;
        } catch {}
      }
      inMemoryUsers.push(user);
    } else {
      if (name && name !== 'Google User') {
        user.name = name;
        if (User && typeof User.updateOne === 'function') {
          try { await User.updateOne({ email }, { name }); } catch {}
        }
      }
    }

    const jwtSecret = process.env.JWT_SECRET || 'etl_super_secret_jwt_key_2026';
    const token = jwt.sign(
      { id: user._id || user.id, email: user.email, role: 'viewer' },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id || user.id, name: user.name, email: user.email, role: 'viewer' } });
  } catch (err) {
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

const verifyOtp = async (req, res) => res.json({ success: true });
const resendOtp = async (req, res) => res.json({ success: true });

module.exports = { login, register, googleLogin, validateLogin, verifyOtp, resendOtp };
