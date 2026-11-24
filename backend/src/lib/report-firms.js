const { pool } = require('./db');

async function listAccessibleFirms(userId) {
  if (!userId) return [];
  let useUserFirmScope = false;
  try {
    const [[cnt]] = await pool.execute('SELECT COUNT(*) AS c FROM user_firms WHERE user_id = ?', [userId]);
    useUserFirmScope = (cnt?.c || 0) > 0;
  } catch (e) {
    if (e?.code !== 'ER_NO_SUCH_TABLE' || !String(e?.message || '').includes('user_firms')) throw e;
    console.warn('user_firms table missing; reports fallback to all firms');
  }

  if (useUserFirmScope) {
    const [rows] = await pool.execute(
      `SELECT f.id, f.name
         FROM firms f
         JOIN user_firms uf ON uf.firm_id = f.id AND uf.user_id = ?
        ORDER BY f.name ASC`,
      [userId]
    );
    return rows || [];
  }

  const [rows] = await pool.execute('SELECT id, name FROM firms ORDER BY name ASC');
  return rows || [];
}

module.exports = { listAccessibleFirms };
