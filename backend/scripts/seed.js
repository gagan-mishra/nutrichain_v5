/* Curated seed with sensible names across multiple firms & FYs.
   Usage: npm run seed
*/
require('dotenv').config();
const { pool } = require('../src/lib/db');

async function upsertFY(conn, label, start, end){
  const [[r]] = await conn.query(`SELECT id FROM fiscal_years WHERE label=? LIMIT 1`, [label]);
  if (r?.id) return { id: r.id, label, start, end };
  await conn.query(`INSERT INTO fiscal_years (label,start_date,end_date) VALUES (?,?,?)`, [label, start, end]);
  const [[{ id }]] = await conn.query('SELECT LAST_INSERT_ID() AS id');
  return { id, label, start, end };
}

async function upsertFirm(conn, name, address, gst){
  const [[r]] = await conn.query(`SELECT id FROM firms WHERE name=? LIMIT 1`, [name]);
  let id = r?.id;
  if (!id) {
    await conn.query(`INSERT INTO firms (name,address,gst_no) VALUES (?,?,?)`, [name, address, gst]);
    const [[{ id: nid }]] = await conn.query('SELECT LAST_INSERT_ID() AS id'); id = nid;
  }
  return { id, name };
}

async function upsertParty(conn, name, city, dueDays, gstType='INTRA'){
  const [[r]] = await conn.query(`SELECT id FROM parties WHERE name=? LIMIT 1`, [name]);
  if (r?.id) return r.id;
  await conn.query(`INSERT INTO parties (firm_id,name,address,contact,gst_no,gst_type,cgst_rate,sgst_rate,igst_rate,role,due_days) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [null, name, `${city}`, '9999999999', null, gstType, 9, 9, 18, 'BOTH', dueDays]);
  const [[{ id }]] = await conn.query('SELECT LAST_INSERT_ID() AS id');
  return id;
}

async function upsertProduct(conn, name, unit='MT'){
  const [[r]] = await conn.query(`SELECT id FROM products WHERE name=? LIMIT 1`, [name]);
  if (r?.id) return r.id;
  await conn.query(`INSERT INTO products (name, unit) VALUES (?,?)`, [name, unit]);
  const [[{ id }]] = await conn.query('SELECT LAST_INSERT_ID() AS id');
  return id;
}

function ri(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function ymd(d){ const dt=new Date(d); const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const dd=String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

async function addRandomContracts(conn, firmId, fy, parties, products, n=8){
  for (let i=0;i<n;i++){
    let seller = parties[ri(0, parties.length-1)];
    let buyer = parties[ri(0, parties.length-1)];
    if (buyer === seller) buyer = parties[ri(0, parties.length-1)];
    const product = products[ri(0, products.length-1)];
    const d0 = new Date(fy.start).getTime(), d1 = new Date(fy.end).getTime();
    const order_date = ymd(new Date(ri(d0, d1)));
    const min_qty = ri(50, 120);
    const max_qty = min_qty + ri(0,40);
    const price = ri(25000, 130000);
    await conn.query(`INSERT INTO contracts (order_date, product_id, firm_id, fiscal_year_id, seller_id, buyer_id, seller_brokerage, buyer_brokerage, min_qty, max_qty, unit, price) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [order_date, product, firmId, fy.id, seller, buyer, 30, 30, min_qty, max_qty, 'MT', price]);
  }
}

