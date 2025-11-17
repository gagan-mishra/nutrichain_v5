const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { requireContext } = require('../middleware/context');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const { buildPartyBillPrintHtml } = require('../lib/party-bill-template');

const router = express.Router();
router.use(requireAuth, requireContext);

// CREATE
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.party_id) return res.status(400).json({ error: 'party_id required' });
    if (!b.from_date || !b.to_date || !b.bill_date) {
      return res.status(400).json({ error: 'from_date, to_date, bill_date required' });
    }
    // Guard: only create if trades exist in the range for this party within the firm
    const [cntRows] = await pool.execute(
      `SELECT COUNT(*) AS cnt
         FROM contracts c
        WHERE c.firm_id = ? AND c.deleted_at IS NULL
          AND c.order_date BETWEEN ? AND ?
          AND (c.seller_id = ? OR c.buyer_id = ?)`,
      [req.ctx.firmId, b.from_date, b.to_date, b.party_id, b.party_id]
    );
    const tradeCount = Number(cntRows?.[0]?.cnt || 0);
    if (tradeCount === 0) {
      return res.status(400).json({ error: 'This party has no trades in the selected period.' });
    }

    // Guard: avoid duplicates for firm + FY + party
    const fyId = b.fiscal_year_id || req.ctx.fyId || null;
    const [[dup]] = await pool.execute(
      `SELECT id FROM party_bills WHERE firm_id = ? AND party_id = ? AND (
          (fiscal_year_id IS NULL AND ? IS NULL) OR fiscal_year_id = ?
        ) LIMIT 1`,
      [req.ctx.firmId, b.party_id, fyId, fyId]
    );
    if (dup) return res.status(409).json({ error: 'Bill already exists for this party and FY.' });

    // Attempt insert with small retry window to avoid duplicate bill_no race
    const insertOnce = async () => {
      // If bill_no missing, assign next numeric within firm + FY
      let billNo = (b.bill_no ?? '').toString().trim();
      if (billNo) {
        const n = parseInt(billNo, 10);
        billNo = Number.isFinite(n) && n > 0 ? String(n) : '';
      }
      if (!billNo) {
        const [[row]] = await pool.execute(
          `SELECT CAST(COALESCE(MAX(CAST(bill_no AS UNSIGNED)), 0) + 1 AS UNSIGNED) AS next_no
             FROM party_bills WHERE firm_id = ? AND fiscal_year_id = ?`,
          [req.ctx.firmId, fyId]
        );
        billNo = String(row?.next_no || 1);
      }
      const sql = `
        INSERT INTO party_bills
          (firm_id, fiscal_year_id, party_id, bill_no, from_date, to_date, bill_date, brokerage)
        VALUES (?,?,?,?,?,?,?,?)`;
      const params = [
        req.ctx.firmId,
        fyId,
        b.party_id,
        billNo,
        b.from_date,
        b.to_date,
        b.bill_date,
        b.brokerage || 0,
      ];
      const [r] = await pool.execute(sql, params);
      return r.insertId;
    };

    let lastErr;
    for (let i=0;i<3;i++){
      try {
        const id = await insertOnce();
        return res.json({ id });
      } catch (e) {
        // Retry only on duplicate bill number
        if (e?.code === 'ER_DUP_ENTRY' && String(e.sqlMessage || '').includes('uq_bill_firm_fy_no')) {
          await new Promise(r=>setTimeout(r, 50 + Math.random()*100));
          lastErr = e; continue;
        }
        throw e;
      }
    }
    if (lastErr) {
      return res.status(409).json({ error: 'Bill number conflict. Please try again.' });
    }
  } catch (e) {
    console.error('party-bills POST error:', e);
    res.status(500).json({ error: 'failed to create bill' });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const sql = `
      UPDATE party_bills SET
        party_id = ?, bill_no = ?, from_date = ?, to_date = ?, bill_date = ?, brokerage = ?
      WHERE id = ? AND firm_id = ?`;
    // normalize bill number on update as well (strip leading zeros)
    let billNo = (b.bill_no ?? '').toString().trim();
    if (billNo) {
      const n = parseInt(billNo, 10);
      billNo = Number.isFinite(n) && n > 0 ? String(n) : '';
    }
    const params = [
      b.party_id,
      billNo || null,
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
  } catch (e) {
    console.error('party-bills PUT error:', e);
    res.status(500).json({ error: 'failed to update bill' });
  }
});

