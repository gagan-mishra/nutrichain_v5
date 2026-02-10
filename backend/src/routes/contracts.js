// const express = require("express");
// const { pool } = require("../lib/db");
// const { requireAuth } = require("../middleware/auth");
// const { requireContext } = require("../middleware/context");

// const router = express.Router();
// router.use(requireAuth, requireContext);

// // Create
// router.post("/", async (req, res) => {
//   const c = req.body || {};
//   const sql = `
//     INSERT INTO contracts
//     (contract_no, order_date, product_id, firm_id, fiscal_year_id, seller_id, buyer_id, seller_brokerage, buyer_brokerage,
//      delivery_station, delivery_schedule, status, payment_criteria, terms, min_qty, max_qty, unit, price)
//     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
//   const params = [
//     c.contract_no || null,
//     c.order_date,
//     c.product_id,
//     req.ctx.firmId,
//     c.fiscal_year_id,
//     c.seller_id,
//     c.buyer_id,
//     c.seller_brokerage || null,
//     c.buyer_brokerage || null,
//     c.delivery_station || null,
//     c.delivery_schedule || null,
//     c.status || null,
//     c.payment_criteria || null,
//     c.terms || null,
//     c.min_qty || null,
//     c.max_qty || null,
//     c.unit || null,
//     c.price || null,
//   ];
//   const [r] = await pool.execute(sql, params);
//   res.json({ id: r.insertId, ...c });
// });

// // Update
// router.put("/:id", async (req, res) => {
//   const id = Number(req.params.id);
//   const c = req.body || {};
//   const sql = `
//     UPDATE contracts
//        SET contract_no = ?,
//            order_date = ?,
//            product_id = ?,
//            fiscal_year_id = ?,
//            seller_id = ?,
//            buyer_id = ?,
//            seller_brokerage = ?,
//            buyer_brokerage = ?,
//            delivery_station = ?,
//            delivery_schedule = ?,
//            status = ?,
//            payment_criteria = ?,
//            terms = ?,
//            min_qty = ?,
//            max_qty = ?,
//            unit = ?,
//            price = ?
//      WHERE id = ? AND firm_id = ?`;
//   const params = [
//     c.contract_no || null,
//     c.order_date,
//     c.product_id,
//     c.fiscal_year_id,
//     c.seller_id,
//     c.buyer_id,
//     c.seller_brokerage || null,
//     c.buyer_brokerage || null,
//     c.delivery_station || null,
//     c.delivery_schedule || null,
//     c.status || null,
//     c.payment_criteria || null,
//     c.terms || null,
//     c.min_qty || null,
//     c.max_qty || null,
//     c.unit || null,
//     c.price || null,
//     id,
//     req.ctx.firmId,
//   ];
//   const [r] = await pool.execute(sql, params);
//   if (r.affectedRows === 0) {
//     return res.status(404).json({ error: "Contract not found for this firm" });
//   }
//   res.json({ ok: true });
// });

// // List (active)
// router.get("/", async (req, res) => {
//   const params = [req.ctx.firmId];
//   let sql = `SELECT c.*,
//                     s.name AS seller_name,
//                     b.name AS buyer_name,
//                     p.name AS product_name,
//                     fy.label AS fy_label
//              FROM contracts c
//              JOIN parties s ON s.id = c.seller_id
//              JOIN parties b ON b.id = c.buyer_id
//              JOIN products p ON p.id = c.product_id
//              JOIN fiscal_years fy ON fy.id = c.fiscal_year_id
//              WHERE c.firm_id = ? AND c.deleted_at IS NULL`;
//   if (req.ctx.fyId) {
//     sql += " AND c.fiscal_year_id = ?";
//     params.push(req.ctx.fyId);
//   }
//   sql += " ORDER BY c.order_date DESC, c.id DESC";
//   const [rows] = await pool.execute(sql, params);
//   res.json(rows);
// });

// // Soft delete
// router.delete("/:id", async (req, res) => {
//   const id = Number(req.params.id);
//   await pool.execute(
//     "UPDATE contracts SET deleted_at = NOW() WHERE id = ? AND firm_id = ?",
//     [id, req.ctx.firmId]
//   );
//   res.json({ ok: true });
// });

