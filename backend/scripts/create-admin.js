require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/lib/db');

/*
  Usage:
    ADMIN_USERNAME=admin ADMIN_PASSWORD=secret ADMIN_FIRM_ID=1 npm run init-admin

  Notes:
  - Intended for ops/production bootstrap without exposing a public endpoint.
  - Fails if a user with the same username exists (won’t overwrite silently).
*/

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const firmId = Number(process.env.ADMIN_FIRM_ID);

  if (!username || !password || !firmId) {
    console.error('Missing ADMIN_USERNAME, ADMIN_PASSWORD, or ADMIN_FIRM_ID');
    process.exit(1);
  }

  const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (existing.length) {
    console.error('User already exists; refusing to overwrite.');
    process.exit(2);
  }

  const hash = await bcrypt.hash(password, 12);
  const [r] = await pool.execute(
    'INSERT INTO users (username, password_hash, firm_id) VALUES (?,?,?)',
    [username, hash, firmId]
  );

  console.log(`Created admin user '${username}' (id=${r.insertId}) for firm ${firmId}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

