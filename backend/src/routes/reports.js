const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { requireContext } = require('../middleware/context');

const router = express.Router();
router.use(requireAuth, requireContext);

// Party volume (qty) by role within firm + FY
// GET /reports/party-volume?fy_id=optional
router.get('/party-volume', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.query.fy_id ? Number(req.query.fy_id) : (req.ctx.fyId || null);

    const params = [firmId];
    let sql = `
      SELECT p.id AS party_id, p.name AS party_name,
             SUM(CASE WHEN c.seller_id = p.id THEN COALESCE(c.max_qty, c.min_qty, 0) ELSE 0 END) AS seller_qty,
             SUM(CASE WHEN c.buyer_id  = p.id THEN COALESCE(c.max_qty, c.min_qty, 0) ELSE 0 END) AS buyer_qty
        FROM parties p
        JOIN contracts c ON (c.seller_id = p.id OR c.buyer_id = p.id)
       WHERE c.firm_id = ? AND c.deleted_at IS NULL`;
    if (fyId) { sql += ' AND c.fiscal_year_id = ?'; params.push(fyId); }
    sql += `
       GROUP BY p.id, p.name
       ORDER BY (seller_qty + buyer_qty) DESC, p.name ASC`;

    const [rows] = await pool.execute(sql, params);
    const out = rows.map(r => ({
      party_id: r.party_id,
      party_name: r.party_name,
      seller_qty: Number(r.seller_qty || 0),
      buyer_qty: Number(r.buyer_qty || 0),
      total_qty: Number((Number(r.seller_qty || 0) + Number(r.buyer_qty || 0)))
    }));
    res.json(out);
  } catch (e) {
    console.error('reports party-volume error:', e);
    res.status(500).json({ error: 'failed to build party volume report' });
  }
});

// Sales aggregation by period (day or month)
// GET /reports/sales?group=day|month
router.get('/sales', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const group = (req.query.group || 'month').toLowerCase();
    const fmt = group === 'day' ? '%Y-%m-%d' : '%Y-%m';
    const productId = req.query.product_id ? Number(req.query.product_id) : null;

    const params = [firmId];
    let where = 'c.firm_id = ? AND c.deleted_at IS NULL';
    if (fyId) { where += ' AND c.fiscal_year_id = ?'; params.push(fyId); }
    if (productId) { where += ' AND c.product_id = ?'; params.push(productId); }

    const sql = `
      SELECT DATE_FORMAT(c.order_date, '${fmt}') AS period,
             COUNT(*) AS trades,
             SUM(COALESCE(c.max_qty, c.min_qty, 0)) AS total_qty,
             AVG(NULLIF(c.price, 0)) AS avg_price
        FROM contracts c
       WHERE ${where}
       GROUP BY period
       ORDER BY period ASC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(r => ({
      period: r.period,
      trades: Number(r.trades || 0),
      total_qty: Number(r.total_qty || 0),
      avg_price: r.avg_price == null ? null : Number(r.avg_price)
    })));
  } catch (e) {
    console.error('reports sales error:', e);
    res.status(500).json({ error: 'failed to build sales report' });
  }
});

// Product aggregation
// GET /reports/products
router.get('/products', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const params = [firmId];
    let sql = `
      SELECT p.id AS product_id, p.name AS product_name,
             COUNT(*) AS trades,
             SUM(COALESCE(c.max_qty, c.min_qty, 0)) AS total_qty,
             AVG(NULLIF(c.price, 0)) AS avg_price
        FROM contracts c
        LEFT JOIN products p ON p.id = c.product_id
       WHERE c.firm_id = ? AND c.deleted_at IS NULL`;
    if (fyId) { sql += ' AND c.fiscal_year_id = ?'; params.push(fyId); }
    sql += ' GROUP BY p.id, p.name ORDER BY total_qty DESC, p.name ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name || '(Unspecified)',
      trades: Number(r.trades || 0),
      total_qty: Number(r.total_qty || 0),
      avg_price: r.avg_price == null ? null : Number(r.avg_price)
    })));
  } catch (e) {
    console.error('reports products error:', e);
    res.status(500).json({ error: 'failed to build product report' });
  }
});

// Transactions (detailed list)
// GET /reports/transactions?party_id=&product_id=&from=&to=
router.get('/transactions', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const partyId = req.query.party_id ? Number(req.query.party_id) : null;
    const productId = req.query.product_id ? Number(req.query.product_id) : null;
    const from = req.query.from || null;
    const to = req.query.to || null;

    const params = [firmId];
    let sql = `
      SELECT c.id, c.contract_no, c.order_date,
             s.name AS seller_name, b.name AS buyer_name,
             p.name AS product_name,
             COALESCE(c.max_qty, c.min_qty, 0) AS qty,
             c.unit, c.price,
             c.seller_brokerage, c.buyer_brokerage
        FROM contracts c
        LEFT JOIN parties s ON s.id = c.seller_id
        LEFT JOIN parties b ON b.id = c.buyer_id
        LEFT JOIN products p ON p.id = c.product_id
       WHERE c.firm_id = ? AND c.deleted_at IS NULL`;
    if (fyId) { sql += ' AND c.fiscal_year_id = ?'; params.push(fyId); }
    if (partyId) { sql += ' AND (c.seller_id = ? OR c.buyer_id = ?)'; params.push(partyId, partyId); }
    if (productId) { sql += ' AND c.product_id = ?'; params.push(productId); }
    if (from) { sql += ' AND c.order_date >= ?'; params.push(from); }
    if (to) { sql += ' AND c.order_date <= ?'; params.push(to); }
    sql += ' ORDER BY c.order_date DESC, c.id DESC';

    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(r => ({
      id: r.id,
      contract_no: r.contract_no || String(r.id),
      order_date: r.order_date,
      seller_name: r.seller_name,
      buyer_name: r.buyer_name,
      product_name: r.product_name || '',
      qty: Number(r.qty || 0),
      unit: r.unit || '',
      price: r.price == null ? null : Number(r.price),
      seller_brokerage: r.seller_brokerage == null ? null : Number(r.seller_brokerage),
      buyer_brokerage: r.buyer_brokerage == null ? null : Number(r.buyer_brokerage),
    })));
  } catch (e) {
    console.error('reports transactions error:', e);
    res.status(500).json({ error: 'failed to build transactions report' });
  }
});

// Seller price trend per party (weighted average price)
// GET /reports/party-seller-price?party_id=...&group=month
router.get('/party-seller-price', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const partyId = req.query.party_id ? Number(req.query.party_id) : null;
    if (!partyId) return res.status(400).json({ error: 'party_id required' });
    const group = (req.query.group || 'month').toLowerCase();
    const fmt = group === 'day' ? '%Y-%m-%d' : '%Y-%m';

    const params = [firmId, partyId];
    let where = 'c.firm_id = ? AND c.deleted_at IS NULL AND c.seller_id = ?';
    if (fyId) { where += ' AND c.fiscal_year_id = ?'; params.push(fyId); }

    const sql = `
      SELECT DATE_FORMAT(c.order_date, '${fmt}') AS period,
             SUM(CASE WHEN c.price IS NOT NULL THEN COALESCE(c.max_qty, c.min_qty, 0) * c.price ELSE 0 END) /
             NULLIF(SUM(CASE WHEN c.price IS NOT NULL THEN COALESCE(c.max_qty, c.min_qty, 0) ELSE 0 END), 0) AS avg_price
        FROM contracts c
       WHERE ${where}
       GROUP BY period
       ORDER BY period ASC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(r => ({ period: r.period, avg_price: r.avg_price == null ? null : Number(r.avg_price) })));
  } catch (e) {
    console.error('reports party-seller-price error:', e);
    res.status(500).json({ error: 'failed to build party seller price trend' });
  }
});

module.exports = router;
