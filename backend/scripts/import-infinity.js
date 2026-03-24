require('dotenv').config();
const mysql = require('mysql2/promise');
const { pool: targetPool } = require('../src/lib/db');

function usage() {
  console.log('Usage: npm run import-infinity -- [--apply] [--include-deleted] [--source-db NAME] [--source-host HOST] [--source-port PORT] [--source-user USER] [--source-pass PASS]');
  console.log('');
  console.log('Defaults:');
  console.log('  dry-run mode (no writes persisted) unless --apply is provided');
  console.log('  source host/user/pass fall back to INF_SRC_* env, then DB_* env');
  console.log("  source db defaults to INF_SRC_DB_NAME or 'infinity_deepakent'");
}

function parseArgs(argv) {
  const opts = {
    apply: false,
    includeDeleted: false,
    sourceDb: process.env.INF_SRC_DB_NAME || 'infinity_deepakent',
    sourceHost: process.env.INF_SRC_DB_HOST || process.env.DB_HOST || 'localhost',
    sourcePort: Number(process.env.INF_SRC_DB_PORT || process.env.DB_PORT || 3306),
    sourceUser: process.env.INF_SRC_DB_USER || process.env.DB_USER || 'root',
    sourcePass: process.env.INF_SRC_DB_PASS || process.env.DB_PASS || '',
    sourceSsl: String(process.env.INF_SRC_DB_SSL || '').toLowerCase() === 'true',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--include-deleted') opts.includeDeleted = true;
    else if (a === '--source-db') opts.sourceDb = String(argv[++i] || '').trim();
    else if (a === '--source-host') opts.sourceHost = String(argv[++i] || '').trim();
    else if (a === '--source-port') opts.sourcePort = Number(argv[++i] || 3306);
    else if (a === '--source-user') opts.sourceUser = String(argv[++i] || '').trim();
    else if (a === '--source-pass') opts.sourcePass = String(argv[++i] || '');
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  if (!opts.sourceDb) throw new Error('--source-db is required');
  if (!opts.sourceHost) throw new Error('--source-host is required');
  if (!opts.sourceUser) throw new Error('--source-user is required');
  if (!Number.isFinite(opts.sourcePort) || opts.sourcePort <= 0) {
    throw new Error('--source-port must be a positive number');
  }

  return opts;
}

function normalizeWhitespace(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanText(v) {
  const t = normalizeWhitespace(decodeHtml(v));
  return t || null;
}

function cleanTextMax(v, maxLen) {
  const t = cleanText(v);
  if (!t) return null;
  if (!Number.isFinite(maxLen) || maxLen <= 0) return t;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function clip(v, maxLen) {
  const s = String(v || '');
  if (!Number.isFinite(maxLen) || maxLen <= 0) return s;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeName(v) {
  return normalizeWhitespace(decodeHtml(v)).toLowerCase();
}

function yes(v) {
  return /^(yes|y|true|1)$/i.test(String(v || '').trim());
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cleanDate(v, fallback = null) {
  const s = String(v || '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && s !== '0000-00-00') return s;
  return fallback;
}

function cleanGst(v) {
  const s = normalizeWhitespace(String(v || '').toUpperCase());
  if (!s) return null;
  const m = s.match(/[0-9A-Z]{15}/);
  return m ? m[0] : s;
}

function mapGstType(v, cgst, sgst, igst) {
  const s = String(v || '').toLowerCase();
  if (s.includes('inter')) return 'INTER';
  if (s.includes('intra')) return 'INTRA';
  const c = toNumber(cgst, 0);
  const sg = toNumber(sgst, 0);
  const ig = toNumber(igst, 0);
  if (ig > 0 && c === 0 && sg === 0) return 'INTER';
  return 'INTRA';
}

function parseLegacyFy(raw) {
  const src = String(raw || '').trim();
  if (!src) return null;
  const ys = src.match(/\d{4}/g) || [];
  if (!ys.length) return null;

  const y0 = Number(ys[0]);
  let y1 = ys[1] ? Number(ys[1]) : y0 + 1;
  if (!Number.isFinite(y0) || y0 < 1900 || y0 > 2200) return null;
  if (!Number.isFinite(y1) || y1 < 1900 || y1 > 2200) y1 = y0 + 1;
  if (y1 < y0) y1 = y0 + 1;
  if (y1 > y0 + 2) y1 = y0 + 1;

  const label = `${y0}-${String(y1).slice(-2)}`;
  const start = `${y0}-04-01`;
  const end = `${y1}-03-31`;
  return { label, start, end };
}

function sanitizeMode(v) {
  const mode = normalizeWhitespace(v).toUpperCase();
  if (!mode) return null;
  return mode.slice(0, 20);
}

function normalizeBillNo(v) {
  const s = normalizeWhitespace(v);
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n) && Number.isInteger(n) && n > 0) return String(n);
  return s.slice(0, 64);
}

function listEmails(row) {
  const raw = [row.party_email, row.party_other_email, row.party3_email]
    .map((v) => String(v || ''))
    .join(';');

  const parts = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const uniq = new Set();
  for (const e of parts) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) uniq.add(e);
  }
  return [...uniq];
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function tableExists(sourcePool, tableName) {
  const [rows] = await sourcePool.execute(
    `SELECT COUNT(*) AS c
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function ensureImportMapTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS legacy_infinity_import_map (
      entity VARCHAR(40) NOT NULL,
      source_id BIGINT NOT NULL,
      target_id BIGINT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity, source_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getMappedId(conn, entity, sourceId) {
  const [rows] = await conn.execute(
    'SELECT target_id FROM legacy_infinity_import_map WHERE entity = ? AND source_id = ? LIMIT 1',
    [entity, sourceId],
  );
  return rows[0]?.target_id ? Number(rows[0].target_id) : null;
}

async function putMappedId(conn, entity, sourceId, targetId) {
  await conn.execute(
    `INSERT INTO legacy_infinity_import_map (entity, source_id, target_id)
     VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE target_id = VALUES(target_id)`,
    [entity, sourceId, targetId],
  );
}

async function ensureFiscalYear(conn, fyCache, rawFy, stats) {
  const key = String(rawFy || '').trim();
  if (!key) {
    stats.fy.invalid += 1;
    return null;
  }
  if (fyCache.has(key)) return fyCache.get(key);

  const parsed = parseLegacyFy(key);
  if (!parsed) {
    stats.fy.invalid += 1;
    return null;
  }

  const [rows] = await conn.execute(
    `SELECT id, label, start_date, end_date
       FROM fiscal_years
      WHERE label = ? OR (start_date = ? AND end_date = ?)
      LIMIT 1`,
    [parsed.label, parsed.start, parsed.end],
  );

  let fy;
  if (rows[0]) {
    fy = {
      id: Number(rows[0].id),
      label: rows[0].label,
      start: String(rows[0].start_date).slice(0, 10),
      end: String(rows[0].end_date).slice(0, 10),
    };
    stats.fy.reused += 1;
  } else {
    const [r] = await conn.execute(
      'INSERT INTO fiscal_years (label, start_date, end_date) VALUES (?,?,?)',
      [parsed.label, parsed.start, parsed.end],
    );
    fy = { id: Number(r.insertId), label: parsed.label, start: parsed.start, end: parsed.end };
    stats.fy.inserted += 1;
  }

  fyCache.set(key, fy);
  return fy;
}

async function findFirmByNormalizedName(conn, normalizedName) {
  const [rows] = await conn.execute('SELECT id, name FROM firms');
  return rows.find((r) => normalizeName(r.name) === normalizedName) || null;
}

async function ensureFirm(conn, firmRow, firmBySourceId, firmByNormName, stats) {
  const sourceId = Number(firmRow.cmp_id);
  if (!Number.isFinite(sourceId)) return null;
  if (firmBySourceId.has(sourceId)) return firmBySourceId.get(sourceId);

  const mapped = await getMappedId(conn, 'firm', sourceId);
  if (mapped) {
    firmBySourceId.set(sourceId, mapped);
    stats.firms.mapped += 1;
    return mapped;
  }

  const baseName = cleanTextMax(firmRow.cmp_name, 255) || `Legacy Firm ${sourceId}`;
  const norm = normalizeName(baseName);

  if (firmByNormName.has(norm)) {
    const existingId = firmByNormName.get(norm);
    firmBySourceId.set(sourceId, existingId);
    await putMappedId(conn, 'firm', sourceId, existingId);
    stats.firms.reused += 1;
    stats.firms.mapped += 1;
    return existingId;
  }

  const found = await findFirmByNormalizedName(conn, norm);
  if (found) {
    const existingId = Number(found.id);
    firmByNormName.set(norm, existingId);
    firmBySourceId.set(sourceId, existingId);
    await putMappedId(conn, 'firm', sourceId, existingId);
    stats.firms.reused += 1;
    stats.firms.mapped += 1;
    return existingId;
  }

  const pan = cleanText(firmRow.pan_card);
  const address = pan ? `PAN: ${pan}` : null;
  const gstNo = clip(cleanGst(firmRow.gst_no), 32) || null;

  let attempt = 0;
  while (true) {
    const name = attempt === 0 ? baseName : `${baseName} (Legacy ${sourceId}${attempt > 1 ? `-${attempt}` : ''})`;
    try {
      const [r] = await conn.execute(
        'INSERT INTO firms (name, address, gst_no) VALUES (?,?,?)',
        [name, address, gstNo],
      );
      const id = Number(r.insertId);
      firmBySourceId.set(sourceId, id);
      firmByNormName.set(norm, id);
      await putMappedId(conn, 'firm', sourceId, id);
      stats.firms.inserted += 1;
      stats.firms.mapped += 1;
      return id;
    } catch (e) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
      attempt += 1;
      if (attempt > 20) throw new Error(`Could not insert firm for cmp_id=${sourceId}; too many name conflicts`);
    }
  }
}

async function findProductByNormalizedName(conn, normalizedName) {
  const [rows] = await conn.execute('SELECT id, name FROM products');
  return rows.find((r) => normalizeName(r.name) === normalizedName) || null;
}

async function ensureProduct(conn, productRow, productBySourceId, productByNormName, unitBySourceProductId, stats) {
  const sourceId = Number(productRow.ID);
  if (!Number.isFinite(sourceId)) return null;
  if (productBySourceId.has(sourceId)) return productBySourceId.get(sourceId);

  const mapped = await getMappedId(conn, 'product', sourceId);
  if (mapped) {
    productBySourceId.set(sourceId, mapped);
    stats.products.mapped += 1;
    return mapped;
  }

  const baseName = cleanTextMax(productRow.product_name, 255) || `Legacy Product ${sourceId}`;
  const norm = normalizeName(baseName);

  if (productByNormName.has(norm)) {
    const existingId = productByNormName.get(norm);
    productBySourceId.set(sourceId, existingId);
    await putMappedId(conn, 'product', sourceId, existingId);
    stats.products.reused += 1;
    stats.products.mapped += 1;
    return existingId;
  }

  const found = await findProductByNormalizedName(conn, norm);
  if (found) {
    const existingId = Number(found.id);
    productByNormName.set(norm, existingId);
    productBySourceId.set(sourceId, existingId);
    await putMappedId(conn, 'product', sourceId, existingId);
    stats.products.reused += 1;
    stats.products.mapped += 1;
    return existingId;
  }

  const unit = cleanTextMax(unitBySourceProductId.get(sourceId), 16) || 'MT';

  let attempt = 0;
  while (true) {
    const name = attempt === 0 ? baseName : `${baseName} (Legacy ${sourceId}${attempt > 1 ? `-${attempt}` : ''})`;
    try {
      const [r] = await conn.execute('INSERT INTO products (name, unit) VALUES (?,?)', [name, unit]);
      const id = Number(r.insertId);
      productBySourceId.set(sourceId, id);
      productByNormName.set(norm, id);
      await putMappedId(conn, 'product', sourceId, id);
      stats.products.inserted += 1;
      stats.products.mapped += 1;
      return id;
    } catch (e) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
      attempt += 1;
      if (attempt > 20) throw new Error(`Could not insert product for ID=${sourceId}; too many name conflicts`);
    }
  }
}

async function findPartyCandidate(conn, name, gstNo, contact) {
  const [rows] = await conn.execute(
    'SELECT id, name, gst_no, contact FROM parties WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 200',
    [name],
  );

  const gst = cleanGst(gstNo) || '';
  const phone = normalizeWhitespace(contact || '');

  for (const r of rows) {
    const rg = cleanGst(r.gst_no) || '';
    const rc = normalizeWhitespace(r.contact || '');
    if (gst && rg && gst === rg) return Number(r.id);
    if (!gst && phone && rc && phone === rc) return Number(r.id);
  }

  if (rows[0]) return Number(rows[0].id);
  return null;
}

async function ensureParty(conn, partyRow, partyBySourceId, partyByKey, stats) {
  const sourceId = Number(partyRow.party_id);
  if (!Number.isFinite(sourceId)) return null;
  if (partyBySourceId.has(sourceId)) return partyBySourceId.get(sourceId);

  const mapped = await getMappedId(conn, 'party', sourceId);
  if (mapped) {
    partyBySourceId.set(sourceId, mapped);
    stats.parties.mapped += 1;
    return mapped;
  }

  const name = cleanTextMax(partyRow.party_name, 255) || `Legacy Party ${sourceId}`;
  const gstNo = clip(cleanGst(partyRow.gstno), 20) || null;
  const contact = cleanTextMax(partyRow.party_contact, 100);
  const key = `${normalizeName(name)}|${gstNo || ''}|${normalizeWhitespace(contact || '')}`;

  if (partyByKey.has(key)) {
    const existingId = partyByKey.get(key);
    partyBySourceId.set(sourceId, existingId);
    await putMappedId(conn, 'party', sourceId, existingId);
    stats.parties.reused += 1;
    stats.parties.mapped += 1;
    return existingId;
  }

  let existingId = await findPartyCandidate(conn, name, gstNo, contact);
  if (!existingId) {
    const gstType = mapGstType(partyRow.gst_type, partyRow.cgst, partyRow.sgst, partyRow.igst);
    const [r] = await conn.execute(
      `INSERT INTO parties
        (name, role, firm_id, address, contact, gst_no, gst_type, cgst_rate, sgst_rate, igst_rate, due_days)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name,
        'BOTH',
        null,
        cleanText(partyRow.party_address),
        contact,
        gstNo,
        gstType,
        toNumber(partyRow.cgst, 0),
        toNumber(partyRow.sgst, 0),
        toNumber(partyRow.igst, 0),
        null,
      ],
    );
    existingId = Number(r.insertId);
    stats.parties.inserted += 1;
  } else {
    stats.parties.reused += 1;
  }

  const emails = listEmails(partyRow);
  for (const email of emails) {
    const [r] = await conn.execute('INSERT IGNORE INTO party_emails (party_id, email) VALUES (?,?)', [existingId, email]);
    if (r.affectedRows) stats.parties.emailsInserted += 1;
    else stats.parties.emailsIgnored += 1;
  }

  partyBySourceId.set(sourceId, existingId);
  partyByKey.set(key, existingId);
  await putMappedId(conn, 'party', sourceId, existingId);
  stats.parties.mapped += 1;
  return existingId;
}

async function getPartyBill(conn, firmId, fyId, partyId) {
  const [rows] = await conn.execute(
    `SELECT id, bill_no, brokerage, bill_date
       FROM party_bills
      WHERE firm_id = ? AND fiscal_year_id = ? AND party_id = ?
      LIMIT 1`,
    [firmId, fyId, partyId],
  );
  return rows[0] || null;
}

async function ensurePartyBill(conn, input, stats) {
  const {
    firmId,
    fy,
    partyId,
    billNoRaw,
    billDateRaw,
    brokerageRaw,
    mailed,
  } = input;

  const existing = await getPartyBill(conn, firmId, fy.id, partyId);
  if (existing) {
    const nextBillNo = normalizeBillNo(billNoRaw);
    const nextDate = cleanDate(billDateRaw, fy.end);
    const nextBrokerage = toNumber(brokerageRaw, 0);

    const shouldUpdateNo = nextBillNo && !existing.bill_no;
    const shouldUpdateDate = nextDate && (!existing.bill_date || String(existing.bill_date).slice(0, 10) === '0000-00-00');
    const shouldUpdateBrok = nextBrokerage > 0 && toNumber(existing.brokerage, 0) === 0;
    const shouldUpdateMail = mailed;

    if (shouldUpdateDate || shouldUpdateBrok || shouldUpdateMail) {
      await conn.execute(
        `UPDATE party_bills
            SET bill_date = COALESCE(?, bill_date),
                brokerage = CASE WHEN ? > 0 THEN ? ELSE brokerage END,
                mailed_at = CASE WHEN ? = 1 THEN COALESCE(mailed_at, ?) ELSE mailed_at END
          WHERE id = ?`,
        [
          shouldUpdateDate ? nextDate : null,
          nextBrokerage,
          nextBrokerage,
          shouldUpdateMail ? 1 : 0,
          nowSql(),
          existing.id,
        ],
      );
    }

    if (shouldUpdateNo) {
      try {
        await conn.execute(
          `UPDATE party_bills
              SET bill_no = ?
            WHERE id = ? AND (bill_no IS NULL OR bill_no = '')`,
          [nextBillNo, existing.id],
        );
      } catch (e) {
        if (e?.code === 'ER_DUP_ENTRY') {
          stats.bills.billNoConflicts += 1;
          stats.warnings.push(
            `Skipped duplicate bill_no '${nextBillNo}' for firm_id=${firmId}, fy_id=${fy.id}, party_id=${partyId}`,
          );
        } else {
          throw e;
        }
      }
    }

    stats.bills.reused += 1;
    return Number(existing.id);
  }

  const billDate = cleanDate(billDateRaw, fy.end);
  const brokerage = toNumber(brokerageRaw, 0);
  let billNo = normalizeBillNo(billNoRaw);

  try {
    const [r] = await conn.execute(
      `INSERT INTO party_bills
        (firm_id, fiscal_year_id, party_id, bill_no, from_date, to_date, bill_date, brokerage, mailed_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [firmId, fy.id, partyId, billNo, fy.start, fy.end, billDate, brokerage, mailed ? nowSql() : null],
    );
    stats.bills.inserted += 1;
    return Number(r.insertId);
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      billNo = null;
      const [r] = await conn.execute(
        `INSERT INTO party_bills
          (firm_id, fiscal_year_id, party_id, bill_no, from_date, to_date, bill_date, brokerage, mailed_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [firmId, fy.id, partyId, billNo, fy.start, fy.end, billDate, brokerage, mailed ? nowSql() : null],
      );
      stats.bills.inserted += 1;
      stats.bills.billNoConflicts += 1;
      return Number(r.insertId);
    }
    throw e;
  }
}

async function refreshBillSequences(conn, stats) {
  try {
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

    stats.billSequencesRefreshed = true;
  } catch (e) {
    stats.warnings.push(`Could not refresh party_bill_sequences: ${e.message}`);
  }
}

async function importInfinity(opts) {
  const sourcePool = mysql.createPool({
    host: opts.sourceHost,
    port: Number(opts.sourcePort),
    user: opts.sourceUser,
    password: opts.sourcePass,
    database: opts.sourceDb,
    ssl: opts.sourceSsl ? { rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
    timezone: 'Z',
  });

  const stats = {
    source: { companies: 0, parties: 0, products: 0, orders: 0, bills: 0, receipts: 0 },
    firms: { mapped: 0, inserted: 0, reused: 0 },
    parties: { mapped: 0, inserted: 0, reused: 0, emailsInserted: 0, emailsIgnored: 0 },
    products: { mapped: 0, inserted: 0, reused: 0 },
    fy: { inserted: 0, reused: 0, invalid: 0 },
    contracts: { inserted: 0, skippedMapped: 0, skippedDeleted: 0, skippedMissingRef: 0 },
    bills: {
      inserted: 0,
      reused: 0,
      mapped: 0,
      mergedDuplicateByPartyFy: 0,
      skippedMapped: 0,
      skippedDeleted: 0,
      skippedMissingRef: 0,
      billNoConflicts: 0,
    },
    receipts: {
      inserted: 0,
      skippedMapped: 0,
      skippedMissingRef: 0,
      skippedMissingBill: 0,
      createdBillFallback: 0,
    },
    billSequencesRefreshed: false,
    warnings: [],
  };

  const tconn = await targetPool.getConnection();
  try {
    const requiredTables = ['company', 'party_registration', 'product', 'order_master', 'bill_master'];
    for (const t of requiredTables) {
      const exists = await tableExists(sourcePool, t);
      if (!exists) throw new Error(`Source table missing: ${t}`);
    }
    const hasBillReceived = await tableExists(sourcePool, 'bill_received');

    const [companiesRows, partiesRows, productsRows, ordersRows, billsRows, receiptsRows] = await Promise.all([
      sourcePool.query('SELECT cmp_id, cmp_name, isdelete, pan_card, gst_no FROM company ORDER BY cmp_id ASC'),
      sourcePool.query('SELECT party_id, party_name, party_address, party_contact, party_email, party_other_email, party3_email, gstno, isdelete, gst_type, cgst, sgst, igst FROM party_registration ORDER BY party_id ASC'),
      sourcePool.query('SELECT ID, product_name, isdelete FROM product ORDER BY ID ASC'),
      sourcePool.query('SELECT order_id, contractno, fyear, buyer_id, seller_id, seller_brokerage, brokerage, order_date, delivery_station, period, payment_type, terms, status, isdelete, email, msg, cmp_id, prd_id, minqty, maxqty, price, unit FROM order_master ORDER BY order_id ASC'),
      sourcePool.query('SELECT ID, fyear, cmp_id, bill_id, partyid, rate, bill_date, B_ID, isdelete, mail FROM bill_master ORDER BY ID ASC'),
      hasBillReceived
        ? sourcePool.query('SELECT pay_id, fyear, cmp_id, party_id, amount, date_of_pay, paymode, other_details FROM bill_received ORDER BY pay_id ASC')
        : [[], []],
    ]);

    const companies = companiesRows[0] || [];
    const sourceParties = partiesRows[0] || [];
    const sourceProducts = productsRows[0] || [];
    const sourceOrders = ordersRows[0] || [];
    const sourceBills = billsRows[0] || [];
    const sourceReceipts = hasBillReceived ? (receiptsRows[0] || []) : [];

    stats.source.companies = companies.length;
    stats.source.parties = sourceParties.length;
    stats.source.products = sourceProducts.length;
    stats.source.orders = sourceOrders.length;
    stats.source.bills = sourceBills.length;
    stats.source.receipts = sourceReceipts.length;

    await tconn.beginTransaction();
    await ensureImportMapTable(tconn);

    const unitBySourceProductId = new Map();
    for (const o of sourceOrders) {
      const pid = Number(o.prd_id);
      const unit = cleanText(o.unit);
      if (Number.isFinite(pid) && unit && !unitBySourceProductId.has(pid)) {
        unitBySourceProductId.set(pid, unit);
      }
    }

    const firmBySourceId = new Map();
    const firmByNormName = new Map();
    const partyBySourceId = new Map();
    const partyByKey = new Map();
    const productBySourceId = new Map();
    const productByNormName = new Map();
    const fyCache = new Map();

    for (const row of companies) {
      await ensureFirm(tconn, row, firmBySourceId, firmByNormName, stats);
    }

    for (const row of sourceParties) {
      await ensureParty(tconn, row, partyBySourceId, partyByKey, stats);
    }

    for (const row of sourceProducts) {
      await ensureProduct(tconn, row, productBySourceId, productByNormName, unitBySourceProductId, stats);
    }

    const fallbackFirm = async (cmpId) => ensureFirm(
      tconn,
      { cmp_id: cmpId, cmp_name: `Legacy Firm ${cmpId}`, pan_card: null, gst_no: null },
      firmBySourceId,
      firmByNormName,
      stats,
    );

    const fallbackParty = async (partyId) => ensureParty(
      tconn,
      {
        party_id: partyId,
        party_name: `Legacy Party ${partyId}`,
        party_address: null,
        party_contact: null,
        party_email: null,
        party_other_email: null,
        party3_email: null,
        gstno: null,
        gst_type: null,
        cgst: 0,
        sgst: 0,
        igst: 0,
      },
      partyBySourceId,
      partyByKey,
      stats,
    );

    const fallbackProduct = async (prdId) => ensureProduct(
      tconn,
      { ID: prdId, product_name: `Legacy Product ${prdId}` },
      productBySourceId,
      productByNormName,
      unitBySourceProductId,
      stats,
    );

    for (const row of sourceOrders) {
      const sourceOrderId = Number(row.order_id);
      if (!Number.isFinite(sourceOrderId)) {
        stats.contracts.skippedMissingRef += 1;
        continue;
      }

      const already = await getMappedId(tconn, 'contract', sourceOrderId);
      if (already) {
        stats.contracts.skippedMapped += 1;
        continue;
      }

      if (!opts.includeDeleted && yes(row.isdelete)) {
        stats.contracts.skippedDeleted += 1;
        continue;
      }

      const cmpId = Number(row.cmp_id);
      const sellerSrc = Number(row.seller_id);
      const buyerSrc = Number(row.buyer_id);
      const prdSrc = Number(row.prd_id);

      const firmId = firmBySourceId.get(cmpId) || await fallbackFirm(cmpId);
      const sellerId = partyBySourceId.get(sellerSrc) || await fallbackParty(sellerSrc);
      const buyerId = partyBySourceId.get(buyerSrc) || await fallbackParty(buyerSrc);
      const productId = productBySourceId.get(prdSrc) || await fallbackProduct(prdSrc);
      const fy = await ensureFiscalYear(tconn, fyCache, row.fyear, stats);
      const orderDate = cleanDate(row.order_date, null);

      if (!firmId || !sellerId || !buyerId || !productId || !fy || !orderDate) {
        stats.contracts.skippedMissingRef += 1;
        continue;
      }

      const deletedAt = yes(row.isdelete) ? nowSql() : null;
      const mailedAt = yes(row.email) || yes(row.msg) ? nowSql() : null;

      const [r] = await tconn.execute(
        `INSERT INTO contracts
          (contract_no, order_date, product_id, firm_id, fiscal_year_id, seller_id, buyer_id,
           seller_brokerage, buyer_brokerage, delivery_station, delivery_schedule, status,
           payment_criteria, terms, min_qty, max_qty, unit, price, deleted_at, mailed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          cleanTextMax(row.contractno, 100),
          orderDate,
          productId,
          firmId,
          fy.id,
          sellerId,
          buyerId,
          toNumber(row.seller_brokerage, 0),
          toNumber(row.brokerage, 0),
          cleanTextMax(row.delivery_station, 255),
          cleanTextMax(row.period, 255),
          cleanTextMax(row.status, 50),
          cleanTextMax(row.payment_type, 255),
          cleanText(row.terms),
          toNumber(row.minqty, 0),
          toNumber(row.maxqty, 0),
          cleanTextMax(row.unit, 20) || 'MT',
          Number.isFinite(Number(row.price)) ? Number(row.price) : null,
          deletedAt,
          mailedAt,
        ],
      );

      const targetId = Number(r.insertId);
      await putMappedId(tconn, 'contract', sourceOrderId, targetId);
      stats.contracts.inserted += 1;
    }

    for (const row of sourceBills) {
      const sourceBillId = Number(row.ID);
      if (!Number.isFinite(sourceBillId)) {
        stats.bills.skippedMissingRef += 1;
        continue;
      }

      const already = await getMappedId(tconn, 'bill', sourceBillId);
      if (already) {
        stats.bills.skippedMapped += 1;
        continue;
      }

      if (!opts.includeDeleted && yes(row.isdelete)) {
        stats.bills.skippedDeleted += 1;
        continue;
      }

      const cmpId = Number(row.cmp_id);
      const partySrc = Number(row.partyid);
      const firmId = firmBySourceId.get(cmpId) || await fallbackFirm(cmpId);
      const partyId = partyBySourceId.get(partySrc) || await fallbackParty(partySrc);
      const fy = await ensureFiscalYear(tconn, fyCache, row.fyear, stats);

      if (!firmId || !partyId || !fy) {
        stats.bills.skippedMissingRef += 1;
        continue;
      }

      const pre = await getPartyBill(tconn, firmId, fy.id, partyId);
      const targetBillId = await ensurePartyBill(tconn, {
        firmId,
        fy,
        partyId,
        billNoRaw: row.B_ID || row.bill_id,
        billDateRaw: row.bill_date,
        brokerageRaw: row.rate,
        mailed: yes(row.mail),
      }, stats);

      if (pre) stats.bills.mergedDuplicateByPartyFy += 1;

      await putMappedId(tconn, 'bill', sourceBillId, targetBillId);
      stats.bills.mapped += 1;
    }

    for (const row of sourceReceipts) {
      const sourceReceiptId = Number(row.pay_id);
      if (!Number.isFinite(sourceReceiptId)) {
        stats.receipts.skippedMissingRef += 1;
        continue;
      }

      const already = await getMappedId(tconn, 'receipt', sourceReceiptId);
      if (already) {
        stats.receipts.skippedMapped += 1;
        continue;
      }

      const cmpId = Number(row.cmp_id);
      const partySrc = Number(row.party_id);
      const firmId = firmBySourceId.get(cmpId) || await fallbackFirm(cmpId);
      const partyId = partyBySourceId.get(partySrc) || await fallbackParty(partySrc);
      const fy = await ensureFiscalYear(tconn, fyCache, row.fyear, stats);
      const receiveDate = cleanDate(row.date_of_pay, fy?.end || null);
      const amount = toNumber(row.amount, 0);

      if (!firmId || !partyId || !fy || !receiveDate || amount <= 0) {
        stats.receipts.skippedMissingRef += 1;
        continue;
      }

      let bill = await getPartyBill(tconn, firmId, fy.id, partyId);
      if (!bill) {
        const billId = await ensurePartyBill(tconn, {
          firmId,
          fy,
          partyId,
          billNoRaw: null,
          billDateRaw: receiveDate,
          brokerageRaw: 0,
          mailed: false,
        }, stats);
        bill = { id: billId };
        stats.receipts.createdBillFallback += 1;
      }

      const [r] = await tconn.execute(
        `INSERT INTO party_bill_receipts
          (firm_id, party_bill_id, party_id, receive_date, amount, mode, reference_no, notes)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          firmId,
          Number(bill.id),
          partyId,
          receiveDate,
          amount,
          sanitizeMode(row.paymode),
          null,
          cleanText(row.other_details),
        ],
      );

      await putMappedId(tconn, 'receipt', sourceReceiptId, Number(r.insertId));
      stats.receipts.inserted += 1;
    }

    await refreshBillSequences(tconn, stats);

    if (opts.apply) {
      await tconn.commit();
    } else {
      await tconn.rollback();
    }

    return stats;
  } catch (e) {
    try {
      await tconn.rollback();
    } catch (_) {
      // ignore
    }
    throw e;
  } finally {
    tconn.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

function printSummary(opts, stats) {
  console.log('');
  console.log('=== Infinity Import Summary ===');
  console.log(`Mode: ${opts.apply ? 'APPLY (committed)' : 'DRY-RUN (rolled back)'}`);
  console.log(`Include deleted rows: ${opts.includeDeleted ? 'yes' : 'no'}`);
  console.log(`Source DB: ${opts.sourceUser}@${opts.sourceHost}:${opts.sourcePort}/${opts.sourceDb}`);
  console.log('');

  console.table({
    source_companies: stats.source.companies,
    source_parties: stats.source.parties,
    source_products: stats.source.products,
    source_orders: stats.source.orders,
    source_bills: stats.source.bills,
    source_receipts: stats.source.receipts,
  });

  console.table({
    firms_mapped: stats.firms.mapped,
    firms_inserted: stats.firms.inserted,
    firms_reused: stats.firms.reused,
    parties_mapped: stats.parties.mapped,
    parties_inserted: stats.parties.inserted,
    parties_reused: stats.parties.reused,
    party_emails_inserted: stats.parties.emailsInserted,
    products_mapped: stats.products.mapped,
    products_inserted: stats.products.inserted,
    products_reused: stats.products.reused,
    fy_inserted: stats.fy.inserted,
    fy_reused: stats.fy.reused,
    fy_invalid: stats.fy.invalid,
  });

  console.table({
    contracts_inserted: stats.contracts.inserted,
    contracts_skipped_mapped: stats.contracts.skippedMapped,
    contracts_skipped_deleted: stats.contracts.skippedDeleted,
    contracts_skipped_missing_ref: stats.contracts.skippedMissingRef,
    bills_inserted: stats.bills.inserted,
    bills_reused: stats.bills.reused,
    bills_mapped: stats.bills.mapped,
    bills_merged_party_fy: stats.bills.mergedDuplicateByPartyFy,
    bills_skipped_mapped: stats.bills.skippedMapped,
    bills_skipped_deleted: stats.bills.skippedDeleted,
    bills_skipped_missing_ref: stats.bills.skippedMissingRef,
    bills_bill_no_conflicts: stats.bills.billNoConflicts,
    receipts_inserted: stats.receipts.inserted,
    receipts_skipped_mapped: stats.receipts.skippedMapped,
    receipts_skipped_missing_ref: stats.receipts.skippedMissingRef,
    receipts_created_bill_fallback: stats.receipts.createdBillFallback,
    bill_sequences_refreshed: stats.billSequencesRefreshed ? 1 : 0,
  });

  if (stats.warnings.length) {
    console.log('Warnings:');
    for (const w of stats.warnings.slice(0, 20)) console.log(`- ${w}`);
    if (stats.warnings.length > 20) {
      console.log(`... and ${stats.warnings.length - 20} more warnings`);
    }
  }

  console.log('==============================');
}

(async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      usage();
      process.exit(0);
    }

    if (!opts.apply) {
      console.log('Running in DRY-RUN mode. Use --apply to commit changes.');
    }

    const stats = await importInfinity(opts);
    printSummary(opts, stats);
    process.exit(0);
  } catch (e) {
    console.error('import-infinity failed:', e.message || e);
    process.exit(1);
  }
})();
