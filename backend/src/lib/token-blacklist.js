// In-memory token blacklist for revoked JWTs.
// Entries auto-expire matching their JWT expiry.
const blacklist = new Map(); // jti -> expiresAt (ms)

function add(decoded) {
  if (!decoded?.jti) return;
  blacklist.set(decoded.jti, (decoded.exp || 0) * 1000);
}

function has(jti) {
  return blacklist.has(jti);
}

// Purge expired entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of blacklist) {
    if (exp < now) blacklist.delete(jti);
  }
}, 60 * 60 * 1000).unref();

module.exports = { add, has };
