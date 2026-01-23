const jwt = require('jsonwebtoken');
const { getUserById } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRY = '24h';

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      is_admin: user.is_admin,
      is_user: user.is_user
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Extract token from request
 * Checks Authorization header and cookies
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

/**
 * Authentication middleware
 * Requires valid JWT token
 */
function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Autentifikacija je obavezna' });
  }

  try {
    const decoded = verifyToken(token);

    // Get fresh user data from database
    const user = getUserById.get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Korisnik nije pronadjen' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: Boolean(user.is_admin),
      is_user: Boolean(user.is_user)
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesija je istekla. Prijavite se ponovo.' });
    }
    return res.status(401).json({ error: 'Nevazeci token' });
  }
}

/**
 * Require admin role middleware
 * Must be used after authenticate middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autentifikacija je obavezna' });
  }

  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Pristup dozvoljen samo administratorima' });
  }

  next();
}

/**
 * Require user role middleware
 * Must be used after authenticate middleware
 */
function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autentifikacija je obavezna' });
  }

  if (!req.user.is_user) {
    return res.status(403).json({ error: 'Pristup nije dozvoljen' });
  }

  next();
}

/**
 * Require admin or self access
 * Allows admin to access any resource, or user to access their own
 * @param {Function} getResourceUserId - Function to get user ID from request
 */
function requireAdminOrSelf(getResourceUserId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentifikacija je obavezna' });
    }

    const resourceUserId = getResourceUserId(req);

    if (req.user.is_admin || req.user.id === resourceUserId) {
      return next();
    }

    return res.status(403).json({ error: 'Nemate dozvolu za pristup ovom resursu' });
  };
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  requireAdmin,
  requireUser,
  requireAdminOrSelf
};
