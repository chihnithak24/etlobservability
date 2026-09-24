const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Support synthetic/fallback tokens used during offline mode or sandbox viewer access
  if (token.startsWith('google-auth-token-') || token.startsWith('demo-viewer-token-')) {
    req.user = { id: 'demo-user', email: 'viewer@etl.com', role: 'viewer' };
    return next();
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'etl_super_secret_jwt_key_2026';
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ message });
  }
};

module.exports = authMiddleware;
