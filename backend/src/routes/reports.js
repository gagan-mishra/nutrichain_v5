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

// Aging report: outstanding buckets per party as of a date
// GET /reports/aging?party_id=&as_of=YYYY-MM-DD
router.get('/aging', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const partyId = req.query.party_id ? Number(req.query.party_id) : null;
    const asOf = req.query.as_of || toDateStr(new Date());
    const defaultTermDays = Number(process.env.BILL_DUE_DAYS || 30);

    const params = [firmId];
    let sql = `
      SELECT pb.* , p.name AS party_name
        FROM party_bills pb
        JOIN parties p ON p.id = pb.party_id
       WHERE pb.firm_id = ?`;
    if (fyId) { sql += ' AND (pb.fiscal_year_id = ? OR pb.fiscal_year_id IS NULL)'; params.push(fyId); }
    if (partyId) { sql += ' AND pb.party_id = ?'; params.push(partyId); }
    sql += ' ORDER BY pb.party_id ASC, pb.bill_date ASC';
    const [bills] = await pool.execute(sql, params);

    // Group by party
    const byParty = new Map();
    for (const bill of bills) {
      const [[rec]] = await pool.execute(
        `SELECT COALESCE(SUM(amount),0) AS received FROM party_bill_receipts WHERE firm_id = ? AND party_bill_id = ? AND receive_date <= ?`,
        [firmId, bill.id, asOf]
      );
      const total = await computeBillTotal(pool, firmId, bill);
      const outstanding = Math.max(0, Number(total) - Number(rec?.received || 0));
      if (outstanding <= 0) continue;

      const billDate = new Date(toDateStr(bill.bill_date));
      // Per-party due days if column present; else default
      let termDays = defaultTermDays;
      try {
        const [[cd]] = await pool.execute(`SELECT due_days FROM parties WHERE id = ? LIMIT 1`, [bill.party_id]);
        if (cd && cd.due_days != null) termDays = Number(cd.due_days) || defaultTermDays;
      } catch (_) { /* column may not exist; ignore */ }
      const due = new Date(billDate.getTime()); due.setDate(due.getDate() + termDays);
      const asOfDate = new Date(asOf);
      const diffDays = Math.max(0, Math.floor((asOfDate - due) / (1000*60*60*24)));

      const partyKey = bill.party_id;
      if (!byParty.has(partyKey)) byParty.set(partyKey, { party_id: partyKey, party_name: bill.party_name, b0_7:0, b8_30:0, b31_60:0, b61_90:0, b90p:0, total:0 });
      const row = byParty.get(partyKey);
      if (diffDays <= 7) row.b0_7 += outstanding;
      else if (diffDays <= 30) row.b8_30 += outstanding;
      else if (diffDays <= 60) row.b31_60 += outstanding;
      else if (diffDays <= 90) row.b61_90 += outstanding;
      else row.b90p += outstanding;
      row.total += outstanding;
    }

    const out = Array.from(byParty.values())
      .map(r => ({
        ...r,
        b0_7: Number(r.b0_7.toFixed(2)),
        b8_30: Number(r.b8_30.toFixed(2)),
        b31_60: Number(r.b31_60.toFixed(2)),
        b61_90: Number(r.b61_90.toFixed(2)),
        b90p: Number(r.b90p.toFixed(2)),
        total: Number(r.total.toFixed(2)),
      }))
      .sort((a,b)=> b.total - a.total);
    res.json(out);
  } catch (e) {
    console.error('reports aging error:', e);
    res.status(500).json({ error: 'failed to build aging report' });
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

// Price series for a product
// GET /reports/price-series?product_id=&group=day|month&stat=avg|last|band
router.get('/price-series', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const productId = Number(req.query.product_id);
    if (!productId) return res.status(400).json({ error: 'product_id required' });
    const group = (req.query.group || 'day').toLowerCase();
    const stat = (req.query.stat || 'last').toLowerCase();
    const fmt = group === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const partyId = req.query.party_id ? Number(req.query.party_id) : null;
    const role = (req.query.role || 'any').toLowerCase(); // any|seller|buyer

    const params = [firmId, productId];
    let where = 'c.firm_id = ? AND c.product_id = ? AND c.deleted_at IS NULL AND c.price IS NOT NULL';
    if (fyId) { where += ' AND c.fiscal_year_id = ?'; params.push(fyId); }
    if (partyId) {
      if (role === 'seller') { where += ' AND c.seller_id = ?'; params.push(partyId); }
      else if (role === 'buyer') { where += ' AND c.buyer_id = ?'; params.push(partyId); }
      else { where += ' AND (c.seller_id = ? OR c.buyer_id = ?)'; params.push(partyId, partyId); }
    }

    if (stat === 'avg') {
      const sql = `
        SELECT DATE_FORMAT(c.order_date, '${fmt}') AS period, AVG(c.price) AS price
          FROM contracts c
         WHERE ${where}
         GROUP BY period
         ORDER BY period ASC`;
      const [rows] = await pool.execute(sql, params);
      return res.json(rows.map(r=>({ period: r.period, price: r.price==null? null : Number(r.price) })));
    }

    if (stat === 'band') {
      const sql = `
        SELECT DATE_FORMAT(c.order_date, '${fmt}') AS period,
               MIN(c.price) AS min_price,
               MAX(c.price) AS max_price,
               AVG(c.price) AS avg_price,
               COUNT(*) AS cnt
          FROM contracts c
         WHERE ${where}
         GROUP BY period
         ORDER BY period ASC`;
      const [rows] = await pool.execute(sql, params);
      return res.json(rows.map(r=>({
        period: r.period,
        min: r.min_price == null ? null : Number(r.min_price),
        max: r.max_price == null ? null : Number(r.max_price),
        avg: r.avg_price == null ? null : Number(r.avg_price),
        count: Number(r.cnt || 0),
      })));
    }

    // last price by period: take price for max(id) in each period
    const sql = `
      SELECT t.period, c.price
        FROM (
          SELECT DATE_FORMAT(order_date, '${fmt}') AS period, MAX(id) AS id
            FROM contracts c
           WHERE ${where}
           GROUP BY DATE_FORMAT(order_date, '${fmt}')
        ) t
        JOIN contracts c ON c.id = t.id
       ORDER BY t.period ASC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(r=>({ period: r.period, price: r.price==null? null : Number(r.price) })));
  } catch (e) {
    console.error('reports price-series error:', e);
    res.status(500).json({ error: 'failed to build price series' });
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

// Payment behavior (reliability) for a party
// GET /reports/payment-behavior?party_id=&from=&to=
router.get('/payment-behavior', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const partyId = req.query.party_id ? Number(req.query.party_id) : null;
    if (!partyId) return res.status(400).json({ error: 'party_id required' });
    const from = req.query.from || null;
    const to = req.query.to || toDateStr(new Date());

    // load bills for party
    const params = [firmId, partyId];
    let sql = `SELECT * FROM party_bills WHERE firm_id = ? AND party_id = ?`;
    if (fyId) { sql += ' AND (fiscal_year_id = ? OR fiscal_year_id IS NULL)'; params.push(fyId); }
    if (from) { sql += ' AND bill_date >= ?'; params.push(from); }
    if (to) { sql += ' AND bill_date <= ?'; params.push(to); }
    sql += ' ORDER BY bill_date ASC';
    const [bills] = await pool.execute(sql, params);

    // determine party due days if column exists
    let dueDays = Number(process.env.BILL_DUE_DAYS || 30);
    try { const [[r]] = await pool.execute('SELECT due_days FROM parties WHERE id = ? LIMIT 1', [partyId]); if (r && r.due_days != null) dueDays = Number(r.due_days) || dueDays; } catch(_){ }

    const stats = { count:0, paid_count:0, on_time:0, total_delay_days:0, max_delay:0, open_count:0 };
    const details = [];
    for (const bill of bills) {
      const total = await computeBillTotal(pool, firmId, bill);
      const [[sumAll]] = await pool.execute('SELECT COALESCE(SUM(amount),0) AS amt FROM party_bill_receipts WHERE firm_id = ? AND party_bill_id = ? AND receive_date <= ?', [firmId, bill.id, to]);
      const [[lastPay]] = await pool.execute('SELECT MAX(receive_date) AS last_dt FROM party_bill_receipts WHERE firm_id = ? AND party_bill_id = ? AND receive_date <= ?', [firmId, bill.id, to]);
      const outstanding = Math.max(0, Number(total) - Number(sumAll?.amt || 0));
      const billDate = new Date(toDateStr(bill.bill_date));
      const due = new Date(billDate.getTime()); due.setDate(due.getDate() + dueDays);
      const toDate = new Date(to);
      stats.count++;
      if (outstanding <= 0 && lastPay?.last_dt) {
        const last = new Date(toDateStr(lastPay.last_dt));
        const days = Math.max(0, Math.ceil((last - billDate)/(1000*60*60*24)));
        stats.paid_count++;
        stats.total_delay_days += days;
        if (days <= dueDays) stats.on_time++;
        if (days > stats.max_delay) stats.max_delay = days;
        details.push({ bill_id: bill.id, bill_date: toDateStr(bill.bill_date), status:'PAID', days_to_pay: days });
      } else {
        const overdue = Math.max(0, Math.floor((toDate - due)/(1000*60*60*24)));
        stats.open_count++;
        details.push({ bill_id: bill.id, bill_date: toDateStr(bill.bill_date), status:'OPEN', days_overdue: overdue });
      }
    }
    const avg_days_to_pay = stats.paid_count ? (stats.total_delay_days / stats.paid_count) : null;
    const pct_on_time = stats.paid_count ? (stats.on_time / stats.paid_count) : null;
    res.json({
      summary: {
        bills: stats.count,
        paid: stats.paid_count,
        open: stats.open_count,
        avg_days_to_pay,
        pct_on_time,
        max_delay: stats.max_delay,
        due_days: dueDays,
      },
      details,
    });
  } catch (e) {
    console.error('reports payment-behavior error:', e);
    res.status(500).json({ error: 'failed to build payment behavior' });
  }
});

// Brokerage earnings (bill totals)
// GET /reports/brokerage?group=party|month&from=&to=
router.get('/brokerage', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const group = (req.query.group || 'month').toLowerCase();
    const from = req.query.from || null;
    const to = req.query.to || null;

    // Load bills in scope
    const params = [firmId];
    let sql = `SELECT pb.*, p.name AS party_name FROM party_bills pb JOIN parties p ON p.id = pb.party_id WHERE pb.firm_id = ?`;
    if (fyId) { sql += ' AND (pb.fiscal_year_id = ? OR pb.fiscal_year_id IS NULL)'; params.push(fyId); }
    if (from) { sql += ' AND pb.bill_date >= ?'; params.push(from); }
    if (to) { sql += ' AND pb.bill_date <= ?'; params.push(to); }
    const [bills] = await pool.execute(sql, params);

    const outMap = new Map();
    for (const bill of bills) {
      const total = await computeBillTotal(pool, firmId, bill);
      if (group === 'party') {
        const key = bill.party_id;
        const cur = outMap.get(key) || { party_id: key, party_name: bill.party_name, total: 0 };
        cur.total += Number(total);
        outMap.set(key, cur);
      } else {
        const period = (toDateStr(bill.bill_date) || '').slice(0,7); // YYYY-MM
        const cur = outMap.get(period) || { period, total: 0 };
        cur.total += Number(total);
        outMap.set(period, cur);
      }
    }
    const out = Array.from(outMap.values()).sort((a,b)=> (b.total||0)-(a.total||0));
    res.json(out);
  } catch (e) {
    console.error('reports brokerage error:', e);
    res.status(500).json({ error: 'failed to build brokerage earnings' });
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

// Top parties/products by qty or value (contracts based)
// GET /reports/top?type=party|product&metric=qty|value&limit=10&from=&to=
router.get('/top', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const type = (req.query.type || 'party').toLowerCase();
    const metric = (req.query.metric || 'qty').toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)));
    const from = req.query.from || null;
    const to = req.query.to || null;

    const params = [firmId];
    let where = 'c.firm_id = ? AND c.deleted_at IS NULL';
    if (fyId) { where += ' AND c.fiscal_year_id = ?'; params.push(fyId); }
    if (from) { where += ' AND c.order_date >= ?'; params.push(from); }
    if (to) { where += ' AND c.order_date <= ?'; params.push(to); }

    if (type === 'product') {
      const sql = `
        SELECT p.id AS product_id, p.name AS product_name,
               SUM(COALESCE(c.max_qty, c.min_qty, 0)) AS qty,
               SUM(CASE WHEN c.price IS NOT NULL THEN COALESCE(c.max_qty, c.min_qty, 0) * c.price ELSE 0 END) AS value
          FROM contracts c
          LEFT JOIN products p ON p.id = c.product_id
         WHERE ${where}
         GROUP BY p.id, p.name
         ORDER BY ${metric === 'value' ? 'value' : 'qty'} DESC
         LIMIT ${limit}`;
      const [rows] = await pool.execute(sql, params);
      return res.json(rows.map(r => ({
        product_id: r.product_id, product_name: r.product_name || '(Unspecified)',
        qty: Number(r.qty || 0), value: Number(r.value || 0)
      })));
    }

    // parties: rank by highest bill revenue for the FY (bill totals)
    const bParams = [firmId];
    let bSql = `SELECT pb.*, p.name AS party_name FROM party_bills pb JOIN parties p ON p.id = pb.party_id WHERE pb.firm_id = ?`;
    if (fyId) { bSql += ' AND (pb.fiscal_year_id = ? OR pb.fiscal_year_id IS NULL)'; bParams.push(fyId); }
    if (from) { bSql += ' AND pb.bill_date >= ?'; bParams.push(from); }
    if (to) { bSql += ' AND pb.bill_date <= ?'; bParams.push(to); }
    const [bills] = await pool.execute(bSql, bParams);
    const totals = new Map();
    for (const bill of bills) {
      const total = await computeBillTotal(pool, firmId, bill);
      const cur = totals.get(bill.party_id) || { party_id: bill.party_id, party_name: bill.party_name, total: 0 };
      cur.total += Number(total);
      totals.set(bill.party_id, cur);
    }
    const top = Array.from(totals.values()).sort((a,b)=> (b.total||0)-(a.total||0)).slice(0, limit);
    res.json(top);
  } catch (e) {
    console.error('reports top error:', e);
    res.status(500).json({ error: 'failed to build top list' });
  }
});

// Cohort repeat-purchase (party × first-month)
// GET /reports/cohort?months=6
router.get('/cohort', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const months = Math.max(1, Math.min(12, Number(req.query.months || 6)));

    const params = [firmId];
    let where = 'c.firm_id = ? AND c.deleted_at IS NULL';
    if (fyId) { where += ' AND c.fiscal_year_id = ?'; params.push(fyId); }

    const sql = `
      SELECT c.party_id, DATE_FORMAT(MIN(c.order_date), '%Y-%m') AS first_month
        FROM (
          SELECT seller_id AS party_id, order_date FROM contracts c1 WHERE ${where}
          UNION ALL
          SELECT buyer_id  AS party_id, order_date FROM contracts c2 WHERE ${where}
        ) c
       WHERE c.party_id IS NOT NULL
       GROUP BY c.party_id`;
    const [firsts] = await pool.execute(sql, [...params, ...params]);

    const sql2 = `
      SELECT p.id AS party_id, DATE_FORMAT(c.order_date, '%Y-%m') AS ym
        FROM contracts c
        JOIN parties p ON p.id IN (c.seller_id, c.buyer_id)
       WHERE ${where}`;
    const [events] = await pool.execute(sql2, params);

    // Build lookup of party -> first month and month set
    const firstMap = new Map(firsts.map(r => [r.party_id, r.first_month]));
    const monthSet = new Map();
    for (const e of events) {
      if (!firstMap.has(e.party_id)) continue;
      const fm = firstMap.get(e.party_id);
      monthSet.set(e.party_id, (monthSet.get(e.party_id) || new Set()).add(e.ym));
    }
    // Determine all cohort start months sorted
    const cohorts = Array.from(new Set(firsts.map(r => r.first_month))).sort();
    const out = cohorts.map(cm => ({ cohort: cm, size: 0, buckets: Array(months).fill(0) }));
    const cohortIndex = new Map(out.map((r,i)=>[r.cohort,i]));
    // Helper to compute diff in months between YYYY-MM strings
    function monthDiff(a,b){ const [ay,am]=a.split('-').map(Number); const [by,bm]=b.split('-').map(Number); return (by-ay)*12 + (bm-am); }
    // For each party, fill buckets where they purchased
    for (const [pid, fm] of firstMap.entries()) {
      const oi = cohortIndex.get(fm); if (oi==null) continue; out[oi].size++;
      const set = monthSet.get(pid) || new Set();
      for (const m of set) {
        const d = monthDiff(fm, m);
        if (d >=0 && d < months) out[oi].buckets[d]++;
      }
    }
    // Convert to percentages per cohort size
    for (const row of out) {
      if (row.size > 0) row.buckets = row.buckets.map(v => Number((v/row.size*100).toFixed(1)));
    }
    res.json({ months, cohorts: out });
  } catch (e) {
    console.error('reports cohort error:', e);
    res.status(500).json({ error: 'failed to build cohort' });
  }
});

// Anomaly watch (simple z-score on price per product)
// GET /reports/anomaly?product_id=&window=30&z=2
router.get('/anomaly', async (req, res) => {
  try {
    const firmId = req.ctx.firmId;
    const fyId = req.ctx.fyId || null;
    const productId = req.query.product_id ? Number(req.query.product_id) : null;
    const windowDays = Math.max(7, Math.min(120, Number(req.query.window || 30)));
    const z = Math.max(1.5, Math.min(5, Number(req.query.z || 2)));

    const params = [firmId];
    let where = 'c.firm_id = ? AND c.deleted_at IS NULL AND c.price IS NOT NULL';
    if (fyId) { where += ' AND c.fiscal_year_id = ?'; params.push(fyId); }
    if (productId) { where += ' AND c.product_id = ?'; params.push(productId); }
    // recent range = last ~2*window days for baseline
    where += ` AND c.order_date >= DATE_SUB(CURDATE(), INTERVAL ${2*windowDays} DAY)`;

    const sql = `
      SELECT c.id, c.order_date, c.price, p.name AS product_name, s.name AS seller_name, b.name AS buyer_name
        FROM contracts c
        LEFT JOIN products p ON p.id = c.product_id
        LEFT JOIN parties s ON s.id = c.seller_id
        LEFT JOIN parties b ON b.id = c.buyer_id
       WHERE ${where}
       ORDER BY c.order_date ASC`;
    const [rows] = await pool.execute(sql, params);

    // compute mean/std per product over the period and flag outliers
    const byProd = new Map();
    for (const r of rows) {
      const key = r.product_name || '(Unspecified)';
      const arr = byProd.get(key) || []; arr.push(Number(r.price)); byProd.set(key, arr);
    }
    const stats = new Map();
    for (const [k, arr] of byProd.entries()) {
      const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
      const sd = Math.sqrt(arr.reduce((s,v)=>s+Math.pow(v-mean,2),0)/(arr.length||1));
      stats.set(k, { mean, sd });
    }
    const out = [];
    for (const r of rows) {
      const key = r.product_name || '(Unspecified)'; const st = stats.get(key);
      const sd = st?.sd || 0; if (!sd) continue;
      const zscore = Math.abs((Number(r.price) - st.mean) / sd);
      if (zscore >= z) out.push({ id: r.id, date: toDateStr(r.order_date), product_name: key, price: Number(r.price), z: Number(zscore.toFixed(2)), seller_name: r.seller_name, buyer_name: r.buyer_name });
    }
    res.json(out.sort((a,b)=> b.z - a.z));
  } catch (e) {
    console.error('reports anomaly error:', e);
    res.status(500).json({ error: 'failed to build anomaly list' });
  }
});
module.exports = router;

// ---- Helpers for bill totals (reuse logic similar to party-bills summary) ----
async function computeBillTotal(pool, firmId, bill) {
  const from = toDateStr(bill.from_date);
  const to = toDateStr(bill.to_date);
  const params = [firmId, from, to, bill.party_id, bill.party_id];
  const sql = `
    SELECT c.id, c.seller_id, c.buyer_id,
           c.seller_brokerage, c.buyer_brokerage, c.min_qty, c.max_qty
      FROM contracts c
     WHERE c.firm_id = ? AND c.deleted_at IS NULL
       AND c.order_date BETWEEN ? AND ?
       AND (c.seller_id = ? OR c.buyer_id = ?)`;
  const [rows] = await pool.execute(sql, params);

  const overrideRate = Number(bill.brokerage || 0) || null;
  let subtotal = 0;
  for (const r of rows) {
    const role = r.seller_id === bill.party_id ? 'SELLER' : 'BUYER';
    const qty = (r.max_qty ?? r.min_qty ?? 0) || 0;
    const rate = overrideRate != null ? overrideRate : (role === 'SELLER' ? (r.seller_brokerage || 30) : (r.buyer_brokerage || 30));
    subtotal += Number(qty) * Number(rate);
  }
  let cgst = 0, sgst = 0, igst = 0;
  // fetch party gst details for taxes
  const [[party]] = await pool.execute('SELECT gst_type, cgst_rate, sgst_rate, igst_rate FROM parties WHERE id = ? LIMIT 1', [bill.party_id]);
  const [[firm]] = await pool.execute('SELECT gst_no FROM firms WHERE id = ? LIMIT 1', [firmId]);
  if (firm?.gst_no) {
    if (party?.gst_type === 'INTER') {
      igst = subtotal * (Number(party?.igst_rate || 0) / 100);
    } else {
      cgst = subtotal * (Number(party?.cgst_rate || 0) / 100);
      sgst = subtotal * (Number(party?.sgst_rate || 0) / 100);
    }
  }
  return subtotal + cgst + sgst + igst;
}

function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0,10);
  const d = new Date(v);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
