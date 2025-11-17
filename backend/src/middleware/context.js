function requireContext(req, res, next) {
  // Enforce firm scoping: default to the authenticated user's firm; ignore spoofed headers
  const userFirmId = req.user?.firmId ? Number(req.user.firmId) : undefined;
  // Allow header to pick FY, but firmId must match the user
  const headerFirmId = req.header('X-Firm-Id') ? Number(req.header('X-Firm-Id')) : undefined;
  const fyId = req.header('X-Fy-Id') ? Number(req.header('X-Fy-Id')) : undefined;

  const firmId = userFirmId || headerFirmId;
  if (!firmId) return res.status(400).json({ error: 'Missing firm context' });
  if (headerFirmId && userFirmId && headerFirmId !== userFirmId) {
    return res.status(403).json({ error: 'Firm mismatch' });
  }

  req.ctx = { firmId, fyId };
  next();
}
module.exports = { requireContext };