async function createBillsForFY(conn, firmId, fy){
  const [partyRows] = await conn.query(`
    SELECT DISTINCT party_id FROM (
      SELECT seller_id AS party_id FROM contracts WHERE firm_id=? AND fiscal_year_id=? AND deleted_at IS NULL
      UNION ALL
      SELECT buyer_id  AS party_id FROM contracts WHERE firm_id=? AND fiscal_year_id=? AND deleted_at IS NULL
    ) t WHERE party_id IS NOT NULL`, [firmId, fy.id, firmId, fy.id]);
  for (const row of partyRows){
    const pid = row.party_id;
    const [[exists]] = await conn.query(`SELECT id FROM party_bills WHERE firm_id=? AND fiscal_year_id=? AND party_id=? LIMIT 1`, [firmId, fy.id, pid]);
    if (exists) continue;
    const [[mx]] = await conn.query(`SELECT COALESCE(MAX(CAST(bill_no AS UNSIGNED)),0) AS m FROM party_bills WHERE firm_id=? AND fiscal_year_id <=> ?`, [firmId, fy.id]);
    const billNo = String((mx?.m||0) + 1);
    const brokerage = [0,30,40,50][ri(0,3)];
    await conn.query(`INSERT INTO party_bills (firm_id,fiscal_year_id,party_id,bill_no,from_date,to_date,bill_date,brokerage) VALUES (?,?,?,?,?,?,?,?)`, [firmId, fy.id, pid, billNo, fy.start, fy.end, fy.end, brokerage]);
  }
}

async function addReceipts(conn, firmId){
  const [bills] = await conn.query(`SELECT id, party_id FROM party_bills WHERE firm_id=?`, [firmId]);
  for (const b of bills){
    const [[c]] = await conn.query(`SELECT COUNT(*) AS cnt FROM party_bill_receipts WHERE party_bill_id=?`, [b.id]);
    if ((c?.cnt||0) > 0) continue;
    const count = ri(0,2);
    for (let i=0;i<count;i++){
      const amount = ri(15000, 60000);
      const dt = ymd(new Date(Date.now() - ri(0,120)*24*3600*1000));
      await conn.query(`INSERT INTO party_bill_receipts (firm_id,party_bill_id,party_id,receive_date,amount,mode,reference_no) VALUES (?,?,?,?,?,?,?)`, [firmId, b.id, b.party_id, dt, amount, ['CASH','UPI','BANK','CHEQUE'][ri(0,3)], `REF-${i}`]);
    }
  }
}

async function main(){
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const firms = [
      await upsertFirm(conn, 'Enterprises', 'MG Road, Bengaluru', '29ABCDE1234F1Z5'),
      await upsertFirm(conn, 'International', 'Nariman Point, Mumbai', null),
      await upsertFirm(conn, 'Marketing', 'Park Street, Kolkata', null),
    ];

    const fys = [
      await upsertFY(conn, '2025-26', '2025-04-01', '2026-03-31'),
      await upsertFY(conn, '2024-25', '2024-04-01', '2025-03-31'),
      await upsertFY(conn, '2023-24', '2023-04-01', '2024-03-31'),
    ];

    const partyIds = [
      await upsertParty(conn, 'Annapurna Organics (Bengaluru)', 'Bengaluru', 30, 'INTRA'),
      await upsertParty(conn, 'Madhav Trading (Ahmedabad)', 'Ahmedabad', 15, 'INTRA'),
      await upsertParty(conn, 'Shree Foods (Pune)', 'Pune', 45, 'INTRA'),
      await upsertParty(conn, 'Gokul Agro (Rajkot)', 'Rajkot', 20, 'INTER'),
      await upsertParty(conn, 'Sai Commodities (Indore)', 'Indore', 30, 'INTER'),
    ];
    await conn.query(`INSERT IGNORE INTO party_emails (party_id,email) VALUES (?,?),(?,?)`, [partyIds[0],'ops@annapurna.com', partyIds[1],'finance@madhav.com']);

    const productIds = [
      await upsertProduct(conn, 'Yellow Soya DOC'),
      await upsertProduct(conn, 'Palm Oil'),
      await upsertProduct(conn, 'Corn'),
      await upsertProduct(conn, 'Wheat'),
    ];

    for (const firm of firms){
      for (const fy of fys){
        await addRandomContracts(conn, firm.id, fy, partyIds, productIds, 8);
        await createBillsForFY(conn, firm.id, fy);
      }
      await addReceipts(conn, firm.id);
    }

    await conn.commit();
    console.log('Seed complete for firms:', firms.map(f=>f.name).join(', '));
  } catch (e) {
    await conn.rollback();
    console.error('Seed failed', e);
    process.exitCode = 1;
  } finally {
    conn.release();
    pool.end();
  }
}

main();
