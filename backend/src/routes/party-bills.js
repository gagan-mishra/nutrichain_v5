const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { requireContext } = require('../middleware/context');

const router = express.Router();
router.use(requireAuth, requireContext);

// CREATE
router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.party_id) return res.status(400).json({ error: 'party_id required' });
  if (!b.from_date || !b.to_date || !b.bill_date) {
    return res.status(400).json({ error: 'from_date, to_date, bill_date required' });
  }
  const sql = `
    INSERT INTO party_bills
      (firm_id, fiscal_year_id, party_id, bill_no, from_date, to_date, bill_date, brokerage)
    VALUES (?,?,?,?,?,?,?,?)`;
  const params = [
    req.ctx.firmId,
    b.fiscal_year_id || req.ctx.fyId || null,
    b.party_id,
    b.bill_no || null,
    b.from_date,
    b.to_date,
    b.bill_date,
    b.brokerage || 0,
  ];
  const [r] = await pool.execute(sql, params);
  res.json({ id: r.insertId });
});

// UPDATE
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const sql = `
    UPDATE party_bills SET
      party_id = ?, bill_no = ?, from_date = ?, to_date = ?, bill_date = ?, brokerage = ?
    WHERE id = ? AND firm_id = ?`;
  const params = [
    b.party_id,
    b.bill_no || null,
    b.from_date,
    b.to_date,
    b.bill_date,
    b.brokerage || 0,
    id,
    req.ctx.firmId,
  ];
  const [r] = await pool.execute(sql, params);
  if (!r.affectedRows) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// LIST (basic, optional filters)
router.get('/', async (req, res) => {
  const partyId = req.query.party_id ? Number(req.query.party_id) : null;
  const { firmId, fyId } = req.ctx;
  const params = [firmId];
  let sql = `
    SELECT pb.*, p.name AS party_name
    FROM party_bills pb
    JOIN parties p ON p.id = pb.party_id
    WHERE pb.firm_id = ?`;
  if (fyId) { sql += ' AND pb.fiscal_year_id = ?'; params.push(fyId); }
  if (partyId) { sql += ' AND pb.party_id = ?'; params.push(partyId); }
  sql += ' ORDER BY pb.bill_date DESC, pb.id DESC';
  const [rows] = await pool.execute(sql, params);
  res.json(rows);
});

// DELETE
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [r] = await pool.execute('DELETE FROM party_bills WHERE id = ? AND firm_id = ?', [id, req.ctx.firmId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

module.exports = router;

