// const express = require('express');
// const { pool } = require('../lib/db');
// const { requireAuth } = require('../middleware/auth');

// const router = express.Router();
// router.use(requireAuth);

// router.get('/', async (_req, res) => {
//   const [rows] = await pool.execute('SELECT id, name FROM firms ORDER BY name ASC');
//   res.json(rows);
// });

// router.get('/fiscal-years', async (_req, res) => {
//   const [rows] = await pool.execute('SELECT id, label, start_date AS startDate, end_date AS endDate FROM fiscal_years ORDER BY start_date DESC');
//   res.json(rows);
// });

// module.exports = router;


const express = require("express");
const { pool } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

/* 
  TABLE (expected):
    firms(id PK, name VARCHAR, address TEXT NULL, gst_no VARCHAR(32) NULL)
  If you haven’t added columns yet, run:
    ALTER TABLE firms
      ADD COLUMN address TEXT NULL,
      ADD COLUMN gst_no VARCHAR(32) NULL;
*/

/* -------- LIST -------- */
router.get("/", async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, name, address, gst_no
       FROM firms
      ORDER BY name ASC`
  );
  res.json(rows);
});

/* -------- CREATE -------- */
router.post("/", async (req, res) => {
  const f = req.body || {};
  const name = (f.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });

  const [r] = await pool.execute(
    `INSERT INTO firms (name, address, gst_no) VALUES (?,?,?)`,
    [name, f.address || null, f.gst_no || null]
  );
  res.json({ id: r.insertId });
});

/* -------- UPDATE -------- */
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const f = req.body || {};
  const name = (f.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });

  const [r] = await pool.execute(
    `UPDATE firms SET name = ?, address = ?, gst_no = ? WHERE id = ?`,
    [name, f.address || null, f.gst_no || null, id]
  );
  if (!r.affectedRows) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

/* -------- DELETE -------- */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  // (Optional) prevent delete if referenced by contracts
  // await pool.execute(`DELETE FROM firms WHERE id = ?`, [id]);
  await pool.execute(`DELETE FROM firms WHERE id = ?`, [id]);
  res.json({ ok: true });
});

/* -------- FISCAL YEARS (unchanged) -------- */
router.get("/fiscal-years", async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, label, start_date AS startDate, end_date AS endDate
       FROM fiscal_years
      ORDER BY start_date DESC`
  );
  res.json(rows);
});

module.exports = router;
