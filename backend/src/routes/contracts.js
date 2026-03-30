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
  try {
    const c = req.body || {};

    // Validate order_date falls within the selected fiscal year
    if (c.fiscal_year_id && c.order_date) {
      const [[fyRow]] = await pool.execute(
        "SELECT start_date, end_date FROM fiscal_years WHERE id = ? LIMIT 1",
        [c.fiscal_year_id]
      );
      if (!fyRow) return res.status(400).json({ error: "Invalid fiscal year" });
      const fyStart = String(fyRow.start_date).slice(0, 10);
      const fyEnd = String(fyRow.end_date).slice(0, 10);
      if (c.order_date < fyStart || c.order_date > fyEnd) {
        return res.status(400).json({
          error: `Order date must be within the fiscal year (${fyStart} to ${fyEnd})`,
        });
      }
    }

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
  } catch (e) {
    console.error("contracts POST error:", e);
    res.status(500).json({ error: "Failed to create contract" });
  }
});

/* ---------------- Update ---------------- */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const c = req.body || {};

    // Validate order_date falls within the selected fiscal year
    if (c.fiscal_year_id && c.order_date) {
      const [[fyRow]] = await pool.execute(
        "SELECT start_date, end_date FROM fiscal_years WHERE id = ? LIMIT 1",
        [c.fiscal_year_id]
      );
      if (!fyRow) return res.status(400).json({ error: "Invalid fiscal year" });
      const fyStart = String(fyRow.start_date).slice(0, 10);
      const fyEnd = String(fyRow.end_date).slice(0, 10);
      if (c.order_date < fyStart || c.order_date > fyEnd) {
        return res.status(400).json({
          error: `Order date must be within the fiscal year (${fyStart} to ${fyEnd})`,
        });
      }
    }

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
  } catch (e) {
    console.error("contracts PUT error:", e);
    res.status(500).json({ error: "Failed to update contract" });
  }
});

/* ---------------- List (active) ---------------- */
router.get("/", async (req, res) => {
  try {
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
  } catch (e) {
    console.error("contracts GET error:", e);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

/* ---------------- Soft delete ---------------- */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(
      "UPDATE contracts SET deleted_at = NOW() WHERE id = ? AND firm_id = ?",
      [id, req.ctx.firmId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("contracts DELETE error:", e);
    res.status(500).json({ error: "Failed to delete contract" });
  }
});

/* ---------------- Deleted list ---------------- */
router.get("/deleted/all", async (req, res) => {
  try {
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
  } catch (e) {
    console.error("contracts GET deleted error:", e);
    res.status(500).json({ error: "Failed to fetch deleted contracts" });
  }
});

/* ---------------- Hard delete ---------------- */
router.delete("/purge/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.execute("DELETE FROM contracts WHERE id = ? AND firm_id = ?", [
      id,
      req.ctx.firmId,
    ]);
    res.json({ ok: true });
  } catch (e) {
    console.error("contracts PURGE error:", e);
    res.status(500).json({ error: "Failed to purge contract" });
  }
});

/* ---------------- Print payload (firm address injected) ---------------- */
router.get("/:id/print", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const firmId = req.ctx.firmId;

    const sql = `
      SELECT
        c.*,
        s.name AS seller_name, s.address AS seller_address, s.contact AS seller_contact, s.gst_no AS seller_gst_no,
        b.name AS buyer_name, b.address AS buyer_address, b.contact AS buyer_contact, b.gst_no AS buyer_gst_no,
        p.name AS product_name, p.unit AS product_unit,
        f.name AS firm_name,
        f.address AS firm_address
      FROM contracts c
      JOIN parties s ON s.id = c.seller_id
      JOIN parties b ON b.id = c.buyer_id
      LEFT JOIN products p ON p.id = c.product_id
      JOIN firms f ON f.id = c.firm_id
      WHERE c.id = ? AND c.firm_id = ?
      LIMIT 1`;
    const [rows] = await pool.execute(sql, [id, firmId]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("contracts PRINT error:", e);
    res.status(500).json({ error: "Failed to load contract for print" });
  }
});

/* ---------------- Send Mail with PDF attachment ----------------
   - TO: all seller emails
   - BCC: all buyer emails
   - PDF filename: "{firm name}. CN. {contract no}.pdf"
   - Subject: "Trade Confirmation: {firm name}. CN {contract no}. Date: {dd/mm/yyyy}"
-----------------------------------------------------------------*/
router.post("/:id/mail", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const firmId = req.ctx.firmId;

    // Pull contract + parties + emails (party_emails)
    const sql = `
      SELECT
        c.*,
        s.name AS seller_name, s.address AS seller_address, s.contact AS seller_contact, s.gst_no AS seller_gst_no,
        b.name AS buyer_name,  b.address AS buyer_address,  b.contact AS buyer_contact, b.gst_no AS buyer_gst_no,
        p.name AS product_name, p.unit AS product_unit,
        f.name AS firm_name, f.address AS firm_address,
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
    const [rows] = await pool.execute(sql, [id, firmId]);
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
    const ccChunks = chunk(buyerEmails, 90);
    const batches = Math.max(toChunks.length || 1, ccChunks.length || 1);

    const results = [];
    for (let i = 0; i < batches; i++) {
      const to = (toChunks[i] || []).join(", ");
      const cc = (ccChunks[i] || []).join(", ");

      if (!to && !cc) continue;

      const info = await sendMail({
        to: to || undefined,
        cc: cc || undefined,
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
      results.push({ batch: i + 1, to, cc, messageId: info?.messageId || null });
    }

    // mark mailed_at
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
  } catch (e) {
    console.error("contracts MAIL error:", e);
    res.status(500).json({ error: "Failed to send email" });
  }
});

module.exports = router;
