const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Secure, one-time bootstrap endpoint to create the first admin user.
// Requirements:
//  - Request must include a setup token matching process.env.SETUP_TOKEN
//  - DB must not already have users (bootstrap only)
// You can also use the CLI script scripts/create-admin.js instead.
router.post('/seed-admin', async (req, res) => {
  try {
    const provided = req.header('X-Setup-Token') || req.body?.setupToken || req.query?.setup_token;
    if (!process.env.SETUP_TOKEN || provided !== process.env.SETUP_TOKEN) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [[row]] = await pool.execute('SELECT COUNT(1) AS cnt FROM users');
    if (row.cnt > 0) {
      return res.status(409).json({ error: 'Already initialized' });
    }

    const { username, password, firmId } = req.body || {};
    if (!username || !password || !firmId) {
      return res.status(400).json({ error: 'username, password, firmId required' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO users (username, password_hash, firm_id) VALUES (?,?,?)',
      [username, hash, firmId]
    );
    res.json({ ok: true, username, firmId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// login
// Simple in-memory rate limit for login (per IP and per username)
const ipAttempts = new Map();
const userAttempts = new Map();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_IP = 30;
const MAX_PER_USER = 8;

function pushAttempt(map, key){
  const now = Date.now();
  const arr = (map.get(key) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  map.set(key, arr);
  return arr.length;
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (pushAttempt(ipAttempts, ip) > MAX_PER_IP) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    if (username && pushAttempt(userAttempts, String(username).toLowerCase()) > MAX_PER_USER) return res.status(429).json({ error: 'Too many attempts for this user. Try again later.' });
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, firmId: user.firm_id }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, username: user.username, firmId: user.firm_id } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// Change password (authenticated)
// body: { currentPassword, newPassword }
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });

    const [rows] = await pool.execute('SELECT id, password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Securely switch firm: verifies access then returns a fresh token with that firmId
router.post('/switch-firm', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetFirmId = Number(req.body?.firmId);
    if (!targetFirmId) return res.status(400).json({ error: 'firmId required' });

    // If user_firms table has rows for this user, enforce membership. If none, allow all (single-user-on-all-firms case).
    const [[cntAll]] = await pool.execute('SELECT COUNT(*) AS c FROM user_firms WHERE user_id = ?', [userId]);
    if ((cntAll?.c || 0) > 0) {
      const [[row]] = await pool.execute('SELECT 1 FROM user_firms WHERE user_id = ? AND firm_id = ? LIMIT 1', [userId, targetFirmId]);
      if (!row) return res.status(403).json({ error: 'Not allowed for this firm' });
    }

    // Confirm firm exists
    const [[firm]] = await pool.execute('SELECT id FROM firms WHERE id = ? LIMIT 1', [targetFirmId]);
    if (!firm) return res.status(404).json({ error: 'Firm not found' });

    const token = jwt.sign({ id: req.user.id, username: req.user.username, firmId: targetFirmId }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: req.user.id, username: req.user.username, firmId: targetFirmId } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
