const jwt = require('jsonwebtoken');
const { models } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'shubhsajawat_super_secret_jwt_key_2026';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token. Please log in again.' });
    }

    try {
      let user = null;
      try {
        user = await models.User.findById(decoded.id);
      } catch (err) {}
      
      if (!user) {
        user = await models.User.findOne({
          $or: [
            { phone: decoded.id },
            { email: decoded.id }
          ]
        });
      }

      if (!user || user.status !== 'Active') {
        return res.status(403).json({ error: 'User account not found or deactivated.' });
      }

      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      };

      next();
    } catch (e) {
      return res.status(500).json({ error: 'Authentication verification error.' });
    }
  });
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Permission Denied: Your role (${req.user.role}) is not authorized to perform this action. Required: ${allowedRoles.join(' or ')}.` 
      });
    }

    next();
  };
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireRole
};
