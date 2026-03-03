const express = require("express");
const { pool } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function isMissingUserFirmsTable(err) {
  return err?.code === 'ER_NO_SUCH_TABLE' && String(err?.message || '').includes('user_firms');
}

/* 
  TABLE (expected):
    firms(id PK, name VARCHAR, address TEXT NULL, gst_no VARCHAR(32) NULL)
  If you haven’t added columns yet, run:
    ALTER TABLE firms
      ADD COLUMN address TEXT NULL,
      ADD COLUMN gst_no VARCHAR(32) NULL;
*/

/* -------- LIST -------- */
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    let rows;
    let useUserFirmScope = false;
    try {
      const [[cnt]] = await pool.execute('SELECT COUNT(*) AS c FROM user_firms WHERE user_id = ?', [userId]);
      useUserFirmScope = (cnt?.c || 0) > 0;
    } catch (e) {
      if (!isMissingUserFirmsTable(e)) throw e;
      console.warn('user_firms table missing; falling back to all firms');
    }

    if (useUserFirmScope) {
      [rows] = await pool.execute(
        `SELECT f.id, f.name, f.address, f.gst_no
           FROM firms f
           JOIN user_firms uf ON uf.firm_id = f.id AND uf.user_id = ?
          ORDER BY f.name ASC`,
        [userId]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT id, name, address, gst_no FROM firms ORDER BY name ASC`
      );
    }
    res.json(rows);
  } catch (e) {
    console.error('firms GET error:', e);
    res.status(500).json({ error: 'Failed to fetch firms' });
  }
});

/* -------- CREATE -------- */
router.post("/", async (req, res) => {
  try {
    const f = req.body || {};
    const name = (f.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });

    const [r] = await pool.execute(
      `INSERT INTO firms (name, address, gst_no) VALUES (?,?,?)`,
      [name, f.address || null, f.gst_no || null]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    console.error('firms POST error:', e);
    res.status(500).json({ error: 'Failed to create firm' });
  }
});

/* -------- UPDATE -------- */
router.put("/:id", async (req, res) => {
  try {
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
  } catch (e) {
    console.error('firms PUT error:', e);
    res.status(500).json({ error: 'Failed to update firm' });
  }
});

/* -------- DELETE -------- */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`DELETE FROM firms WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('firms DELETE error:', e);
    res.status(500).json({ error: 'Failed to delete firm' });
  }
});

/* -------- FISCAL YEARS (unchanged) -------- */
router.get("/fiscal-years", async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, label, start_date AS startDate, end_date AS endDate
         FROM fiscal_years
        ORDER BY start_date DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error('firms GET fiscal-years error:', e);
    res.status(500).json({ error: 'Failed to fetch fiscal years' });
  }
});

module.exports = router;
