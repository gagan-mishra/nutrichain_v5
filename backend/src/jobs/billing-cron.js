// Lightweight scheduler to auto-create Party Bills on FY year-end (31 Mar)
// Disabled by default. Enable with env BILLING_AUTO_BILL=1

const { pool } = require('../lib/db');
const { allocateNextBillNo, withBillNoTransaction } = require('../lib/bill-number-sequence');
const AUTO_BILL_BROKERAGE = 40;

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isMarch31(date) {
  return date.getMonth() === 2 && date.getDate() === 31; // 0=Jan
}

async function createBillForParty(firmId, fyId, partyId, startDate, endDate) {
  try {
    return await withBillNoTransaction(async (conn) => {
      const [[exists]] = await conn.execute(
        `SELECT id FROM party_bills WHERE firm_id = ? AND fiscal_year_id = ? AND party_id = ? LIMIT 1`,
        [firmId, fyId, partyId]
      );
      if (exists) return false;

      // Allocate and insert in one transaction so failed inserts do not consume numbers.
      const billNo = await allocateNextBillNo(conn, firmId, fyId);

      await conn.execute(
        `INSERT INTO party_bills
          (firm_id, fiscal_year_id, party_id, bill_no, from_date, to_date, bill_date, brokerage)
         VALUES (?,?,?,?,?,?,?,?)`,
        [firmId, fyId, partyId, billNo, startDate, endDate, endDate, AUTO_BILL_BROKERAGE]
      );

      return true;
    });
  } catch (e) {
    const isDup = e?.code === 'ER_DUP_ENTRY';
    const msg = String(e?.sqlMessage || '');

    // Another worker inserted same bill concurrently; rollback preserves sequence correctness.
    if (isDup && (msg.includes('uq_bill_firm_fy_party') || msg.includes('uq_bill_firm_fy_no'))) {
      return false;
    }

    throw e;
  }
}

async function createBillsForFY(firmId, fyId, startDate, endDate) {
  // Parties that traded in the FY for this firm (deterministic order for deterministic numbering)
  const [parties] = await pool.execute(
    `SELECT DISTINCT party_id FROM (
       SELECT seller_id AS party_id FROM contracts
        WHERE firm_id = ? AND deleted_at IS NULL AND fiscal_year_id = ?
       UNION
       SELECT buyer_id AS party_id FROM contracts
        WHERE firm_id = ? AND deleted_at IS NULL AND fiscal_year_id = ?
     ) q WHERE party_id IS NOT NULL
     ORDER BY party_id ASC`,
    [firmId, fyId, firmId, fyId]
  );

  let billsCreated = 0;
  for (const row of parties) {
    const partyId = row.party_id;
    const created = await createBillForParty(firmId, fyId, partyId, startDate, endDate);
    if (created) billsCreated += 1;
  }

  return {
    partiesSeen: parties.length,
    billsCreated,
  };
}

async function runBillingForDate(date = new Date(), options = {}) {
  const { ignoreDateCheck = false } = options;

  if (!ignoreDateCheck && !isMarch31(date)) {
    return {
      ran: false,
      reason: 'not_march_31',
      date: toDateStr(date),
      fyMatched: 0,
      partiesSeen: 0,
      billsCreated: 0,
    };
  }

  const today = toDateStr(date);

  // Find all firms + their FY whose end_date equals today
  const [rows] = await pool.execute(
    `SELECT f.id AS firm_id, fy.id AS fy_id, fy.start_date AS startDate, fy.end_date AS endDate
       FROM firms f
       JOIN fiscal_years fy ON 1=1
      WHERE fy.end_date = ?`,
    [today]
  );

  let partiesSeen = 0;
  let billsCreated = 0;

  for (const r of rows) {
    const summary = await createBillsForFY(r.firm_id, r.fy_id, r.startDate, r.endDate);
    partiesSeen += summary.partiesSeen;
    billsCreated += summary.billsCreated;
  }

  return {
    ran: true,
    date: today,
    fyMatched: rows.length,
    partiesSeen,
    billsCreated,
  };
}

async function tick() {
  try {
    await runBillingForDate(new Date());
  } catch (e) {
    console.error('Auto-billing cron error:', e);
  }
}

function startBillingCron() {
  if (process.env.BILLING_AUTO_BILL !== '1') return; // opt-in
  // Run at startup and then hourly
  tick();
  setInterval(tick, 60 * 60 * 1000);
  console.log('Billing cron enabled (hourly checks, runs on Mar 31)');
}

module.exports = {
  startBillingCron,
  runBillingForDate,
  isMarch31,
};
