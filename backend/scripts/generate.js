/*
  Bulk data generator for manual / exploratory testing.
  - Creates multiple firms, FYs, parties, products, contracts, bills, receipts
  - Idempotent-ish: firms are created with a run tag so re-runs create new firms
  - Does NOT delete existing data

  Usage: npm run migrate && node scripts/generate.js
*/
require('dotenv').config();
const { pool } = require('../src/lib/db');

const RUN_TAG = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

const CONFIG = {
  firms: Number(process.env.GEN_FIRMS || 2),
  fysPerFirm: Number(process.env.GEN_FYS_PER_FIRM || process.env.GEN_FYS || 2), // e.g., FY25-26, FY24-25
  parties: Number(process.env.GEN_PARTIES || 8),    // global parties
  products: Number(process.env.GEN_PRODUCTS || 5),
  contractsPerFY: Number(process.env.GEN_CONTRACTS_PER_FY || 40), // per firm per FY
  receiptsMaxPerBill: Number(process.env.GEN_RECEIPTS_MAX || 3),
};

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function randFloat(a,b,dec=2){ const v = a + Math.random()*(b-a); return Number(v.toFixed(dec)); }
function ymd(d){ const dt=new Date(d); const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const dd=String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

async function createFirm(conn, idx){
  const name = `Firm-${idx+1}-${RUN_TAG}`;
  await conn.execute(`INSERT INTO firms (name, address, gst_no) VALUES (?,?,?)`, [name, `Addr ${idx+1}`, null]);
  const [[{ id }]] = await conn.execute('SELECT LAST_INSERT_ID() AS id');
  return { id, name };
}

async function createFYs(conn, count){
  const out=[];
  const now = new Date();
  const baseYear = now.getMonth() < 3 ? now.getFullYear()-1 : now.getFullYear(); // FY starts Apr
  for (let i=0;i<count;i++){
    const y = baseYear - i;
    const label = `${y}-${String((y+1)).slice(-2)}`;
    const start = `${y}-04-01`; const end = `${y+1}-03-31`;
    // ensure exists or create
    const [[r]] = await conn.execute(`SELECT id FROM fiscal_years WHERE label=? LIMIT 1`, [label]);
    let id = r?.id; if (!id){
      await conn.execute(`INSERT INTO fiscal_years (label,start_date,end_date) VALUES (?,?,?)`, [label,start,end]);
      const [[{ id: nid }]] = await conn.execute('SELECT LAST_INSERT_ID() AS id'); id = nid;
    }
    out.push({ id, label, start, end });
  }
  return out;
}

async function ensureParties(conn, n){
  // create global parties; reuse if exist
  const names = [];
  for (let i=0;i<n;i++) names.push(`Party-${i+1}`);
  const ids = [];
  for (const nm of names){
    const [[r]] = await conn.execute(`SELECT id FROM parties WHERE name=? LIMIT 1`, [nm]);
    let id = r?.id; if (!id){
      const dueDays = pick([15, 30, 45, null]);
      await conn.execute(`INSERT INTO parties (firm_id,name,address,contact,gst_no,gst_type,cgst_rate,sgst_rate,igst_rate,role,due_days) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [null, nm, 'Addr', '99999', null, pick(['INTRA','INTER']), 9, 9, 18, pick(['BUYER','SELLER','BOTH']), dueDays]);
      const [[{ id: nid }]] = await conn.execute('SELECT LAST_INSERT_ID() AS id'); id = nid;
    }
    ids.push(id);
  }
  return ids;
}

async function ensureProducts(conn, n){
  const names = [];
  for (let i=0;i<n;i++) names.push(`Product-${i+1}`);
  const ids = [];
  for (const nm of names){
    const [[r]] = await conn.execute(`SELECT id FROM products WHERE name=? LIMIT 1`, [nm]);
    let id = r?.id; if (!id){
      await conn.execute(`INSERT INTO products (name, unit) VALUES (?,?)`, [nm, 'MT']);
      const [[{ id: nid }]] = await conn.execute('SELECT LAST_INSERT_ID() AS id'); id = nid;
    }
    ids.push(id);
  }
  return ids;
}

function randomDateWithin(start, end){
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return ymd(new Date(randInt(s,e)));
}

async function addContracts(conn, firmId, fy, parties, products, count){
  for (let i=0;i<count;i++){
    let seller = pick(parties), buyer = pick(parties);
    if (buyer === seller) buyer = pick(parties);
    const product = pick(products);
    const order_date = randomDateWithin(fy.start, fy.end);
    const min_qty = randInt(50, 120);
    const max_qty = min_qty + randInt(0, 50);
    const price = pick([randInt(25000, 35000), randInt(120000, 130000), null]); // include some null prices
    await conn.execute(`INSERT INTO contracts (order_date, product_id, firm_id, fiscal_year_id, seller_id, buyer_id, seller_brokerage, buyer_brokerage, min_qty, max_qty, unit, price) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [order_date, product, firmId, fy.id, seller, buyer, 30, 30, min_qty, max_qty, 'MT', price]);
  }
}

async function createBillsForFY(conn, firmId, fy){
  // For each party that traded, create a single bill for this FY with an override rate (or 0)
  const [parties] = await conn.execute(`
    SELECT DISTINCT party_id FROM (
      SELECT seller_id AS party_id FROM contracts WHERE firm_id=? AND fiscal_year_id=? AND deleted_at IS NULL
      UNION ALL
      SELECT buyer_id  AS party_id FROM contracts WHERE firm_id=? AND fiscal_year_id=? AND deleted_at IS NULL
    ) t WHERE party_id IS NOT NULL`, [firmId, fy.id, firmId, fy.id]);
  for (const row of parties){
    const pid = row.party_id;
    const [[exists]] = await conn.execute(`SELECT id FROM party_bills WHERE firm_id=? AND fiscal_year_id=? AND party_id=? LIMIT 1`, [firmId, fy.id, pid]);
    if (exists) continue;
    // Compute next bill number fully in SQL to avoid JS string concatenation with big integers
    const [[next]] = await conn.execute(
      `SELECT CAST(COALESCE(MAX(CAST(bill_no AS UNSIGNED)),0) + 1 AS UNSIGNED) AS next_no
         FROM party_bills WHERE firm_id = ? AND fiscal_year_id <=> ?`,
      [firmId, fy.id]
    );
    const billNo = String(next?.next_no || 1);
    const brokerage = pick([0,30,40,50]);
    await conn.execute(`INSERT INTO party_bills (firm_id,fiscal_year_id,party_id,bill_no,from_date,to_date,bill_date,brokerage) VALUES (?,?,?,?,?,?,?,?)`, [firmId, fy.id, pid, billNo, fy.start, fy.end, fy.end, brokerage]);
  }
}

async function addReceipts(conn, firmId){
  // For each bill, add 0–3 receipts with random amounts; some fully settle, others leave outstanding
  const [bills] = await conn.execute(`SELECT id, party_id FROM party_bills WHERE firm_id=?`, [firmId]);
  for (const b of bills){
    const [[cnt]] = await conn.execute(`SELECT COUNT(*) AS c FROM party_bill_receipts WHERE party_bill_id=?`, [b.id]);
    if ((cnt?.c||0) > 0) continue;
    const n = randInt(0, CONFIG.receiptsMaxPerBill);
    let base = 20000; // will vary; exact outstanding validated via app
    for (let i=0;i<n;i++){
      const amt = randInt(10000, 60000);
      const dt = ymd(new Date(Date.now() - randInt(0, 120)*24*3600*1000));
      await conn.execute(`INSERT INTO party_bill_receipts (firm_id, party_bill_id, party_id, receive_date, amount, mode, reference_no) VALUES (?,?,?,?,?,?,?)`, [firmId, b.id, b.party_id, dt, amt, pick(['CASH','UPI','BANK','CHEQUE']), `R-${RUN_TAG}-${i}`]);
      base += amt;
    }
  }
}

async function run(){
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const firmIds = [];
    for (let f=0; f<CONFIG.firms; f++){
      const firm = await createFirm(conn, f); firmIds.push(firm.id);
    }
    const fyList = await createFYs(conn, CONFIG.fysPerFirm);
    const partyIds = await ensureParties(conn, CONFIG.parties);
    const productIds = await ensureProducts(conn, CONFIG.products);

    for (const firmId of firmIds){
      for (const fy of fyList){
        await addContracts(conn, firmId, fy, partyIds, productIds, CONFIG.contractsPerFY);
        await createBillsForFY(conn, firmId, fy);
      }
      await addReceipts(conn, firmId);
    }

    await conn.commit();
    console.log('Generate complete. Firms:', firmIds.length, 'FYs/firm:', fyList.length);
  } catch (e) {
    await conn.rollback();
    console.error('Generate failed:', e);
    process.exitCode = 1;
  } finally {
    conn.release();
    pool.end();
  }
}

run();
