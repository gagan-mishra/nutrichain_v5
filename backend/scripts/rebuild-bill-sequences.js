require('dotenv').config();

const { pool } = require('../src/lib/db');

async function rebuildBillSequences() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO party_bill_sequences (firm_id, fiscal_year_id, next_no)
       SELECT
         firm_id,
         fiscal_year_id,
         COALESCE(
           MAX(CASE WHEN bill_no REGEXP '^[0-9]+$' THEN CAST(bill_no AS UNSIGNED) ELSE 0 END),
           0
         ) + 1 AS next_no
       FROM party_bills
       WHERE fiscal_year_id IS NOT NULL
       GROUP BY firm_id, fiscal_year_id
       ON DUPLICATE KEY UPDATE next_no = VALUES(next_no), updated_at = CURRENT_TIMESTAMP`,
    );

    await conn.execute(
      `DELETE s
         FROM party_bill_sequences s
         LEFT JOIN (
           SELECT DISTINCT firm_id, fiscal_year_id
             FROM party_bills
            WHERE fiscal_year_id IS NOT NULL
         ) b
           ON b.firm_id = s.firm_id AND b.fiscal_year_id = s.fiscal_year_id
        WHERE b.firm_id IS NULL`,
    );

    const [rows] = await conn.execute(
      `SELECT s.firm_id, s.fiscal_year_id, s.next_no
         FROM party_bill_sequences s
        ORDER BY s.firm_id, s.fiscal_year_id`,
    );

    await conn.commit();

    console.log(`Rebuilt bill sequences for ${rows.length} firm/FY buckets.`);
    if (rows.length) console.table(rows);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

rebuildBillSequences()
  .catch((e) => {
    console.error('rebuild-bill-sequences failed:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // no-op
    }
  });

