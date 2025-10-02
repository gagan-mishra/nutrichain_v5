const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /products
 *  - /products?active=1 -> only active products
 *  - /products?all=1    -> all products (default)
 * Always returns is_active so the UI can render status.
 */
router.get('/', async (req, res) => {
  const activeOnly = String(req.query.active || '') === '1';
  const all = String(req.query.all || '1') === '1' || !activeOnly;

  let sql = `SELECT id, name, unit, hsn_code, is_active FROM products `;
  const params = [];
  if (activeOnly && !all) {
    sql += `WHERE is_active = 1 `;
  }
  sql += `ORDER BY name ASC`;

  const [rows] = await pool.execute(sql, params);
  res.json(rows);
});

/**
 * POST /products
 * Creates a new product. Defaults to is_active = 1 unless provided.
 */
router.post('/', async (req, res) => {
  const p = req.body || {};
  if (!p.name) return res.status(400).json({ error: 'name required' });

  const isActive = p.is_active == null ? 1 : (p.is_active ? 1 : 0);

  const [r] = await pool.execute(
    `INSERT INTO products (name, unit, hsn_code, is_active) VALUES (?,?,?,?)`,
    [p.name, p.unit || null, p.hsn_code || null, isActive]
  );
  res.json({ id: r.insertId });
});

/**
 * PUT /products/:id
 * Updates product including is_active.
 */
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (!p.name) return res.status(400).json({ error: 'name required' });

  await pool.execute(
    `UPDATE products
       SET name = ?, unit = ?, hsn_code = ?, is_active = ?
     WHERE id = ?`,
    [p.name, p.unit || null, p.hsn_code || null, p.is_active ? 1 : 0, id]
  );
  res.json({ ok: true });
});

/**
 * PATCH /products/:id/activate
 * PATCH /products/:id/deactivate
 */
router.patch('/:id/activate', async (req, res) => {
  const id = Number(req.params.id);
  await pool.execute(`UPDATE products SET is_active = 1 WHERE id = ?`, [id]);
  res.json({ ok: true });
});

router.patch('/:id/deactivate', async (req, res) => {
  const id = Number(req.params.id);
  await pool.execute(`UPDATE products SET is_active = 0 WHERE id = ?`, [id]);
  res.json({ ok: true });
});

/**
 * DELETE /products/:id
 * Hard delete. If referenced by contracts, return 409 so the UI can deactivate instead.
 */
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await pool.execute(`DELETE FROM products WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    // MySQL FK error codes vary by dialect; ER_ROW_IS_REFERENCED_2 is common.
    const code = err && (err.code || err.sqlState || '');
    // Send a clean 409 so the frontend can gracefully deactivate.
    return res.status(409).json({ error: 'product is referenced by other records' });
  }
});

module.exports = router;
