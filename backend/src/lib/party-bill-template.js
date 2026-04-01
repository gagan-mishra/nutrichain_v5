function fmtDMY(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function num(v) {
  return Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function qtyTotalDisplay(items) {
  let total = 0;
  for (const it of (items || [])) {
    const qty = Number(it?.qty || 0);
    if (!Number.isFinite(qty)) continue;
    total += qty;
  }
  return `${num(total)} M.T.`;
}

function amountToWordsIndian(n) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function two(x) {
    if (x < 20) return units[x] || '';
    const t = Math.floor(x / 10);
    const u = x % 10;
    return tens[t] + (u ? ` ${units[u]}` : '');
  }

  function three(x) {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return (h ? `${units[h]} Hundred${r ? ' ' : ''}` : '') + (r ? two(r) : '');
  }

  function sec(x, name) {
    return x ? `${three(x)}${name ? ` ${name}` : ''}` : '';
  }

  n = Math.round(Number(n || 0));
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  return [sec(crore, 'Crore'), sec(lakh, 'Lakh'), sec(thousand, 'Thousand'), three(n)]
    .filter(Boolean)
    .join(' ') + ' Rupees Only';
}

function buildPartyBillPrintHtml(data) {
  const { meta, items, totals } = data;
  const firm = meta.firm || {};
  const party = meta.party || {};

  // Important: prevent browser print engines from repeating table footer on every page.
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');
    body{font-family:"Noto Sans","DejaVu Sans","Arial Unicode MS","Segoe UI Symbol","Segoe UI",Arial,Helvetica,sans-serif;color:#111827}
    .wrap{max-width:900px;margin:24px auto;padding:16px}
    .center{text-align:center}
    .muted{color:#6B7280}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #E5E7EB;padding:6px 8px;font-size:12px}
    th{background:#F3F4F6;text-align:left}
    .totals-wrap{margin-top:10px;margin-left:auto;max-width:420px;break-inside:avoid-page;page-break-inside:avoid}
    .totals-table{width:100%;border-collapse:collapse}
    .totals-table td{border:none;padding:4px 0;font-size:12px}
    .totals-table .label{text-align:right;padding-right:10px}
    .totals-table .value{text-align:right;white-space:nowrap}
    .amount-words{margin-top:8px;font-size:12px;text-align:left}
    .money{display:inline-flex;align-items:baseline;gap:.16em;white-space:nowrap}
    .money .rs{font-family:"Noto Sans","Segoe UI Symbol","Arial Unicode MS","Nirmala UI",sans-serif;line-height:1}
    .money .amt{font-variant-numeric:tabular-nums}
  `;

  const header = `
    <div class="center" style="margin-bottom:8px;font-weight:700;font-size:18px">Trade Brokerage Statement</div>
    <div class="center" style="font-weight:700;font-size:16px">${escapeHtml(firm.name || '')}</div>
    ${firm.gst_no ? `<div class="center muted">GSTIN: ${escapeHtml(firm.gst_no)}</div>` : ''}
    ${firm.address ? `<div class="center muted">${escapeHtml(firm.address)}</div>` : ''}
  `;

  const metaHtml = `
    <div style="display:flex;justify-content:space-between;margin:10px 0 6px 0;font-size:12px">
      <div>
        <div><strong>Bill No:</strong> ${escapeHtml(meta.bill_no || '—')}</div>
        <div><strong>From:</strong> ${fmtDMY(meta.from)} &nbsp;&nbsp; <strong>To:</strong> ${fmtDMY(meta.to)}</div>
      </div>
      <div><strong>Date:</strong> ${fmtDMY(meta.bill_date)}</div>
    </div>
    <div style="font-size:12px;margin-bottom:8px">
      <strong>Party:</strong> ${escapeHtml(party.name || '')}
      ${firm.gst_no && party.gst_no ? `&nbsp;&nbsp;<strong>GSTIN:</strong> ${escapeHtml(party.gst_no)}` : ''}
    </div>
  `;

  const rows = items
    .map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.contract_no)}</td>
        <td>${fmtDMY(r.order_date)}</td>
        <td>${escapeHtml(r.other_party)}</td>
        <td>${escapeHtml(r.product || '')}</td>
        <td style="text-align:right">${num(r.qty)}</td>
        <td>${escapeHtml(r.unit || '')}</td>
        <td style="text-align:right">${num(r.brokerage_rate)}</td>
        <td style="text-align:right">${num(r.amount)}</td>
      </tr>
    `)
    .join('');

  const cg = Number(party.cgst_rate || 0);
  const sg = Number(party.sgst_rate || 0);
  const ig = Number(party.igst_rate || 0);
  const taxes = [];
  if ((totals.cgst || 0) > 0) taxes.push(`<tr><td class="label">CGST (${cg.toFixed(0)}%)</td><td class="value">${inr(totals.cgst)}</td></tr>`);
  if ((totals.sgst || 0) > 0) taxes.push(`<tr><td class="label">SGST (${sg.toFixed(0)}%)</td><td class="value">${inr(totals.sgst)}</td></tr>`);
  if ((totals.igst || 0) > 0) taxes.push(`<tr><td class="label">IGST (${ig.toFixed(0)}%)</td><td class="value">${inr(totals.igst)}</td></tr>`);

  const totalQty = qtyTotalDisplay(items);
  const words = amountToWordsIndian(totals.total || 0);
  const totalsBlock = `
    <div class="totals-wrap">
      <table class="totals-table">
        <tr>
          <td class="label"><strong>Total Qty</strong></td>
          <td class="value">${escapeHtml(totalQty)}</td>
        </tr>
        <tr>
          <td class="label"><strong>Subtotal</strong></td>
          <td class="value">${inr(totals.subtotal)}</td>
        </tr>
        ${taxes.join('')}
        <tr>
          <td class="label"><strong>Total</strong></td>
          <td class="value"><strong>${inr(totals.total)}</strong></td>
        </tr>
      </table>
    </div>
  `;
  const wordsBlock = `<div class="amount-words"><em>Amount in words:</em> <strong>${escapeHtml(words)}</strong></div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Party Bill</title>
  <style>${styles}</style>
</head>
<body>
  <div class="wrap">
    ${header}
    ${metaHtml}
    <table>
      <thead>
        <tr>
          <th>Sr.</th>
          <th>Contract No</th>
          <th>Date</th>
          <th>Other Party</th>
          <th>Product</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Brokerage</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${totalsBlock}
    ${wordsBlock}

    <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:12px">
      <div><strong>${escapeHtml(firm.name || '')}</strong></div>
      <div style="text-align:right">
        <div style="height:36px"></div>
        <div style="border-top:1px solid #9CA3AF;padding-top:4px">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function inr(v) {
  return `<span class="money"><span class="rs">&#8377;</span><span class="amt">${num(v)}</span></span>`;
}

module.exports = { buildPartyBillPrintHtml };