// LIST (basic, optional filters)
router.get('/', async (req, res) => {
  try {
    const partyId = req.query.party_id ? Number(req.query.party_id) : null;
    const { firmId, fyId } = req.ctx;
    const params = [firmId];
    let sql = `
      SELECT pb.*, p.name AS party_name
      FROM party_bills pb
      LEFT JOIN parties p ON p.id = pb.party_id
      WHERE pb.firm_id = ?`;
    if (fyId) { sql += ' AND (pb.fiscal_year_id = ? OR pb.fiscal_year_id IS NULL)'; params.push(fyId); }
    if (partyId) { sql += ' AND pb.party_id = ?'; params.push(partyId); }
    sql += ' ORDER BY pb.bill_date DESC, pb.id DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('party-bills GET error:', e);
    res.status(500).json({ error: 'failed to fetch bills' });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    let lastErr;
    for (let i=0;i<3;i++){
      try {
        const [r] = await pool.execute('DELETE FROM party_bills WHERE id = ? AND firm_id = ?', [id, req.ctx.firmId]);
        if (!r.affectedRows) return res.status(404).json({ error: 'not found' });
        return res.json({ ok: true });
      } catch (e) {
        const msg = String(e?.code || '');
        if (msg === 'ER_LOCK_WAIT_TIMEOUT' || msg === 'ER_LOCK_DEADLOCK' || String(e?.sqlState) === '40001') {
          lastErr = e; await new Promise(r=>setTimeout(r, 80 + Math.random()*120)); continue;
        }
        throw e;
      }
    }
    if (lastErr) return res.status(409).json({ error: 'Delete conflicted. Please retry.' });
  } catch (e) {
    console.error('party-bills DELETE error:', e);
    res.status(500).json({ error: 'failed to delete bill' });
  }
});

