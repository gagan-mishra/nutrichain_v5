// Lightweight scheduler to auto-create Party Bills on FY year-end (31 Mar)
// Disabled by default. Enable with env BILLING_AUTO_BILL=1

const { pool } = require("../lib/db");

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isMarch31(date) {
  return date.getMonth() === 2 && date.getDate() === 31; // 0=Jan
}

async function createBillsForFY(firmId, fyId, startDate, endDate) {
  // Parties that traded in the FY for this firm
  const [parties] = await pool.execute(
    `SELECT DISTINCT party_id FROM (
       SELECT seller_id AS party_id FROM contracts
        WHERE firm_id = ? AND deleted_at IS NULL AND fiscal_year_id = ?
       UNION
       SELECT buyer_id AS party_id FROM contracts
        WHERE firm_id = ? AND deleted_at IS NULL AND fiscal_year_id = ?
     ) q WHERE party_id IS NOT NULL`,
    [firmId, fyId, firmId, fyId]
  );

  for (const row of parties) {
    const partyId = row.party_id;
    // Check if a bill already exists for this party+firm+FY
    const [[exists]] = await pool.execute(
      `SELECT id FROM party_bills WHERE firm_id = ? AND fiscal_year_id = ? AND party_id = ? LIMIT 1`,
      [firmId, fyId, partyId]
    );
    if (exists) continue;

    // Determine next bill number within firm & FY (numeric if possible)
    const [[num]] = await pool.execute(
      `SELECT COALESCE(MAX(CAST(bill_no AS UNSIGNED)), 0) AS max_no
         FROM party_bills WHERE firm_id = ? AND fiscal_year_id = ?`,
      [firmId, fyId]
    );
    const nextNo = String((num?.max_no || 0) + 1);

    await pool.execute(
      `INSERT INTO party_bills
        (firm_id, fiscal_year_id, party_id, bill_no, from_date, to_date, bill_date, brokerage)
       VALUES (?,?,?,?,?,?,?,?)`,
      [firmId, fyId, partyId, nextNo, startDate, endDate, endDate, 30]
    );
  }
}

async function tick() {
  try {
    const now = new Date();
    if (!isMarch31(now)) return; // only run on Mar 31
    const today = toDateStr(now);

    // Find all firms + their FY whose end_date equals today
    const [rows] = await pool.execute(
      `SELECT f.id AS firm_id, fy.id AS fy_id, fy.start_date AS startDate, fy.end_date AS endDate
         FROM firms f
         JOIN fiscal_years fy ON 1=1
        WHERE fy.end_date = ?`,
      [today]
    );
    for (const r of rows) {
      await createBillsForFY(r.firm_id, r.fy_id, r.startDate, r.endDate);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Auto-billing cron error:", e);
  }
}

function startBillingCron() {
  if (process.env.BILLING_AUTO_BILL !== "1") return; // opt-in
  // Run at startup and then hourly
  tick();
  setInterval(tick, 60 * 60 * 1000);
  // eslint-disable-next-line no-console
  console.log("Billing cron enabled (hourly checks, runs on Mar 31)");
}

module.exports = { startBillingCron };

