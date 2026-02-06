// // src/print/contract-template.js

// const esc = (s) =>
//   String(s ?? "")
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");

// const fmtDMY = (input) => {
//   if (!input) return "";
//   if (/^\d{4}-\d{2}-\d{2}/.test(String(input))) {
//     const [y, m, d] = String(input).slice(0, 10).split("-");
//     return `${d}/${m}/${y}`;
//   }
//   const dt = new Date(input);
//   if (isNaN(dt)) return String(input);
//   const dd = String(dt.getUTCDate()).padStart(2, "0");
//   const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
//   const yy = dt.getUTCFullYear();
//   return `${dd}/${mm}/${yy}`;
// };

// /**
//  * Accepts either:
//  *  - { firmName, firmAddress, contract }
//  *  - raw row from GET /contracts/:id/print
//  */
// export function buildContractPrintHtml(input) {
//   const row = input.contract ? input.contract : input;

//   const firmName = input.firmName || row.firm_name || "Your Firm";
//   const firmAddress =
//     input.firmAddress ||
//     row.firm_address ||
//     "123, Business Park, Main Road, City, State, PIN";

//   const c = {
//     contract_no: row.contract_no ?? "",
//     order_date: row.order_date ?? "",
//     seller_name: row.seller_name ?? "",
//     seller_address: row.seller_address ?? "",
//     buyer_name: row.buyer_name ?? "",
//     buyer_address: row.buyer_address ?? "",
//     product_name: row.product_name ?? "",
//     min_qty: row.min_qty ?? "",
//     max_qty: row.max_qty ?? "",
//     unit: row.unit || row.product_unit || "",
//     price: row.price ?? "",
//     status: row.status ?? "",
//     delivery_station: row.delivery_station ?? "",
//     delivery_schedule: row.delivery_schedule ?? "",
//     payment_criteria: row.payment_criteria ?? "",
//     terms: row.terms ?? "",
//     seller_brokerage: row.seller_brokerage ?? 0,
//     buyer_brokerage: row.buyer_brokerage ?? 0,
//   };

// const fmtQty = (val) => {
//   if (val == null || val === "") return "";
//   const num = Number(val);
//   return Number.isFinite(num) ? num.toString() : String(val);
// };

// const qty =
//   c.min_qty && c.max_qty && Number(c.min_qty) !== Number(c.max_qty)
//     ? `${fmtQty(c.min_qty)} to ${fmtQty(c.max_qty)} ${c.unit || ""}`.trim()
//     : `${fmtQty(c.min_qty || c.max_qty)} ${c.unit || ""}`.trim();


//   return `<!doctype html>
// <html>
// <head>
// <meta charset="utf-8" />
// <title>Contract ${esc(c.contract_no)}</title>
// <style>
//   :root {
//     --ink: #121212;
//     --muted: #606368;
//     --line: #d7d8da;
//     --soft: #f7f8fa;
//   }
//   * { box-sizing: border-box; }
//   html, body { margin: 0; padding: 0; background: #fff; }
//   body {
//     font: 13px/1.37 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
//     color: var(--ink);
//   }
//   .page {
//     width: 210mm; min-height: 297mm;
//     padding: 16mm 16mm 18mm; margin: 0 auto;
//   }
//   .center { text-align: center; }
//   .muted { color: var(--muted); }
//   .ganesh { font-weight: 700; letter-spacing: .08em; }
//   .firm { font-size: 18px; font-weight: 800; margin: 10px 0 2px; }
//   .addr { font-size: 12px; color: var(--muted); }
//   .rule { height: 1px; background: var(--line); margin: 8px 0 14px; }

//   .band {
//     display: grid; grid-template-columns: 1fr 1fr;
//     gap: 8px; align-items: center;
//     background: var(--soft);
//     border: 1px solid var(--line);
//     border-radius: 8px;
//     padding: 10px 12px; margin: 14px 0;
//   }
//   .band .left { font-weight: 700; }
//   .band .right { text-align: right; font-weight: 700; }

//   .cards {
//     display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 10px 0 14px;
//   }
//   .card {
//     border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: #fff;
//     min-height: 54px;
//   }
//   .card .h { font-weight: 700; margin-bottom: 6px; }
//   .card .addr { margin-top: 4px; }

//   table.kv {
//     width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 6px;
//     border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
//   }
//   .kv th, .kv td {
//     padding: 8px 10px; vertical-align: top;
//     border-bottom: 1px solid var(--line);
//   }
//   .kv tr:last-child th, .kv tr:last-child td { border-bottom: 0; }
//   .kv th {
//     width: 32%;
//     text-align: left; background: var(--soft);
//     font-weight: 600;
//   }
//   .kv td { background: #fff; }

//   ul.notes { margin: 12px 0 0 16px; padding: 0; }
//   ul.notes li { margin: 4px 0; }