/* ---------------- Compute bill (preview) ----------------
   GET /billing/party-bills/compute?party_id=..&from=YYYY-MM-DD&to=YYYY-MM-DD&bill_date=YYYY-MM-DD&bill_no=...
*/
router.get('/compute', async (req, res) => {
  try {
    const partyId = Number(req.query.party_id);
    const from = req.query.from;
    const to = req.query.to;
    const billDate = req.query.bill_date || to;
    const billNo = req.query.bill_no || null;
    const overrideRate = req.query.brokerage != null && req.query.brokerage !== ''
      ? Number(req.query.brokerage)
      : null;
    if (!partyId || !from || !to) return res.status(400).json({ error: 'party_id, from, to required' });

  // firm info
  const [[firm]] = await pool.execute('SELECT id, name, address, gst_no FROM firms WHERE id = ? LIMIT 1', [req.ctx.firmId]);
  if (!firm) return res.status(400).json({ error: 'firm not found' });

  // party info (gst + rates)
  const [[party]] = await pool.execute(
    'SELECT id, name, gst_no, gst_type, cgst_rate, sgst_rate, igst_rate FROM parties WHERE id = ? LIMIT 1',
    [partyId]
  );
  if (!party) return res.status(400).json({ error: 'party not found' });

  // contracts in range for this firm and party as seller or buyer
  const params = [req.ctx.firmId, from, to, partyId, partyId];
  const sql = `
    SELECT c.id, c.contract_no, c.order_date, c.seller_id, c.buyer_id,
           c.seller_brokerage, c.buyer_brokerage, c.min_qty, c.max_qty, c.unit, c.price,
           s.name AS seller_name, b.name AS buyer_name, p.name AS product_name
      FROM contracts c
      JOIN parties s ON s.id = c.seller_id
      JOIN parties b ON b.id = c.buyer_id
      LEFT JOIN products p ON p.id = c.product_id
     WHERE c.firm_id = ?
       AND c.deleted_at IS NULL
       AND c.order_date BETWEEN ? AND ?
       AND (c.seller_id = ? OR c.buyer_id = ?)
     ORDER BY c.order_date ASC, c.id ASC`;
  const [rows] = await pool.execute(sql, params);

  const items = rows.map((r, idx) => {
    const role = r.seller_id === partyId ? 'SELLER' : 'BUYER';
    const otherParty = role === 'SELLER' ? r.buyer_name : r.seller_name;
    const qty = (r.max_qty ?? r.min_qty ?? 0);
    let rate;
    if (overrideRate != null && !Number.isNaN(overrideRate)) {
      rate = overrideRate; // bill-level override (e.g., 30)
    } else {
      rate = role === 'SELLER' ? (r.seller_brokerage ?? 0) : (r.buyer_brokerage ?? 0);
      if (!rate) rate = 30; // default fallback
    }
    const amount = Number(qty) * Number(rate);
    return {
      sr: idx + 1,
      contract_id: r.id,
      contract_no: r.contract_no || String(r.id),
      order_date: toDateStr(r.order_date),
      role,
      other_party: otherParty,
      product: r.product_name || '',
      qty: Number(qty) || 0,
      unit: r.unit || '',
      price: r.price == null ? null : Number(r.price),
      brokerage_rate: Number(rate),
      amount,
    };
  });

  const subtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
  const isGstFirm = !!firm.gst_no;
  let taxes = { cgst: 0, sgst: 0, igst: 0 };
  if (isGstFirm) {
    if (party.gst_type === 'INTRA') {
      taxes.cgst = subtotal * ((Number(party.cgst_rate || 0)) / 100);
      taxes.sgst = subtotal * ((Number(party.sgst_rate || 0)) / 100);
    } else if (party.gst_type === 'INTER') {
      taxes.igst = subtotal * ((Number(party.igst_rate || 0)) / 100);
    }
  }
  const total = subtotal + taxes.cgst + taxes.sgst + taxes.igst;

  return res.json({
    meta: {
      bill_no: billNo,
      bill_date: billDate,
      from,
      to,
      firm: { id: firm.id, name: firm.name, address: firm.address || '', gst_no: firm.gst_no || null },
      party: {
        id: party.id,
        name: party.name,
        gst_no: party.gst_no || null,
        gst_type: party.gst_type || 'INTRA',
        cgst_rate: Number(party.cgst_rate || 0),
        sgst_rate: Number(party.sgst_rate || 0),
        igst_rate: Number(party.igst_rate || 0),
      },
    },
    items,
    totals: {
      subtotal,
      ...taxes,
      total,
    },
  });
  } catch (e) {
    console.error('party-bills COMPUTE error:', e);
    res.status(500).json({ error: 'failed to compute bill' });
  }
});

// ---------- Receipts: record bill payments ----------
// Expected table (DDL to be created in DB):
// CREATE TABLE IF NOT EXISTS party_bill_receipts (
//   id BIGINT PRIMARY KEY AUTO_INCREMENT,
//   firm_id BIGINT NOT NULL,
//   party_bill_id BIGINT NOT NULL,
//   party_id BIGINT NOT NULL,
//   receive_date DATE NOT NULL,
//   amount DECIMAL(12,2) NOT NULL,
//   mode VARCHAR(20) NULL,
//   reference_no VARCHAR(100) NULL,
//   notes TEXT NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   INDEX (firm_id, party_bill_id)
// );

// Get receipts for a bill
router.get('/:id/receipts', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const firmId = req.ctx.firmId;
    const [rows] = await pool.execute(
      `SELECT r.id, r.receive_date, r.amount, r.mode, r.reference_no, r.notes, r.created_at
         FROM party_bill_receipts r
        WHERE r.firm_id = ? AND r.party_bill_id = ?
        ORDER BY r.receive_date DESC, r.id DESC`,
      [firmId, id]
    );
    res.json(rows);
  } catch (e) {
    console.error('party-bills receipts LIST error:', e);
    res.status(500).json({ error: 'failed to fetch receipts' });
  }
});

