/*
  Danger: Truncate all business tables to empty the database (keep schema).
  Usage: npm run reset
  Notes:
    - Leaves app_migrations intact so your schema/migrations state is preserved
    - Leaves tables present; only data is removed
*/
require('dotenv').config();
const { pool } = require('../src/lib/db');

const TABLES_IN_ORDER = [
  // child → parent order
  'party_bill_receipts',
  'party_bills',
  'contracts',
  'party_emails',
  'users',
  'parties',
  'products',
  'firms',
  'fiscal_years',
];

async function run(){
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    for (const t of TABLES_IN_ORDER) {
      try {
        await conn.query(`TRUNCATE TABLE ${t}`);
        console.log('Truncated', t);
      } catch (e) {
        console.warn('Skip/failed', t, e.code || e.message);
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    await conn.commit();
    console.log('Reset complete. All data removed (schema intact).');
  } catch (e) {
    await conn.rollback();
    console.error('Reset failed:', e);
    process.exitCode = 1;
  } finally {
    conn.release();
    pool.end();
  }
}

run();