//   .footer {
//     display: grid; grid-template-columns: 1fr 1fr 1fr;
//     align-items: start; margin-top: 26px;
//   }
//   .sig { text-align: center; color: var(--muted); }
//   .firm-block { text-align: right; }
//   .firm-block .firm-name { font-weight: 700; }
//   .firm-block .note { font-size: 10px; color: var(--muted); margin-top: 6px; }

//   @page { size: A4; margin: 10mm; }
//   @media print { .page { padding: 0; width: auto; min-height: auto; } }
// </style>
// </head>
// <body>
//   <div class="page">
//     <div class="center ganesh">|| श्री गणेशाय नमः ||</div>
//     <div class="rule"></div>
//     <div class="center">
//       <div class="firm">${esc(firmName)}</div>
//       <div class="addr">${esc(firmAddress)}</div>
//     </div>

//     <div class="band">
//       <div class="left">Contract No: ${esc(c.contract_no)}</div>
//       <div class="right">Date: ${esc(fmtDMY(c.order_date))}</div>
//     </div>

//     <div class="center" style="font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin: 2px 0 10px;">
//       Contract Form
//     </div>

//     <div class="muted" style="margin:8px 0 12px;">
//       Under Your Instruction and On Your Account We Have Done The Following Transactions as Following
//       Terms And Conditions Which Please Note
//     </div>

//     <div class="cards">
//       <div class="card">
//         <div class="h">Seller</div>
//         <div>${esc(c.seller_name)}</div>
//         ${c.seller_address ? `<div class="addr">${esc(c.seller_address)}</div>` : ""}
//       </div>
//       <div class="card">
//         <div class="h">Buyer</div>
//         <div>${esc(c.buyer_name)}</div>
//         ${c.buyer_address ? `<div class="addr">${esc(c.buyer_address)}</div>` : ""}
//       </div>
//     </div>

//     <table class="kv">
//       <tr><th>Commodity / Product</th><td>${esc(c.product_name)}</td></tr>
//       <tr><th>Quantity</th><td>${esc(qty)}</td></tr>
//       <tr><th>Price</th><td>${esc(c.price)} Per ${c.unit}</td></tr>
//       <tr><th>Status</th><td>${esc(c.status)}</td></tr>
//       <tr><th>Delivery Place</th><td>${esc(c.delivery_station)}</td></tr>
//       <tr><th>Delivery Period</th><td>${esc(c.delivery_schedule)}</td></tr>
//       <tr><th>Payment Terms</th><td>${esc(c.payment_criteria)}</td></tr>
//       <tr><th>Other Terms</th><td>${esc(c.terms)}</td></tr>
//       <tr><th>Brokerage</th>
//           <td><strong>Seller:</strong> ₹ ${esc(c.seller_brokerage)} Per ${c.unit}&nbsp; | &nbsp; <strong>Buyer:</strong> ₹ ${esc(c.buyer_brokerage)} Per ${c.unit}</td>
//       </tr>
//     </table>

//     <ul class="notes">
//       <li>All disputes subject to jurisdiction of our city courts only.</li>
//       <li>Goods once sold will not be taken back.</li>
//       <li>Interest @18% p.a. will be charged on overdue bills.</li>
//       <li>Weight/quality as per delivery receipt unless otherwise specified.</li>
//       <li>Please report discrepancies within 24 hours.</li>
//       <li>This contract is generated by the system based on your instructions.</li>
//       <li>Keep this document for your records.</li>
//       <li>Thank you for your business.</li>
//     </ul>

//     <div class="footer">
//       <div class="sig">Buyer</div>
//       <div class="sig">Seller</div>
//       <div class="firm-block">
//         <div class="firm-name">${esc(firmName)}</div>
//         <div class="note"><strong>Note:</strong> This is a system generated document<br/>and does not require signature.</div>
//       </div>
//     </div>
//   </div>
// </body>
// </html>`;
// }

// export default buildContractPrintHtml;


// src/print/contract-template.js

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const fmtDMY = (input) => {
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(input))) {
    const [y, m, d] = String(input).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(input);
  if (isNaN(dt)) return String(input);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const yy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
};

// ---------- numeric helpers (fixed) ----------

// Indian grouping with Intl; keeps up to 2 decimals, trims .00
const nfIndian = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const trimTrailingZeroes = (numStr) => numStr.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");

// Displays a number with Indian commas, up to 2 decimals, no trailing .0/.00
const fmtIndianNumber = (val) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val ?? "");
  return trimTrailingZeroes(nfIndian.format(n));
};

