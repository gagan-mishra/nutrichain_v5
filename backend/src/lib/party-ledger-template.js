function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function dmy(v) {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return String(v);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function money(v) {
  return `Rs. ${Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildPartyLedgerPrintHtml(payload) {
  const meta = payload?.meta || {};
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const totals = payload?.totals || { bill_total: 0, received: 0, outstanding: 0, bills: 0 };
  const firm = meta.firm || {};
  const party = meta.party || {};

  const rowsHtml = rows.length
    ? rows.map((r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${esc(r.bill_no)}</td>
        <td>${esc(dmy(r.bill_date))}</td>
        <td style="text-align:right">${money(r.bill_total)}</td>
        <td style="text-align:right">${money(r.received)}</td>
        <td style="text-align:right">${money(r.outstanding)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="6" class="empty">No bills in selected period.</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Party Ledger</title>
  <style>
    body { font-family: "Noto Sans", "Segoe UI", Arial, sans-serif; color: #111827; font-size: 12px; }
    .wrap { max-width: 840px; margin: 16px auto; padding: 6px; }
    .center { text-align: center; }
    .muted { color: #6B7280; }
    .title { font-weight: 700; font-size: 17px; margin-bottom: 2px; }
    .sub { margin-top: 2px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
    .box { border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 10px; }
    .box div { margin: 2px 0; }
    .summary { width: 100%; border-collapse: collapse; margin: 10px 0 14px; }
    .summary td { border: 1px solid #E5E7EB; padding: 8px 10px; }
    .summary td:first-child { background: #F9FAFB; width: 40%; font-weight: 600; }
    .summary td:last-child { text-align: right; font-weight: 700; }
    .section-title { margin: 12px 0 6px; font-weight: 700; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #E5E7EB; padding: 6px 7px; vertical-align: top; }
    th { background: #F3F4F6; text-align: left; }
    .empty { text-align: center; color: #6B7280; padding: 10px; }
    @page { size: A4; margin: 10mm; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      <div class="title">Party Ledger Statement</div>
      <div><strong>${esc(firm.name || '')}</strong></div>
      ${firm.gst_no ? `<div class="muted">GSTIN: ${esc(firm.gst_no)}</div>` : ''}
      ${firm.address ? `<div class="muted sub">${esc(firm.address)}</div>` : ''}
    </div>

    <div class="meta">
      <div class="box">
        <div><strong>Party:</strong> ${esc(party.name || '')}</div>
        ${party.gst_no ? `<div><strong>GSTIN:</strong> ${esc(party.gst_no)}</div>` : ''}
      </div>
      <div class="box">
        <div><strong>From:</strong> ${esc(dmy(meta.from))}</div>
        <div><strong>To:</strong> ${esc(dmy(meta.to))}</div>
        <div><strong>As of:</strong> ${esc(dmy(meta.as_of))}</div>
      </div>
    </div>

    <table class="summary">
      <tr><td>Total Bills</td><td>${Number(totals.bills || 0)}</td></tr>
      <tr><td>Total Bill Amount</td><td>${money(totals.bill_total)}</td></tr>
      <tr><td>Total Received</td><td>${money(totals.received)}</td></tr>
      <tr><td>Total Outstanding</td><td>${money(totals.outstanding)}</td></tr>
    </table>

    <div class="section-title">Bill-wise Status</div>
    <table>
      <thead>
        <tr>
          <th>Sr.</th>
          <th>Bill No</th>
          <th>Bill Date</th>
          <th>Bill Amount</th>
          <th>Paid</th>
          <th>Outstanding</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="muted" style="margin-top:10px;">
      Generated on: ${esc(dmy(meta.generated_at))} ${esc(String(meta.generated_at || '').slice(11, 19))}
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildPartyLedgerPrintHtml };
