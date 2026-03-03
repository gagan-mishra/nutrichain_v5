const jwt = require('jsonwebtoken');
const { has: isBlacklisted } = require('../lib/token-blacklist');

function requireAuth(req, res, next) {
  // Try httpOnly cookie first, fall back to Authorization header
  let token = req.cookies?.token;
  if (!token) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    token = header.slice(7);
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.jti && isBlacklisted(payload.jti)) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAuth };
