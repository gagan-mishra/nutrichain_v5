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
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
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