// // Deleted list
// router.get("/deleted/all", async (req, res) => {
//   const params = [req.ctx.firmId];
//   let sql = `
//     SELECT c.*, s.name AS seller_name, b.name AS buyer_name, fy.label AS fy_label
//     FROM contracts c
//     LEFT JOIN parties s ON s.id = c.seller_id
//     LEFT JOIN parties b ON b.id = c.buyer_id
//     LEFT JOIN fiscal_years fy ON fy.id = c.fiscal_year_id
//     WHERE c.firm_id = ? AND c.deleted_at IS NOT NULL`;
//   if (req.ctx.fyId) {
//     sql += " AND c.fiscal_year_id = ?";
//     params.push(req.ctx.fyId);
//   }
//   sql += " ORDER BY c.deleted_at DESC, c.id DESC";
//   const [rows] = await pool.execute(sql, params);
//   res.json(rows);
// });

// // Hard delete
// router.delete("/purge/:id", async (req, res) => {
//   const id = Number(req.params.id);
//   await pool.execute("DELETE FROM contracts WHERE id = ? AND firm_id = ?", [
//     id,
//     req.ctx.firmId,
//   ]);
//   res.json({ ok: true });
// });

// // Print payload (firm address injected)
// router.get("/:id/print", async (req, res) => {
//   const id = Number(req.params.id);
//   const firmId = req.ctx.firmId;
//   const FIRM_ADDR =
//     process.env.FIRM_ADDRESS ||
//     "123, Business Park, Main Road, City, State, PIN";

//   const sql = `
//     SELECT
//       c.*,
//       s.name AS seller_name, s.address AS seller_address, s.contact AS seller_contact,
//       b.name AS buyer_name, b.address AS buyer_address, b.contact AS buyer_contact,
//       p.name AS product_name, p.unit AS product_unit,
//       f.name AS firm_name,
//       ? AS firm_address
//     FROM contracts c
//     JOIN parties s ON s.id = c.seller_id
//     JOIN parties b ON b.id = c.buyer_id
//     LEFT JOIN products p ON p.id = c.product_id
//     JOIN firms f ON f.id = c.firm_id
//     WHERE c.id = ? AND c.firm_id = ?
//     LIMIT 1`;
//   const [rows] = await pool.execute(sql, [FIRM_ADDR, id, firmId]);
//   if (!rows.length) return res.status(404).json({ error: "Not found" });
//   res.json(rows[0]);
// });

// /* ---------- email helpers ---------- */

// function parseEmails(raw) {
//   // Accept JSON array, or comma/semicolon separated string.
//   if (!raw) return [];
//   try {
//     if (Array.isArray(raw)) {
//       return raw
//         .map(String)
//         .map((s) => s.trim())
//         .filter(Boolean);
//     }
//     const maybeJson = JSON.parse(raw);
//     if (Array.isArray(maybeJson)) {
//       return maybeJson
//         .map(String)
//         .map((s) => s.trim())
//         .filter(Boolean);
//     }
//   } catch (_) {
//     // not JSON
//   }
//   return String(raw)
//     .split(/[,\s;]+/)
//     .map((s) => s.trim())
//     .filter(Boolean);
// }

// function chunk(arr, size) {
//   const out = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }

// function createTransport() {
//   // If SMTP_SERVICE=gmail, use service-based transport; else use host/port.
//   if (process.env.SMTP_SERVICE === "gmail") {
//     return nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS, // App password
//       },
//     });
//   }
//   return nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT || 587),
//     secure: String(process.env.SMTP_SECURE || "false") === "true",
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//   });
// }

// /* ---------- route: send mail ---------- */

// router.post("/:id/mail", async (req, res) => {
//   const id = Number(req.params.id);
//   const firmId = req.ctx.firmId;
//   const FIRM_ADDR =
//     process.env.FIRM_ADDRESS ||
//     "123, Business Park, Main Road, City, State, PIN";

//   // Join with emails for both parties
//   const sql = `
//     SELECT
//       c.*,
//       s.name AS seller_name, s.address AS seller_address, s.contact AS seller_contact, s.emails AS seller_emails,
//       b.name AS buyer_name,  b.address AS buyer_address,  b.contact AS buyer_contact,  b.emails AS buyer_emails,
//       p.name AS product_name, p.unit AS product_unit,
//       f.name AS firm_name, ? AS firm_address
//     FROM contracts c
//     JOIN parties s ON s.id = c.seller_id
//     JOIN parties b ON b.id = c.buyer_id
//     LEFT JOIN products p ON p.id = c.product_id
//     JOIN firms f ON f.id = c.firm_id
//     WHERE c.id = ? AND c.firm_id = ?
//     LIMIT 1
//   `;
//   const [rows] = await pool.execute(sql, [FIRM_ADDR, id, firmId]);
//   if (!rows.length) return res.status(404).json({ error: "Not found" });
//   const row = rows[0];

