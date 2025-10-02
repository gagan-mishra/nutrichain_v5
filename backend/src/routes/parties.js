const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * Existing lightweight list for dropdowns:
 * GET /parties?for=seller|buyer
 */
router.get('/', async (req, res) => {
  const forUse = (req.query.for || '').toUpperCase(); // SELLER | BUYER
  let sql = `SELECT id, name, role FROM parties`;
  const conds = [];
  if (forUse === 'SELLER') conds.push(`role IN ('SELLER','BOTH')`);
  if (forUse === 'BUYER')  conds.push(`role IN ('BUYER','BOTH')`);
  if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
  sql += ` ORDER BY name ASC`;

  const [rows] = await pool.execute(sql);
  res.json(rows);
});

/**
 * Create party (with up to 6 emails)
 * POST /parties
 */
// POST /parties
router.post('/', async (req, res) => {
  const p = req.body || {};
  const sql = `
    INSERT INTO parties
    (firm_id, name, address, contact, gst_no, gst_type, cgst_rate, sgst_rate, igst_rate, role)
    VALUES (?,?,?,?,?,?,?,?,?,?)`;
  const params = [
    null,                      // 👈 global party (no firm binding)
    p.name,
    p.address || null,
    p.contact || null,
    p.gst_no || null,
    p.gst_type || 'INTRA',
    p.cgst_rate || 0,
    p.sgst_rate || 0,
    p.igst_rate || 0,
    p.role || 'BOTH',
  ];

  const [r] = await pool.execute(sql, params);

  // emails
  const emails = Array.isArray(p.emails) ? p.emails.filter(Boolean).slice(0, 6) : [];
  if (emails.length) {
    const values = emails.map(() => '(?, ?)').join(', ');
    const flat = emails.flatMap((e) => [r.insertId, e]);
    await pool.execute(`INSERT INTO party_emails (party_id, email) VALUES ${values}`, flat);
  }
  res.json({ id: r.insertId });
});


/**
 * Full registry list (with emails)
 * GET /parties/registry
 */
router.get('/registry', async (_req, res) => {
  // get parties
  const [parties] = await pool.execute(`
    SELECT id, name, address, contact, gst_no, gst_type, cgst_rate, sgst_rate, igst_rate, role
    FROM parties ORDER BY name ASC
  `);
  // get emails and group
  const [emailRows] = await pool.execute(`SELECT party_id, email FROM party_emails ORDER BY id ASC`);
  const byParty = {};
  for (const row of emailRows) {
    byParty[row.party_id] = byParty[row.party_id] || [];
    byParty[row.party_id].push(row.email);
  }
  const out = parties.map(p => ({ ...p, emails: byParty[p.id] || [] }));
  res.json(out);
});

/**
 * Update party
 * PUT /parties/:id
 */
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  const sql = `
    UPDATE parties SET
      name = ?, address = ?, contact = ?,
      gst_no = ?, gst_type = ?, cgst_rate = ?, sgst_rate = ?, igst_rate = ?,
      role = ?
    WHERE id = ?`;
  const params = [
    p.name, p.address || null, p.contact || null,
    p.gst_no || null, p.gst_type || 'INTRA',
    p.cgst_rate || 0, p.sgst_rate || 0, p.igst_rate || 0,
    p.role || 'BOTH',
    id
  ];
  const [r] = await pool.execute(sql, params);

  // replace emails
  await pool.execute(`DELETE FROM party_emails WHERE party_id = ?`, [id]);
  const emails = Array.isArray(p.emails) ? p.emails.filter(Boolean).slice(0, 6) : [];
  if (emails.length) {
    const values = emails.map(() => '(?, ?)').join(', ');
    const flat = emails.flatMap((e) => [id, e]);
    await pool.execute(`INSERT INTO party_emails (party_id, email) VALUES ${values}`, flat);
  }

  res.json({ ok: true, affected: r.affectedRows });
});

// Deactivate party (preferred)
router.patch('/:id/deactivate', async (req, res) => {
  const id = Number(req.params.id);
  await pool.execute('UPDATE parties SET is_active = 0 WHERE id = ?', [id]);
  res.json({ ok: true });
});

// Delete party (only if no references)
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);

  // any referencing contracts (soft-deleted or not) will block FK
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM contracts WHERE seller_id = ? OR buyer_id = ?',
    [id, id]
  );
  if (rows[0].cnt > 0) {
    return res.status(409).json({
      error: 'Party is referenced by contracts. Deactivate it instead, or purge the contracts first.'
    });
  }

  await pool.execute('DELETE FROM parties WHERE id = ?', [id]);
  res.json({ ok: true });
});

module.exports = router;
