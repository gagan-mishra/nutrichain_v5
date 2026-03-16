const { pool } = require('../lib/db');

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function currentFyFor(date = new Date()) {
  const y = date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear(); // FY starts Apr 1
  const start = new Date(y, 3, 1); // Apr 1
  const end = new Date(y + 1, 2, 31); // Mar 31
  const label = `${y}-${String(y + 1).slice(-2)}`;
  return { label, start: toYMD(start), end: toYMD(end) };
}

function nextFyFor(date = new Date()) {
  const cur = currentFyFor(date);
  const y = Number(cur.label.slice(0, 4)) + 1;
  const start = new Date(y, 3, 1);
  const end = new Date(y + 1, 2, 31);
  const label = `${y}-${String(y + 1).slice(-2)}`;
  return { label, start: toYMD(start), end: toYMD(end) };
}

function shouldEnsureNextFy(date = new Date()) {
  // Show upcoming FY from Mar 26 onward each year.
  return date.getMonth() === 2 && date.getDate() >= 26;
}

async function ensureFyExists({ label, start, end }) {
  const [[row]] = await pool.execute(
    `SELECT id FROM fiscal_years WHERE label = ? OR (start_date = ? AND end_date = ?) LIMIT 1`,
    [label, start, end]
  );
  if (row) return row.id;
  const [r] = await pool.execute(
    `INSERT INTO fiscal_years (label, start_date, end_date) VALUES (?,?,?)`,
    [label, start, end]
  );
  return r.insertId;
}

async function ensureFiscalYears(today = new Date()) {
  // Always ensure current FY exists
  await ensureFyExists(currentFyFor(today));
  // Ensure next FY appears from Mar 26 (so users can prepare before Apr 1)
  if (shouldEnsureNextFy(today)) {
    await ensureFyExists(nextFyFor(today));
  }
}

function startFyEnsureCron() {
  // Run once at startup
  ensureFiscalYears().catch(() => {});
  // Then daily
  const oneDay = 24 * 60 * 60 * 1000;
  setInterval(() => ensureFiscalYears().catch(() => {}), oneDay);
}

module.exports = {
  currentFyFor,
  nextFyFor,
  shouldEnsureNextFy,
  ensureFiscalYears,
  startFyEnsureCron,
};
