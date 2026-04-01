const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { requireContext } = require('../middleware/context');
const { renderPdfFromHtml } = require('../lib/pdf-renderer');
const { buildPartyLedgerPrintHtml } = require('../lib/party-ledger-template');

const router = express.Router();
router.use(requireAuth, requireContext);

const DEFAULT_BROKERAGE = Number(process.env.DEFAULT_BROKERAGE_RATE) || 30;

router.get('/', async (req, res) => {
  try {
    const partyId = Number(req.query.party_id);
    if (!partyId) return res.status(400).json({ error: 'party_id required' });

    const payload = await buildLedgerPayload({
      firmId: req.ctx.firmId,
      fyId: req.ctx.fyId,
      partyId,
      fromInput: req.query.from,
      toInput: req.query.to,
      asOfInput: req.query.as_of,
    });

    res.json(payload);
  } catch (e) {
    console.error('party-ledger GET error:', e);
    if (e?.httpStatus) return res.status(e.httpStatus).json({ error: e.message });
    res.status(500).json({ error: 'failed to load ledger' });
  }
});

router.get('/pdf', async (req, res) => {
  try {
    const partyId = Number(req.query.party_id);
    if (!partyId) return res.status(400).json({ error: 'party_id required' });

    const payload = await buildLedgerPayload({
      firmId: req.ctx.firmId,
      fyId: req.ctx.fyId,
      partyId,
      fromInput: req.query.from,
      toInput: req.query.to,
      asOfInput: req.query.as_of,
    });

    const html = buildPartyLedgerPrintHtml(payload);
    const pdf = await renderPdfFromHtml(html, {
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });

    const partyName = String(payload?.meta?.party?.name || `party-${partyId}`)
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `Ledger-${partyName}-${payload.meta.from}-to-${payload.meta.to}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (e) {
    console.error('party-ledger PDF error:', e);
    if (e?.httpStatus) return res.status(e.httpStatus).json({ error: e.message });
    res.status(500).json({ error: 'failed to generate ledger pdf' });
  }
});

async function buildLedgerPayload({ firmId, fyId, partyId, fromInput, toInput, asOfInput }) {
  const [from, to] = await resolveRange({ fyId, fromInput, toInput });
  if (!from || !to) {
    const err = new Error('Unable to resolve ledger date range');
    err.httpStatus = 400;
    throw err;
  }
  if (from > to) {
    const err = new Error('Invalid date range: from must be <= to');
    err.httpStatus = 400;
    throw err;
  }
  const asOf = normalizeDate(asOfInput) || to;

  const [[firm]] = await pool.execute(
    'SELECT id, name, address, gst_no FROM firms WHERE id = ? LIMIT 1',
    [firmId]
  );
  if (!firm) {
    const err = new Error('Firm not found');
    err.httpStatus = 404;
    throw err;
  }

  const [[party]] = await pool.execute(
    'SELECT id, name, gst_no FROM parties WHERE id = ? LIMIT 1',
    [partyId]
  );
  if (!party) {
    const err = new Error('Party not found');
    err.httpStatus = 404;
    throw err;
  }

  const billParams = [firmId, partyId, from, to];
  let billSql = `
    SELECT pb.id, pb.bill_no, pb.bill_date, pb.from_date, pb.to_date, pb.brokerage, pb.fiscal_year_id,
           p.gst_type, p.cgst_rate, p.sgst_rate, p.igst_rate, p.gst_no AS party_gst,
           f.gst_no AS firm_gst
      FROM party_bills pb
      JOIN parties p ON p.id = pb.party_id
      JOIN firms f ON f.id = pb.firm_id
     WHERE pb.firm_id = ?
       AND pb.party_id = ?
       AND pb.bill_date BETWEEN ? AND ?`;
  if (fyId) {
    billSql += ' AND (pb.fiscal_year_id = ? OR pb.fiscal_year_id IS NULL)';
    billParams.push(fyId);
  }
  billSql += ' ORDER BY pb.bill_date ASC, pb.id ASC';

  const [bills] = await pool.execute(billSql, billParams);
  if (!bills.length) {
    return {
      meta: {
        firm,
        party,
        from,
        to,
        as_of: asOf,
        generated_at: new Date().toISOString(),
      },
      rows: [],
      transactions: [],
      totals: { bills: 0, bill_total: 0, received: 0, outstanding: 0 },
    };
  }

  const rows = [];
  const billTotalById = new Map();
  const billNoById = new Map();

  for (const bill of bills) {
    const gross = await computeGrossTotalForBill({
      firmId,
      partyId,
      from: toDateStr(bill.from_date),
      to: toDateStr(bill.to_date),
      firmGst: bill.firm_gst,
      gstType: bill.gst_type,
      cgstRate: bill.cgst_rate,
      sgstRate: bill.sgst_rate,
      igstRate: bill.igst_rate,
      brokerage: bill.brokerage,
    });

    billTotalById.set(bill.id, gross.total);
    billNoById.set(bill.id, bill.bill_no || String(bill.id));
    rows.push({
      bill_id: bill.id,
      bill_no: bill.bill_no || String(bill.id),
      bill_date: toDateStr(bill.bill_date),
      from_date: toDateStr(bill.from_date),
      to_date: toDateStr(bill.to_date),
      bill_total: gross.total,
      received: 0,
      outstanding: gross.total,
      receipt_count: 0,
      last_receipt_date: null,
    });
  }

  const billIds = rows.map((r) => r.bill_id);
  const placeholders = billIds.map(() => '?').join(',');
  const receiptAggSql = `
    SELECT r.party_bill_id,
           COALESCE(SUM(r.amount),0) AS received,
           COUNT(*) AS receipt_count,
           MAX(r.receive_date) AS last_receive_date
      FROM party_bill_receipts r
     WHERE r.firm_id = ?
       AND r.party_bill_id IN (${placeholders})
       AND r.receive_date <= ?
     GROUP BY r.party_bill_id`;
  const [aggRows] = await pool.execute(receiptAggSql, [firmId, ...billIds, asOf]);
  const aggByBill = new Map(aggRows.map((r) => [Number(r.party_bill_id), r]));

  for (const row of rows) {
    const agg = aggByBill.get(row.bill_id);
    if (!agg) continue;
    row.received = Number(agg.received || 0);
    row.receipt_count = Number(agg.receipt_count || 0);
    row.last_receipt_date = toDateStr(agg.last_receive_date);
    row.outstanding = Number((row.bill_total - row.received).toFixed(2));
  }

  const receiptTxnSql = `
    SELECT r.id, r.party_bill_id, r.receive_date, r.amount, r.mode, r.reference_no
      FROM party_bill_receipts r
     WHERE r.firm_id = ?
       AND r.party_bill_id IN (${placeholders})
       AND r.receive_date <= ?
     ORDER BY r.receive_date ASC, r.id ASC`;
  const [receiptTxns] = await pool.execute(receiptTxnSql, [firmId, ...billIds, asOf]);

  const events = [];
  for (const row of rows) {
    events.push({
      sort_type: 0,
      sort_id: row.bill_id,
      date: row.bill_date,
      type: 'BILL',
      bill_id: row.bill_id,
      bill_no: row.bill_no,
      debit: Number(row.bill_total || 0),
      credit: 0,
      note: `Bill ${row.bill_no}`,
    });
  }
  for (const rec of receiptTxns) {
    const billId = Number(rec.party_bill_id);
    const ref = rec.reference_no ? `Ref: ${rec.reference_no}` : '';
    const mode = rec.mode ? `Mode: ${rec.mode}` : '';
    const note = [mode, ref].filter(Boolean).join(' | ');
    events.push({
      sort_type: 1,
      sort_id: Number(rec.id),
      date: toDateStr(rec.receive_date),
      type: 'RECEIPT',
      bill_id: billId,
      bill_no: billNoById.get(billId) || String(billId),
      debit: 0,
      credit: Number(rec.amount || 0),
      note,
    });
  }

  events.sort((a, b) => {
    const ad = String(a.date || '');
    const bd = String(b.date || '');
    if (ad !== bd) return ad.localeCompare(bd);
    if (a.sort_type !== b.sort_type) return a.sort_type - b.sort_type;
    return a.sort_id - b.sort_id;
  });

  let running = 0;
  const transactions = events.map((ev) => {
    running += Number(ev.debit || 0) - Number(ev.credit || 0);
    return {
      date: ev.date,
      type: ev.type,
      bill_id: ev.bill_id,
      bill_no: ev.bill_no,
      debit: Number(ev.debit || 0),
      credit: Number(ev.credit || 0),
      balance: Number(running.toFixed(2)),
      note: ev.note || '',
    };
  });

  const totals = rows.reduce((acc, r) => {
    acc.bills += 1;
    acc.bill_total += Number(r.bill_total || 0);
    acc.received += Number(r.received || 0);
    acc.outstanding += Number(r.outstanding || 0);
    return acc;
  }, { bills: 0, bill_total: 0, received: 0, outstanding: 0 });

  totals.bill_total = Number(totals.bill_total.toFixed(2));
  totals.received = Number(totals.received.toFixed(2));
  totals.outstanding = Number(totals.outstanding.toFixed(2));

  return {
    meta: {
      firm,
      party,
      from,
      to,
      as_of: asOf,
      generated_at: new Date().toISOString(),
    },
    rows,
    transactions,
    totals,
  };
}

async function computeGrossTotalForBill({
  firmId,
  partyId,
  from,
  to,
  firmGst,
  gstType,
  cgstRate,
  sgstRate,
  igstRate,
  brokerage,
}) {
  const [rows] = await pool.execute(
    `SELECT c.seller_id, c.buyer_id, c.seller_brokerage, c.buyer_brokerage, c.min_qty, c.max_qty
       FROM contracts c
      WHERE c.firm_id = ?
        AND c.deleted_at IS NULL
        AND c.order_date BETWEEN ? AND ?
        AND (c.seller_id = ? OR c.buyer_id = ?)`,
    [firmId, from, to, partyId, partyId]
  );

  const overrideRate = brokerage != null && brokerage !== '' ? Number(brokerage) : null;
  let subtotal = 0;
  for (const r of rows) {
    const role = r.seller_id === partyId ? 'SELLER' : 'BUYER';
    const qty = Number(r.max_qty ?? r.min_qty ?? 0) || 0;
    const rate = (overrideRate != null && !Number.isNaN(overrideRate))
      ? overrideRate
      : (role === 'SELLER'
        ? Number(r.seller_brokerage || DEFAULT_BROKERAGE)
        : Number(r.buyer_brokerage || DEFAULT_BROKERAGE));
    subtotal += qty * rate;
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (firmGst) {
    if (gstType === 'INTRA') {
      cgst = subtotal * (Number(cgstRate || 0) / 100);
      sgst = subtotal * (Number(sgstRate || 0) / 100);
    } else if (gstType === 'INTER') {
      igst = subtotal * (Number(igstRate || 0) / 100);
    }
  }

  const total = Number((subtotal + cgst + sgst + igst).toFixed(2));
  return { subtotal, cgst, sgst, igst, total };
}

async function resolveRange({ fyId, fromInput, toInput }) {
  const from = normalizeDate(fromInput);
  const to = normalizeDate(toInput);
  if (from && to) return [from, to];

  if (fyId) {
    const [[fy]] = await pool.execute(
      'SELECT start_date, end_date FROM fiscal_years WHERE id = ? LIMIT 1',
      [fyId]
    );
    if (fy) {
      const fyFrom = toDateStr(fy.start_date);
      const fyTo = toDateStr(fy.end_date);
      return [from || fyFrom, to || fyTo];
    }
  }

  const today = toDateStr(new Date());
  return [from || today, to || today];
}

function normalizeDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function toDateStr(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = router;