//   // Parse seller/buyer email arrays
//   const sellerEmails = parseEmails(row.seller_emails);
//   const buyerEmails = parseEmails(row.buyer_emails);

//   if (!sellerEmails.length && !buyerEmails.length) {
//     return res
//       .status(400)
//       .json({ error: "No recipient emails found for seller/buyer" });
//   }

//   // Build HTML & PDF
//   const html = buildContractPrintHtml(row);
//   const browser = await puppeteer.launch({
//     headless: "new",
//     args: ["--no-sandbox", "--disable-setuid-sandbox"],
//   });

//   let pdf;
//   try {
//     const page = await browser.newPage();
//     await page.setContent(html, { waitUntil: "networkidle0" });
//     pdf = await page.pdf({
//       format: "A4",
//       printBackground: true,
//       margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
//     });
//   } finally {
//     await browser.close();
//   }

//   // Mail content
//   const subject = `Contract ${row.contract_no || "#" + row.id} - ${
//     row.firm_name
//   }`;
//   const firm = row.firm_name;
//   const bodyText = [
//     `Dear Sir/Madam,`,
//     ``,
//     `Please find attached the contract (${
//       row.contract_no || "#" + row.id
//     }) from ${firm}.`,
//     `This is a system generated document and does not require signature.`,
//     ``,
//     `Regards,`,
//     `${firm}`,
//   ].join("\n");

//   const transporter = createTransport();

//   // Gmail recipient limits: chunk recipients into batches of 90 (safe margin)
//   const toChunks = chunk(sellerEmails, 90);
//   const bccChunks = chunk(buyerEmails, 90);
//   const batches = Math.max(toChunks.length || 1, bccChunks.length || 1);

//   const results = [];
//   for (let i = 0; i < batches; i++) {
//     const to = (toChunks[i] || []).join(", ");
//     const bcc = (bccChunks[i] || []).join(", ");
//     if (!to && !bcc) continue; // skip empty batch

//     const info = await transporter.sendMail({
//       from: process.env.MAIL_FROM || process.env.SMTP_USER,
//       to: to || undefined, // Gmail requires at least one of to/cc/bcc
//       bcc: bcc || undefined,
//       subject,
//       text: bodyText,
//       html: bodyText.replace(/\n/g, "<br/>"),
//       attachments: [
//         {
//           filename: `Contract-${row.contract_no || row.id}.pdf`,
//           content: pdf,
//           contentType: "application/pdf",
//         },
//       ],
//     });
//     results.push({ batch: i + 1, to, bcc, messageId: info.messageId });
//   } // mark as mailed
//   await pool.execute(
//     "UPDATE contracts SET mailed_at = NOW() WHERE id = ? AND firm_id = ?",
//     [id, firmId]
//   );

//   res.json({
//     ok: true,
//     sent: results.length,
//     results,
//     mailed_at: new Date().toISOString(),
//   });

//   res.json({ ok: true, sent: results.length, results });
// });

// module.exports = router;


// backend/src/routes/contracts.js
const express = require("express");
const puppeteer = require("puppeteer");
const { pool } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");
const { requireContext } = require("../middleware/context");
const { sendMail } = require("../lib/mailer");
// Make sure this backend template exists and exports buildContractPrintHtml
const { buildContractPrintHtml } = require("../lib/contract-template");

const router = express.Router();
router.use(requireAuth, requireContext);

