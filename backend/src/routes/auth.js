const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../lib/db');

const router = express.Router();

// one-time helper to create or reset an admin user
router.post('/seed-admin', async (req, res) => {
  try {
    const { username = 'admin', password = 'password123', firmId = 1 } = req.body || {};
    const hash = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO users (username, password_hash, firm_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), firm_id=VALUES(firm_id)',
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
