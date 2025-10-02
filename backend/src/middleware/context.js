function requireContext(req, res, next) {
  const firmId = Number(req.header('X-Firm-Id'));
  const fyId = req.header('X-Fy-Id') ? Number(req.header('X-Fy-Id')) : undefined;
  if (!firmId) return res.status(400).json({ error: 'Missing X-Firm-Id header' });
  req.ctx = { firmId, fyId };
  next();
}
module.exports = { requireContext };
