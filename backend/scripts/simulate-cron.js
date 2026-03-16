require('dotenv').config();

const { pool } = require('../src/lib/db');
const {
  ensureFiscalYears,
  currentFyFor,
  nextFyFor,
  shouldEnsureNextFy,
} = require('../src/jobs/fy-ensure');
const { runBillingForDate } = require('../src/jobs/billing-cron');

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(input) {
  if (!input) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input).trim());
  if (!m) throw new Error('Invalid --date. Use YYYY-MM-DD');
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mon - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mon - 1 || d.getDate() !== day) {
    throw new Error('Invalid --date. Use a real calendar date like 2027-03-31');
  }
  return d;
}

function getArg(name) {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf(name);
  if (idx < 0 || idx === argv.length - 1) return null;
  return argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

function printUsage() {
  console.log('Usage: npm run simulate-cron -- [--date YYYY-MM-DD] [--only-fy] [--only-billing] [--force]');
  console.log('');
  console.log('Examples:');
  console.log('  npm run simulate-cron -- --date 2027-03-26 --only-fy');
  console.log('  npm run simulate-cron -- --date 2027-03-31 --only-billing');
  console.log('  npm run simulate-cron -- --date 2027-03-20 --only-billing --force');
}

async function runFy(date) {
  await ensureFiscalYears(date);

  const labels = [currentFyFor(date).label];
  if (shouldEnsureNextFy(date)) labels.push(nextFyFor(date).label);

  const placeholders = labels.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, label, start_date, end_date
       FROM fiscal_years
      WHERE label IN (${placeholders})
      ORDER BY start_date ASC`,
    labels
  );

  return {
    labelsExpected: labels,
    rows,
  };
}

async function runBilling(date, force) {
  return runBillingForDate(date, { ignoreDateCheck: force });
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage();
    return;
  }

  const onlyFy = hasFlag('--only-fy');
  const onlyBilling = hasFlag('--only-billing');
  const force = hasFlag('--force');
  const date = parseDate(getArg('--date'));

  console.log(`Simulating cron date: ${toDateStr(date)}`);

  if (!onlyBilling) {
    const fy = await runFy(date);
    console.log('[FY ensure] expected labels:', fy.labelsExpected.join(', '));
    console.table(fy.rows);
  }

  if (!onlyFy) {
    const billing = await runBilling(date, force);
    console.log('[Auto billing] summary:');
    console.log(JSON.stringify(billing, null, 2));
  }
}

main()
  .catch((e) => {
    console.error('simulate-cron failed:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // no-op
    }
  });
