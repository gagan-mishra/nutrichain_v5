const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATE/DATETIME as strings to avoid timezone shifts in JS
  dateStrings: true,
  // Keep timezone stable; adjust if your server uses a different TZ
  timezone: 'Z'
});

module.exports = { pool };