// Add a receipt to a bill
router.post('/:id/receipts', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const firmId = req.ctx.firmId;
    const b = req.body || {};

    // Verify bill belongs to this firm, and get party_id
    const [[bill]] = await pool.execute(
      'SELECT id, party_id FROM party_bills WHERE id = ? AND firm_id = ? LIMIT 1',
      [id, firmId]
    );
    if (!bill) return res.status(404).json({ error: 'bill not found' });

    const amount = Number(b.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    const receiveDate = b.receive_date || toDateStr(new Date());
    const mode = (b.mode || '').toUpperCase() || null; // CASH | BANK | UPI | CHEQUE | OTHER
    const referenceNo = b.reference_no || null;
    const notes = b.notes || null;

    const [r] = await pool.execute(
      `INSERT INTO party_bill_receipts
        (firm_id, party_bill_id, party_id, receive_date, amount, mode, reference_no, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [firmId, id, bill.party_id, receiveDate, amount, mode, referenceNo, notes]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    console.error('party-bills receipts CREATE error:', e);
    res.status(500).json({ error: 'failed to create receipt' });
  }
});

// Delete a receipt
router.delete('/:id/receipts/:rid', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rid = Number(req.params.rid);
    const firmId = req.ctx.firmId;
    const [r] = await pool.execute(
      `DELETE FROM party_bill_receipts WHERE id = ? AND firm_id = ? AND party_bill_id = ?`,
      [rid, firmId, id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('party-bills receipts DELETE error:', e);
    res.status(500).json({ error: 'failed to delete receipt' });
  }
});

// Summary for a bill (total, received, outstanding)
router.get('/:id/summary', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const firmId = req.ctx.firmId;

    // Load bill for range + party
    const [[bill]] = await pool.execute(
      `SELECT pb.*, p.name AS party_name, p.gst_type, p.cgst_rate, p.sgst_rate, p.igst_rate,
              f.gst_no AS firm_gst
         FROM party_bills pb
         JOIN parties p ON p.id = pb.party_id
         JOIN firms f ON f.id = pb.firm_id
        WHERE pb.id = ? AND pb.firm_id = ?
        LIMIT 1`,
      [id, firmId]
    );
    if (!bill) return res.status(404).json({ error: 'bill not found' });

    // Compute total using same logic as compute route
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
    if (bill.firm_gst) {
      if (bill.gst_type === 'INTRA') {
        cgst = subtotal * (Number(bill.cgst_rate || 0) / 100);
        sgst = subtotal * (Number(bill.sgst_rate || 0) / 100);
      } else if (bill.gst_type === 'INTER') {
        igst = subtotal * (Number(bill.igst_rate || 0) / 100);
      }
    }
    const total = subtotal + cgst + sgst + igst;

    // Sum receipts
    const [[sumRow]] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) AS received FROM party_bill_receipts WHERE firm_id = ? AND party_bill_id = ?`,
      [firmId, id]
    );
    const received = Number(sumRow?.received || 0);
    const outstanding = Number((total - received).toFixed(2));
    res.json({ total, received, outstanding });
  } catch (e) {
    console.error('party-bills SUMMARY error:', e);
    res.status(500).json({ error: 'failed to compute summary' });
  }
});

module.exports = router;

function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0,10);
  const d = new Date(v);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// --------------- Mail bill as PDF ---------------