// Parse DB strings like "100.000" → 100 (number) safely
const parseNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Integer to words (Indian system)
function numberToWordsIndian(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "Zero";

  const ones = [
    "", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen",
  ];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

  const two = (num) => (num < 20 ? ones[num] : tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : ""));
  const three = (num) => {
    const h = Math.floor(num / 100), r = num % 100;
    return (h ? ones[h] + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : "");
  };

  let words = "";
  const crore = Math.floor(n / 10000000);
  const lakh  = Math.floor((n % 10000000) / 100000);
  const thou  = Math.floor((n % 100000) / 1000);
  const hund  = n % 1000;

  if (crore) words += three(crore) + " Crore";
  if (lakh)  words += (words ? " " : "") + three(lakh) + " Lakh";
  if (thou)  words += (words ? " " : "") + three(thou) + " Thousand";
  if (hund)  words += (words ? " " : "") + three(hund);

  return words;
}

// Currency display + words (Indian style)
const formatAmountWithWords = (val) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return { display: String(val ?? ""), words: "" };
  const display = "₹ " + fmtIndianNumber(n);
  const words   = `(Rupees ${numberToWordsIndian(n)} Only)`;
  return { display, words };
};

// --------------------------------------------

/**
 * Accepts either:
 *  - { firmName, firmAddress, contract }
 *  - raw row from GET /contracts/:id/print
 */
