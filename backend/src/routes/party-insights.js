const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { requireContext } = require('../middleware/context');
const { renderPdfFromHtml } = require('../lib/pdf-renderer');
const { derivePartyInsights, resolveInsightPeriod } = require('../lib/party-insights');
const { buildPartyInsightsPrintHtml } = require('../lib/party-insights-template');
const { buildLedgerPayload } = require('./party-ledger');

const router = express.Router();
router.use(requireAuth, requireContext);

router.get('/', async (req, res) => {
  try {
    const partyId = Number(req.query.party_id);
    if (!partyId) return res.status(400).json({ error: 'party_id required' });
    res.json(await buildPartyInsightsPayload({
      firmId: req.ctx.firmId,
      fyId: req.ctx.fyId,
      partyId,
      periodKey: req.query.period,
    }));
  } catch (error) {
    console.error('party-insights GET error:', error);
    if (error?.httpStatus) return res.status(error.httpStatus).json({ error: error.message });
    res.status(500).json({ error: 'failed to build party insights' });
  }
});

router.get('/pdf', async (req, res) => {
  try {
    const partyId = Number(req.query.party_id);
    if (!partyId) return res.status(400).json({ error: 'party_id required' });

    const payload = await buildPartyInsightsPayload({
      firmId: req.ctx.firmId,
      fyId: req.ctx.fyId,
      partyId,
      periodKey: req.query.period,
    });
    const pdf = await renderPdfFromHtml(buildPartyInsightsPrintHtml(payload), {
      format: 'A4',
      printBackground: true,
      margin: { top: '9mm', right: '9mm', bottom: '9mm', left: '9mm' },
    });

    const partyName = String(payload.meta.party.name || `party-${partyId}`)
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const fyLabel = String(payload.meta.fy.label || 'FY').replace(/[^\w.-]+/g, '-');
    const periodLabel = String(payload.meta.period.key || 'consolidated').toUpperCase();
    const filename = `Insights-${partyName}-${fyLabel}-${periodLabel}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (error) {
    console.error('party-insights PDF error:', error);
    if (error?.httpStatus) return res.status(error.httpStatus).json({ error: error.message });
    res.status(500).json({ error: 'failed to generate party insights pdf' });
  }
});

async function buildPartyInsightsPayload({ firmId, fyId, partyId, periodKey = 'consolidated', today = new Date() }) {
  if (!fyId) {
    const error = new Error('Select a fiscal year');
    error.httpStatus = 400;
    throw error;
  }

  const [[[firm]], [[party]], [[fy]]] = await Promise.all([
    pool.execute('SELECT id, name, address, gst_no FROM firms WHERE id = ? LIMIT 1', [firmId]),
    pool.execute('SELECT id, name, address, contact, gst_no FROM parties WHERE id = ? LIMIT 1', [partyId]),
    pool.execute('SELECT id, label, start_date, end_date FROM fiscal_years WHERE id = ? LIMIT 1', [fyId]),
  ]);

  if (!firm) throwHttp(404, 'Firm not found');
  if (!party) throwHttp(404, 'Party not found');
  if (!fy) throwHttp(404, 'Fiscal year not found');
  const period = resolveInsightPeriod(fy, periodKey, today);
  if (!period) throwHttp(400, 'Invalid report period');

  const [contracts] = await pool.execute(
    `SELECT c.id, c.contract_no, c.order_date, c.product_id,
            c.seller_id, c.buyer_id,
            COALESCE(c.max_qty, c.min_qty, 0) AS qty,
            c.unit, c.price, c.status,
            product.name AS product_name,
            seller.name AS seller_name,
            buyer.name AS buyer_name
       FROM contracts c
       LEFT JOIN products product ON product.id = c.product_id
       LEFT JOIN parties seller ON seller.id = c.seller_id
       LEFT JOIN parties buyer ON buyer.id = c.buyer_id
      WHERE c.firm_id = ?
        AND c.fiscal_year_id = ?
        AND c.deleted_at IS NULL
        AND (c.seller_id = ? OR c.buyer_id = ?)
        AND c.order_date BETWEEN ? AND ?
      ORDER BY c.order_date ASC, c.id ASC`,
    [firmId, fyId, partyId, partyId, period.start_date, period.end_date]
  );

  const todayText = toDateStr(today);
  const ledger = await buildLedgerPayload({
    firmId,
    fyId,
    partyId,
    fromInput: period.start_date,
    toInput: period.end_date,
    asOfInput: todayText,
  });
  const insights = derivePartyInsights({
    contracts,
    partyId,
    period,
    financial: ledger.totals,
    today,
  });

  return {
    meta: {
      firm,
      party,
      fy: {
        id: fy.id,
        label: fy.label,
        start_date: toDateStr(fy.start_date),
        end_date: toDateStr(fy.end_date),
      },
      period,
      generated_at: new Date().toISOString(),
      scope: 'current_firm_fy_and_period',
    },
    ...insights,
  };
}

function throwHttp(status, message) {
  const error = new Error(message);
  error.httpStatus = status;
  throw error;
}

function toDateStr(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = router;
module.exports.buildPartyInsightsPayload = buildPartyInsightsPayload;
