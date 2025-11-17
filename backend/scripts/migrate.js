/* Simple migration runner.
   - Applies SQL files from scripts/migrations in order
   - Records applied files in app_migrations
   Usage: npm run migrate
*/
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/lib/db');

async function ensureTable(conn){
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function splitStatements(sql){
  return sql
    .split(/;\s*\n/g)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.endsWith(';') ? s : s + ';');
}

function isBenign(err){
  return new Set([
    'ER_DUP_FIELDNAME',
    'ER_CANT_DROP_FIELD_OR_KEY',
    'ER_DUP_KEYNAME',
    'ER_TABLE_EXISTS_ERROR',
    'ER_DUP_ENTRY',
    'ER_FK_DUP_NAME',
    'ER_CANNOT_ADD_FOREIGN',
  ]).has(err?.code);
}

async function run(){
  const conn = await pool.getConnection();
  try {
    await ensureTable(conn);
    const dir = path.join(__dirname, 'migrations');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort() : [];
    const [appliedRows] = await conn.execute('SELECT filename FROM app_migrations');
    const done = new Set(appliedRows.map(r=>r.filename));
    for (const file of files){
      if (done.has(file)) continue;
      const full = path.join(dir, file);
      const sql = fs.readFileSync(full, 'utf8');
      const stmts = splitStatements(sql);
      console.log('Applying', file, `(${stmts.length} statements)`);
      await conn.beginTransaction();
      try {
        for (const s of stmts){
          // Use raw query to support statements like PREPARE/EXECUTE/DEALLOCATE and SET
          try { await conn.query(s); }
          catch (e) { if (isBenign(e)) console.log('  skipped:', e.code); else throw e; }
        }
        await conn.execute('INSERT INTO app_migrations (filename) VALUES (?)', [file]);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        console.error('Migration failed for', file, e);
        process.exitCode = 1;
        break;
      }
    }
  } finally {
    conn.release();
    pool.end();
  }
}

run();