export function buildContractPrintHtml(input) {
  const row = input.contract ? input.contract : input;

  const firmName = input.firmName || row.firm_name || "Your Firm";
  const firmAddress =
    input.firmAddress ||
    row.firm_address ||
    "123, Business Park, Main Road, City, State, PIN";

  const c = {
    contract_no: row.contract_no ?? "",
    order_date: row.order_date ?? "",
    seller_name: row.seller_name ?? "",
    seller_address: row.seller_address ?? "",
    buyer_name: row.buyer_name ?? "",
    buyer_address: row.buyer_address ?? "",
    product_name: row.product_name ?? "",
    min_qty: row.min_qty ?? "",
    max_qty: row.max_qty ?? "",
    unit: row.unit || row.product_unit || "",
    price: row.price ?? "",
    status: row.status ?? "",
    delivery_station: row.delivery_station ?? "",
    delivery_schedule: row.delivery_schedule ?? "",
    payment_criteria: row.payment_criteria ?? "",
    terms: row.terms ?? "",
    seller_brokerage: row.seller_brokerage ?? 0,
    buyer_brokerage: row.buyer_brokerage ?? 0,
  };

  // ---- Quantity: "min to max UNIT" or single if equal/one missing ----
  const nMin = parseNum(c.min_qty);
  const nMax = parseNum(c.max_qty);
  let qty;
  if (nMin != null && nMax != null && Math.abs(nMin - nMax) > 1e-9) {
    qty = `${fmtIndianNumber(nMin)} to ${fmtIndianNumber(nMax)} ${c.unit}`.trim();
  } else if (nMin != null) {
    qty = `${fmtIndianNumber(nMin)} ${c.unit}`.trim();
  } else if (nMax != null) {
    qty = `${fmtIndianNumber(nMax)} ${c.unit}`.trim();
  } else {
    qty = "";
  }

  // ---- Price & brokerages with words ----
  const priceFmt = formatAmountWithWords(c.price);
  const sBrkFmt  = formatAmountWithWords(c.seller_brokerage);
  const bBrkFmt  = formatAmountWithWords(c.buyer_brokerage);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Contract ${esc(c.contract_no)}</title>
<style>
  :root { --ink:#121212; --muted:#606368; --line:#d7d8da; --soft:#f7f8fa; }
  * { box-sizing:border-box }
  html, body { margin:0; padding:0; background:#fff }
  body { font:13px/1.37 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color:var(--ink) }
  .page { width:210mm; min-height:297mm; padding:16mm 16mm 18mm; margin:0 auto }
  .center { text-align:center }
  .muted { color:var(--muted) }
  .ganesh { font-weight:700; letter-spacing:.08em }
  .firm { font-size:18px; font-weight:800; margin:10px 0 2px }
  .addr { font-size:12px; color:var(--muted) }
  .rule { height:1px; background:var(--line); margin:8px 0 14px }
  .band { display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:center; background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:10px 12px; margin:14px 0 }
  .band .left { font-weight:700 }
  .band .right { text-align:right; font-weight:700 }
  .cards { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:10px 0 14px }
  .card { border:1px solid var(--line); border-radius:8px; padding:10px 12px; background:#fff; min-height:54px }
  .card .h { font-weight:700; margin-bottom:6px }
  .card .addr { margin-top:4px }
  table.kv { width:100%; border-collapse:separate; border-spacing:0; margin-top:6px; border:1px solid var(--line); border-radius:8px; overflow:hidden }
  .kv th, .kv td { padding:8px 10px; vertical-align:top; border-bottom:1px solid var(--line) }
  .kv tr:last-child th, .kv tr:last-child td { border-bottom:0 }
  .kv th { width:32%; text-align:left; background:var(--soft); font-weight:600 }
  .kv td { background:#fff }
  .note-title { font-weight:700; margin:16px 0 8px }
  .intro-note { margin:8px 0 12px; font-size:11px; line-height:1.35 }
  ol.notes { margin:0 0 0 22px; padding:0 }
  ol.notes li { margin:6px 0; font-size:11px; font-weight:700 }
  .note-sep { display:block; border-top:1px solid var(--line); margin:18px 0; width:100%; }
  .footer { display:grid; grid-template-columns:1fr 1fr 1fr; align-items:start; margin-top:40px }
  .sig { text-align:center; color:var(--muted) }
  .firm-block { text-align:right }
  .firm-block .firm-name { font-weight:700 }
  .firm-block .note { font-size:10px; color:var(--muted); margin-top:6px }
  @page { size:A4; margin:10mm }
  @media print { .page { padding:0; width:auto; min-height:auto } }
</style>
</head>
<body>
  <div class="page">
    <div class="center ganesh">|| श्री गणेशाय नमः ||</div>
    <div class="rule"></div>
    <div class="center">
      <div class="firm">${esc(firmName)}</div>
      <div class="addr">${esc(firmAddress)}</div>
    </div>

    <div class="band">
      <div class="left">Contract No: ${esc(c.contract_no)}</div>
      <div class="right">Date: ${esc(fmtDMY(c.order_date))}</div>
    </div>

    <div class="center" style="font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin:2px 0 10px;">
      Contract Form
    </div>

    <div class="muted intro-note">
      Under Your Instruction and On Your Account We Have Done The Following Transactions as Following
      Terms And Conditions Which Please Note
    </div>

    <div class="cards">
      <div class="card">
        <div class="h">Seller</div>
        <div>${esc(c.seller_name)}</div>
        ${c.seller_address ? `<div class="addr">${esc(c.seller_address)}</div>` : ""}
      </div>
      <div class="card">
        <div class="h">Buyer</div>
        <div>${esc(c.buyer_name)}</div>
        ${c.buyer_address ? `<div class="addr">${esc(c.buyer_address)}</div>` : ""}
      </div>
    </div>

    <table class="kv">
      <tr><th>Commodity / Product</th><td>${esc(c.product_name)}</td></tr>
      <tr><th>Quantity</th><td>${esc(qty)}</td></tr>
      <tr><th>Price</th>
        <td>${esc(priceFmt.display)} per ${esc(c.unit)} <span class="muted">${esc(priceFmt.words)}</span></td>
      </tr>
      <tr><th>Status</th><td>${esc(c.status)}</td></tr>
      <tr><th>Delivery Place</th><td>${esc(c.delivery_station)}</td></tr>
      <tr><th>Delivery Period</th><td>${esc(c.delivery_schedule)}</td></tr>
      <tr><th>Payment Terms</th><td>${esc(c.payment_criteria)}</td></tr>
      <tr><th>Other Terms</th><td>${esc(c.terms)}</td></tr>
      <tr><th>Brokerage</th>
        <td>
          <div><strong>Seller:</strong> ${esc(sBrkFmt.display)} per ${esc(c.unit)} <span class="muted">${esc(sBrkFmt.words)}</span></div>
          <div><strong>Buyer:</strong> ${esc(bBrkFmt.display)} per ${esc(c.unit)} <span class="muted">${esc(bBrkFmt.words)}</span></div>
        </td>
      </tr>
    </table>

    <div class="note-title">NOTE</div>
    <ol class="notes">
      <li>We will not be responsible for any delivery dispute or claim. In case of any dispute we will be present only as witness.</li>
      <li>Seller &amp; Buyer will take care of 'C' form 'E1' form &amp; will send directly to each other. We are not responsible for the same.</li>
      <li>In case of any dispute settlement made by us, should be accepted by both parties.</li>
      <li>After dispatching the bargain bill copy of same should be send to us.</li>
      <li>If any complaint about quality &amp; other buyer should inform the broker &amp; seller within 24 hours, else we are not responsible.</li>
      <li>SUBJECT TO SANGLI JURISDICTION</li>
      <li>We are not responsible for any loss to any party to the contract vide this contract note and we are not responsible for the branch or fullfillment or performance of the contract entered into by way of this contract note between buyer and seller. We make this express and firm declaration for the parties to the contract in view of provision of the Indian contract act 1872.</li>
    </ol>
    <div class="note-sep"></div>

    <div class="footer">
      <div class="sig">Buyer</div>
      <div class="sig">Seller</div>
      <div class="firm-block">
        <div class="firm-name">${esc(firmName)}, <br> Sangli</div>
        <div class="note"><strong>Note:</strong> This is a system generated document<br/>and does not require signature.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default buildContractPrintHtml;