function createTransport() {
  if (process.env.SMTP_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

router.post('/:id/mail', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const firmId = req.ctx.firmId;
    // Load bill
    const [[bill]] = await pool.execute(
      `SELECT pb.*, p.name AS party_name, p.gst_no AS party_gst, p.gst_type, p.cgst_rate, p.sgst_rate, p.igst_rate,
              f.name AS firm_name, f.address AS firm_address, f.gst_no AS firm_gst
         FROM party_bills pb
         JOIN parties p ON p.id = pb.party_id
         JOIN firms f ON f.id = pb.firm_id
        WHERE pb.id = ? AND pb.firm_id = ?
        LIMIT 1`,
      [id, firmId]
    );
    if (!bill) return res.status(404).json({ error: 'Not found' });

    // Compute items (reuse logic)
    const from = toDateStr(bill.from_date);
    const to = toDateStr(bill.to_date);
    const billDate = toDateStr(bill.bill_date);
    const params = [firmId, from, to, bill.party_id, bill.party_id];
    const sql = `
      SELECT c.id, c.contract_no, c.order_date, c.seller_id, c.buyer_id,
             c.seller_brokerage, c.buyer_brokerage, c.min_qty, c.max_qty, c.unit, c.price,
             s.name AS seller_name, b.name AS buyer_name, p.name AS product_name
        FROM contracts c
        JOIN parties s ON s.id = c.seller_id
        JOIN parties b ON b.id = c.buyer_id
        LEFT JOIN products p ON p.id = c.product_id
       WHERE c.firm_id = ? AND c.deleted_at IS NULL
         AND c.order_date BETWEEN ? AND ?
         AND (c.seller_id = ? OR c.buyer_id = ?)
       ORDER BY c.order_date ASC, c.id ASC`;
    const [rows] = await pool.execute(sql, params);

    const overrideRate = Number(bill.brokerage || 0);
    const items = rows.map((r, idx) => {
      const role = r.seller_id === bill.party_id ? 'SELLER' : 'BUYER';
      const otherParty = role === 'SELLER' ? r.buyer_name : r.seller_name;
      const qty = (r.max_qty ?? r.min_qty ?? 0);
      const rate = overrideRate || (role === 'SELLER' ? (r.seller_brokerage || 30) : (r.buyer_brokerage || 30));
      const amount = Number(qty) * Number(rate);
      return {
        sr: idx + 1,
        contract_id: r.id,
        contract_no: r.contract_no || String(r.id),
        order_date: toDateStr(r.order_date),
        role,
        other_party: otherParty,
        product: r.product_name || '',
        qty: Number(qty) || 0,
        unit: r.unit || '',
        price: r.price == null ? null : Number(r.price),
        brokerage_rate: Number(rate),
        amount,
      };
    });

    const subtotal = items.reduce((s,it)=>s+(it.amount||0),0);
    const taxes = { cgst:0, sgst:0, igst:0 };
    if (bill.firm_gst) {
      if (bill.gst_type === 'INTRA') {
        taxes.cgst = subtotal * (Number(bill.cgst_rate||0)/100);
        taxes.sgst = subtotal * (Number(bill.sgst_rate||0)/100);
      } else if (bill.gst_type === 'INTER') {
        taxes.igst = subtotal * (Number(bill.igst_rate||0)/100);
      }
    }
    const total = subtotal + taxes.cgst + taxes.sgst + taxes.igst;
    const payload = {
      meta: {
        bill_no: bill.bill_no,
        bill_date: billDate,
        from,
        to,
        firm: { name: bill.firm_name, address: bill.firm_address, gst_no: bill.firm_gst },
        party: { name: bill.party_name, gst_no: bill.party_gst, gst_type: bill.gst_type, cgst_rate: bill.cgst_rate, sgst_rate: bill.sgst_rate, igst_rate: bill.igst_rate },
      },
      items,
      totals: { subtotal, ...taxes, total },
    };

    const html = buildPartyBillPrintHtml(payload);
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    let pdf; try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top:'10mm', right:'10mm', bottom:'10mm', left:'10mm' } });
    } finally { await browser.close(); }

    // Recipient emails for the party
    const [emailRows] = await pool.execute('SELECT email FROM party_emails WHERE party_id = ?', [bill.party_id]);
    const recipients = emailRows.map(e=>e.email).filter(Boolean);
    if (!recipients.length) return res.status(400).json({ error: 'No recipient emails for this party.' });

    const transporter = createTransport();
    const subject = `Party Bill: ${bill.firm_name}. ${bill.party_name}. FY ${from.slice(0,4)}-${to.slice(2,4)}`;
    const text = [`Dear Sir/Madam,`, ``, `Please find attached the brokerage statement (Bill ${bill.bill_no}).`, `This is a system generated document.`, ``, `Regards,`, `${bill.firm_name}`].join('\n');
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject,
      text,
      html: text.replace(/\n/g,'<br/>'),
      attachments: [{ filename: `Bill-${bill.bill_no}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });

    try { await pool.execute('UPDATE party_bills SET mailed_at = NOW() WHERE id = ? AND firm_id = ?', [id, firmId]); } catch(_){ }
    return res.json({ ok:true, messageId: info.messageId, mailed_at: new Date().toISOString(), to: recipients.length });
  } catch (e) {
    console.error('party-bills MAIL error:', e);
    res.status(500).json({ error: 'failed to send mail' });
  }
});