/* ---------------- helpers ---------------- */
function fmtDMY(input) {
  if (!input) return "";
  const s = String(input).slice(0, 10); // 2025-08-29 or similar
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return String(input);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const yy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

function parseEmails(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ---------------- Create ---------------- */
router.post("/", async (req, res) => {
  const c = req.body || {};
  const sql = `
    INSERT INTO contracts
    (contract_no, order_date, product_id, firm_id, fiscal_year_id, seller_id, buyer_id, seller_brokerage, buyer_brokerage,
     delivery_station, delivery_schedule, status, payment_criteria, terms, min_qty, max_qty, unit, price)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [
    c.contract_no || null,
    c.order_date,
    c.product_id,
    req.ctx.firmId,
    c.fiscal_year_id,
    c.seller_id,
    c.buyer_id,
    c.seller_brokerage || null,
    c.buyer_brokerage || null,
    c.delivery_station || null,
    c.delivery_schedule || null,
    c.status || null,
    c.payment_criteria || null,
    c.terms || null,
    c.min_qty || null,
    c.max_qty || null,
    c.unit || null,
    c.price || null,
  ];
  const [r] = await pool.execute(sql, params);
  res.json({ id: r.insertId, ...c });
});

/* ---------------- Update ---------------- */
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const c = req.body || {};
  const sql = `
    UPDATE contracts
       SET contract_no = ?,
           order_date = ?,
           product_id = ?,
           fiscal_year_id = ?,
           seller_id = ?,
           buyer_id = ?,
           seller_brokerage = ?,
           buyer_brokerage = ?,
           delivery_station = ?,
           delivery_schedule = ?,
           status = ?,
           payment_criteria = ?,
           terms = ?,
           min_qty = ?,
           max_qty = ?,
           unit = ?,
           price = ?
     WHERE id = ? AND firm_id = ?`;
  const params = [
    c.contract_no || null,
    c.order_date,
    c.product_id,
    c.fiscal_year_id,
    c.seller_id,
    c.buyer_id,
    c.seller_brokerage || null,
    c.buyer_brokerage || null,
    c.delivery_station || null,
    c.delivery_schedule || null,
    c.status || null,
    c.payment_criteria || null,
    c.terms || null,
    c.min_qty || null,
    c.max_qty || null,
    c.unit || null,
    c.price || null,
    id,
    req.ctx.firmId,
  ];
  const [r] = await pool.execute(sql, params);
  if (r.affectedRows === 0) {
    return res.status(404).json({ error: "Contract not found for this firm" });
  }
  res.json({ ok: true });
});

/* ---------------- List (active) ---------------- */
router.get("/", async (req, res) => {
  const params = [req.ctx.firmId];
  let sql = `SELECT c.*,
                    s.name AS seller_name,
                    b.name AS buyer_name,
                    p.name AS product_name,
                    fy.label AS fy_label
             FROM contracts c
             JOIN parties s ON s.id = c.seller_id
             JOIN parties b ON b.id = c.buyer_id
             JOIN products p ON p.id = c.product_id
             JOIN fiscal_years fy ON fy.id = c.fiscal_year_id
             WHERE c.firm_id = ? AND c.deleted_at IS NULL`;
  if (req.ctx.fyId) {
    sql += " AND c.fiscal_year_id = ?";
    params.push(req.ctx.fyId);
  }
  sql += " ORDER BY c.order_date DESC, c.id DESC";
  const [rows] = await pool.execute(sql, params);
  res.json(rows);
});

/* ---------------- Soft delete ---------------- */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.execute(
    "UPDATE contracts SET deleted_at = NOW() WHERE id = ? AND firm_id = ?",
    [id, req.ctx.firmId]
  );
  res.json({ ok: true });
});

/* ---------------- Deleted list ---------------- */
router.get("/deleted/all", async (req, res) => {
  const params = [req.ctx.firmId];
  let sql = `
    SELECT c.*, s.name AS seller_name, b.name AS buyer_name, fy.label AS fy_label
    FROM contracts c
    LEFT JOIN parties s ON s.id = c.seller_id
    LEFT JOIN parties b ON b.id = c.buyer_id
    LEFT JOIN fiscal_years fy ON fy.id = c.fiscal_year_id
    WHERE c.firm_id = ? AND c.deleted_at IS NOT NULL`;
  if (req.ctx.fyId) {
    sql += " AND c.fiscal_year_id = ?";
    params.push(req.ctx.fyId);
  }
  sql += " ORDER BY c.deleted_at DESC, c.id DESC";
  const [rows] = await pool.execute(sql, params);
  res.json(rows);
});

/* ---------------- Hard delete ---------------- */
router.delete("/purge/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.execute("DELETE FROM contracts WHERE id = ? AND firm_id = ?", [
    id,
    req.ctx.firmId,
  ]);
  res.json({ ok: true });
});

/* ---------------- Print payload (firm address injected) ---------------- */
router.get("/:id/print", async (req, res) => {
  const id = Number(req.params.id);
  const firmId = req.ctx.firmId;
  const FIRM_ADDR =
    process.env.FIRM_ADDRESS ||
    "123, Business Park, Main Road, City, State, PIN";

  const sql = `
    SELECT
      c.*,
      s.name AS seller_name, s.address AS seller_address, s.contact AS seller_contact,
      b.name AS buyer_name, b.address AS buyer_address, b.contact AS buyer_contact,
      p.name AS product_name, p.unit AS product_unit,
      f.name AS firm_name,
      ? AS firm_address
    FROM contracts c
    JOIN parties s ON s.id = c.seller_id
    JOIN parties b ON b.id = c.buyer_id
    LEFT JOIN products p ON p.id = c.product_id
    JOIN firms f ON f.id = c.firm_id
    WHERE c.id = ? AND c.firm_id = ?
    LIMIT 1`;
  const [rows] = await pool.execute(sql, [FIRM_ADDR, id, firmId]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

/* ---------------- Send Mail with PDF attachment ----------------
   - TO: all seller emails
   - BCC: all buyer emails
   - PDF filename: "{firm name}. CN. {contract no}.pdf"
   - Subject: "Trade Confirmation: {firm name}. CN {contract no}. Date: {dd/mm/yyyy}"
-----------------------------------------------------------------*/
router.post("/:id/mail", async (req, res) => {
  const id = Number(req.params.id);
  const firmId = req.ctx.firmId;
  const FIRM_ADDR =
    process.env.FIRM_ADDRESS ||
    "123, Business Park, Main Road, City, State, PIN";

  // Pull contract + parties + emails (party_emails)
  const sql = `
    SELECT
      c.*,
      s.name AS seller_name, s.address AS seller_address, s.contact AS seller_contact,
      b.name AS buyer_name,  b.address AS buyer_address,  b.contact AS buyer_contact,
      p.name AS product_name, p.unit AS product_unit,
      f.name AS firm_name, ? AS firm_address,
      GROUP_CONCAT(DISTINCT se.email) AS seller_emails,
      GROUP_CONCAT(DISTINCT be.email) AS buyer_emails
    FROM contracts c
    JOIN parties s ON s.id = c.seller_id
    LEFT JOIN party_emails se ON se.party_id = s.id
    JOIN parties b ON b.id = c.buyer_id
    LEFT JOIN party_emails be ON be.party_id = b.id
    LEFT JOIN products p ON p.id = c.product_id
    JOIN firms f ON f.id = c.firm_id
    WHERE c.id = ? AND c.firm_id = ?
    GROUP BY c.id
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [FIRM_ADDR, id, firmId]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  const row = rows[0];

  // recipients
  const sellerEmails = parseEmails(row.seller_emails);
  const buyerEmails = parseEmails(row.buyer_emails);
  if (!sellerEmails.length && !buyerEmails.length) {
    return res
      .status(400)
      .json({ error: "No recipient emails found for seller/buyer" });
  }

  // Build HTML with your backend print template and render to PDF
  const html = buildContractPrintHtml(row);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  let pdf;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
  } finally {
    await browser.close();
  }
  if (!pdf || pdf.length === 0) {
    return res.status(500).json({ error: "Failed to generate PDF attachment" });
  }

  // Subject + PDF name
  const firmName = row.firm_name || "Your Firm";
  const cn = row.contract_no || String(row.id);
  const dt = fmtDMY(row.order_date);
  const subject = `Trade Confirmation: ${firmName}. CN ${cn}. Date: ${dt}`;
  const pdfName = `${firmName}. CN. ${cn}.pdf`;

  // Body
  const bodyText = [
    `Dear Sir/Madam,`,
    ``,
    `Please find attached the trade confirmation (Contract No: ${cn}) from ${firmName}.`,
    `This is a system generated document and does not require signature.`,
    ``,
    `Regards,`,
    `${firmName}`,
  ].join("\n");

  // Send mail (chunk recipients for safety)
  const toChunks = chunk(sellerEmails, 90); // Gmail safe margin
  const bccChunks = chunk(buyerEmails, 90);
  const batches = Math.max(toChunks.length || 1, bccChunks.length || 1);

  const results = [];
  for (let i = 0; i < batches; i++) {
    const to = (toChunks[i] || []).join(", ");
    const bcc = (bccChunks[i] || []).join(", ");

    if (!to && !bcc) continue;

    const info = await sendMail({
      to: to || undefined,
      bcc: bcc || undefined,
      subject,
      text: bodyText,
      html: bodyText.replace(/\n/g, "<br/>"),
      attachments: [
        {
          filename: pdfName,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
    results.push({ batch: i + 1, to, bcc, messageId: info?.messageId || null });
  }

  // Optional: mark mailed_at (remove if you don't have this column)
  try {
    await pool.execute(
      "UPDATE contracts SET mailed_at = NOW() WHERE id = ? AND firm_id = ?",
      [id, firmId]
    );
  } catch (_) {
    // ignore if column doesn't exist
  }

  return res.json({
    ok: true,
    subject,
    attachment: pdfName,
    sent: results.length,
    results,
  });
});

module.exports = router;
