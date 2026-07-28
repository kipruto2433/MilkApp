const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const db = require('../config/db');

dotenv.config();

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    db.query('SELECT role, status FROM users WHERE id = $1', [payload.id])
      .then((result) => {
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Account no longer exists' });
        }
        if (result.rows[0].status === 'suspended') {
          return res.status(403).json({ error: 'This account has been suspended. Please contact an administrator.' });
        }
        req.user = { ...payload, role: result.rows[0].role };
        next();
      })
      .catch((error) => {
        console.error('Authentication status check failed:', error.message);
        res.status(500).json({ error: 'Unable to validate account status' });
      });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
};
