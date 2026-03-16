const { pool } = require('./db');

async function allocateNextBillNo(conn, firmId, fiscalYearId) {
  if (!firmId || !fiscalYearId) {
    throw new Error('firm_id and fiscal_year_id are required for bill number allocation');
  }

  await conn.execute(
    `INSERT INTO party_bill_sequences (firm_id, fiscal_year_id, next_no)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE next_no = next_no`,
    [firmId, fiscalYearId]
  );

  const [[row]] = await conn.execute(
    `SELECT next_no
       FROM party_bill_sequences
      WHERE firm_id = ? AND fiscal_year_id = ?
      FOR UPDATE`,
    [firmId, fiscalYearId]
  );

  const nextNo = Number(row?.next_no || 1);

  await conn.execute(
    `UPDATE party_bill_sequences
        SET next_no = ?, updated_at = CURRENT_TIMESTAMP
      WHERE firm_id = ? AND fiscal_year_id = ?`,
    [nextNo + 1, firmId, fiscalYearId]
  );

  return String(nextNo);
}

async function withBillNoTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  allocateNextBillNo,
  withBillNoTransaction,
};
