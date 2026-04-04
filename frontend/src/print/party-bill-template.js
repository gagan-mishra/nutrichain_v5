export function buildPartyBillHtml(data) {
  const { meta, items, totals } = data;
  const firm = meta.firm || {};
  const party = meta.party || {};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');
  body { font-family: "Noto Sans", "DejaVu Sans", "Arial Unicode MS", "Segoe UI Symbol", "Segoe UI", Arial, Helvetica, sans-serif; color: #111827; }
  .wrap { max-width: 900px; margin: 24px auto; padding: 16px; }
  .center { text-align: center; }
  .muted { color: #6B7280; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #E5E7EB; padding: 6px 8px; font-size: 12px; }
  th { background: #F3F4F6; text-align: left; }
  thead { display: table-header-group; }
  tbody tr { break-inside: avoid-page; page-break-inside: avoid; }
  .totals-wrap { margin-top: 10px; margin-left: auto; max-width: 420px; break-inside: avoid-page; page-break-inside: avoid; }
  .totals-table { width: 100%; border-collapse: collapse; }
  .totals-table td { border: none; padding: 2px 0; font-size: 12px; line-height: 1.2; }
  .totals-table .label { text-align: right; padding-right: 10px; }
  .totals-table .value { text-align: right; white-space: nowrap; }
  .amount-words { margin-top: 8px; font-size: 12px; text-align: left; }
  .money { display: inline-flex; align-items: baseline; gap: .16em; white-space: nowrap; }
  .money .rs { font-family: "Noto Sans", "Segoe UI Symbol", "Arial Unicode MS", "Nirmala UI", sans-serif; line-height: 1; }
  .money .amt { font-variant-numeric: tabular-nums; }
  `;

  const firmHeader = `
    <div class="center" style="margin-bottom:8px; font-weight:700; font-size:18px;">Trade Brokerage Statement</div>
    <div class="center" style="font-weight:700; font-size:16px;">${escapeHtml(firm.name || '')}</div>
    ${firm.gst_no ? `<div class="center muted">GSTIN: ${escapeHtml(firm.gst_no)}</div>` : ''}
    ${firm.address ? `<div class="center muted">${escapeHtml(firm.address)}</div>` : ''}
  `;

  const billMeta = `
    <div style="display:flex; justify-content:space-between; margin:10px 0 6px 0; font-size:12px;">
      <div>
        <div><strong>Bill No:</strong> ${escapeHtml(meta.bill_no || '-')}</div>
        <div><strong>From:</strong> ${fmtDMY(meta.from)} &nbsp;&nbsp; <strong>To:</strong> ${fmtDMY(meta.to)}</div>
      </div>
      <div>
        <div><strong>Date:</strong> ${fmtDMY(meta.bill_date)}</div>
      </div>
    </div>
    <div style="font-size:12px; margin-bottom:8px;">
      <strong>Party:</strong> ${escapeHtml(party.name || '')}
      ${firm.gst_no && party.gst_no ? `&nbsp;&nbsp; <strong>GSTIN:</strong> ${escapeHtml(party.gst_no)}` : ''}
      ${party.address ? `<br/><strong>Address:</strong> ${escapeHtml(party.address)}` : ''}
    </div>
  `;

  const rows = items.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.contract_no)}</td>
      <td>${fmtDMY(r.order_date)}</td>
      <td>${escapeHtml(r.other_party)}</td>
      <td>${escapeHtml(r.product || '')}</td>
      <td style="text-align:right;">${num(r.qty)}</td>
      <td>${escapeHtml(r.unit || '')}</td>
      <td style="text-align:right;">${r.price == null ? '' : num(r.price)}</td>
      <td style="text-align:right;">${num(r.brokerage_rate)}</td>
      <td style="text-align:right;">${num(r.amount)}</td>
    </tr>
  `).join('');

  const taxRows = [];
  const cg = Number(party.cgst_rate || 0);
  const sg = Number(party.sgst_rate || 0);
  const ig = Number(party.igst_rate || 0);
  if ((totals.cgst || 0) > 0) taxRows.push(`<tr><td class="label">CGST (${cg.toFixed(0)}%)</td><td class="value">${inr(totals.cgst)}</td></tr>`);
  if ((totals.sgst || 0) > 0) taxRows.push(`<tr><td class="label">SGST (${sg.toFixed(0)}%)</td><td class="value">${inr(totals.sgst)}</td></tr>`);
  if ((totals.igst || 0) > 0) taxRows.push(`<tr><td class="label">IGST (${ig.toFixed(0)}%)</td><td class="value">${inr(totals.igst)}</td></tr>`);

  const totalQty = qtyTotalDisplay(items);
  const totalWords = amountToWordsIndian(totals.total || 0);
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
        ${taxRows.join('')}
        <tr>
          <td class="label"><strong>Total</strong></td>
          <td class="value"><strong>${inr(totals.total)}</strong></td>
        </tr>
      </table>
    </div>
  `;
  const wordsBlock = `<div class="amount-words"><em>Amount in words:</em> <strong>${escapeHtml(totalWords)}</strong></div>`;
  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>Party Bill</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="wrap">
        ${firmHeader}
        ${billMeta}
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
              <th>Price</th>
              <th>Brokerage</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${totalsBlock}
        ${wordsBlock}

        <div style="display:flex; justify-content:space-between; margin-top:40px; font-size:12px;">
          <div><strong>${escapeHtml(firm.name || '')}</strong></div>
          <div style="text-align:right">
            <div style="height:36px"></div>
            <div style="border-top:1px solid #9CA3AF; padding-top:4px;">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </body>
  </html>`;
  return html;
}

// Excel-friendly HTML (opens in Excel when saved as .xls)
export function buildPartyBillExcelHtml(data) {
  const { meta, items, totals } = data;
  const firm = meta.firm || {};
  const party = meta.party || {};

  const rows = items.map((r, i) => (
    `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.contract_no)}</td>
      <td>${fmtDMY(r.order_date)}</td>
      <td>${escapeHtml(r.other_party)}</td>
      <td>${escapeHtml(r.product || '')}</td>
      <td style="mso-number-format:'0.00'; text-align:right">${Number(r.qty || 0)}</td>
      <td>${escapeHtml(r.unit || '')}</td>
      <td style="mso-number-format:'0.00'; text-align:right">${r.price == null ? '' : Number(r.price)}</td>
      <td style="mso-number-format:'0.00'; text-align:right">${Number(r.brokerage_rate || 0)}</td>
      <td style="mso-number-format:'0.00'; text-align:right">${Number(r.amount || 0)}</td>
    </tr>`
  )).join('');

  const cg = Number(party.cgst_rate || 0);
  const sg = Number(party.sgst_rate || 0);
  const ig = Number(party.igst_rate || 0);

  const taxRows = [];
  if ((totals.cgst || 0) > 0) taxRows.push(`<tr><td colspan="9" style="text-align:right">CGST (${cg.toFixed(0)}%)</td><td style="mso-number-format:'0.00'; text-align:right">${Number(totals.cgst)}</td></tr>`);
  if ((totals.sgst || 0) > 0) taxRows.push(`<tr><td colspan="9" style="text-align:right">SGST (${sg.toFixed(0)}%)</td><td style="mso-number-format:'0.00'; text-align:right">${Number(totals.sgst)}</td></tr>`);
  if ((totals.igst || 0) > 0) taxRows.push(`<tr><td colspan="9" style="text-align:right">IGST (${ig.toFixed(0)}%)</td><td style="mso-number-format:'0.00'; text-align:right">${Number(totals.igst)}</td></tr>`);

  const totalQty = qtyTotalDisplay(items);
  const totalWords = amountToWordsIndian(totals.total || 0);
  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8" />
    <style>
      table{border-collapse:collapse; width:100%}
      th,td{border:1px solid #999; padding:4px}
      th{background:#eee}
    </style>
  </head>
  <body>
    <table>
      <tr><td colspan="10" align="center" style="font-weight:bold; font-size:16px">Trade Brokerage Statement</td></tr>
      <tr><td colspan="10" align="center" style="font-weight:bold">${escapeHtml(firm.name || '')}</td></tr>
      ${firm.gst_no ? `<tr><td colspan="10" align="center">GSTIN: ${escapeHtml(firm.gst_no)}</td></tr>` : ''}
      ${firm.address ? `<tr><td colspan="10" align="center">${escapeHtml(firm.address)}</td></tr>` : ''}
      <tr>
        <td colspan="6"><b>Bill No:</b> ${escapeHtml(meta.bill_no || '-')}</td>
        <td colspan="4" align="right"><b>Date:</b> ${fmtDMY(meta.bill_date)}</td>
      </tr>
      <tr>
        <td colspan="10"><b>Party:</b> ${escapeHtml(party.name || '')} ${firm.gst_no && party.gst_no ? `&nbsp;&nbsp;<b>GSTIN:</b> ${escapeHtml(party.gst_no)}` : ''}${party.address ? `&nbsp;&nbsp;<b>Address:</b> ${escapeHtml(party.address)}` : ''}</td>
      </tr>
      <tr>
        <td colspan="10"><b>From:</b> ${fmtDMY(meta.from)} &nbsp;&nbsp; <b>To:</b> ${fmtDMY(meta.to)}</td>
      </tr>
    </table>
    <br/>
    <table>
      <tr>
        <th>Sr.</th>
        <th>Contract No</th>
        <th>Date</th>
        <th>Other Party</th>
        <th>Product</th>
        <th>Qty</th>
        <th>Unit</th>
        <th>Price</th>
        <th>Brokerage</th>
        <th>Amount</th>
      </tr>
      ${rows}
      <tr><td colspan="9" align="right"><b>Total Qty</b></td><td style="text-align:right">${escapeHtml(totalQty)}</td></tr>
      <tr><td colspan="9" align="right"><b>Subtotal</b></td><td style="mso-number-format:'0.00'; text-align:right">${Number(totals.subtotal || 0)}</td></tr>
      ${taxRows.join('')}
      <tr><td colspan="7"></td><td colspan="2" align="right"><b>Total</b></td><td style="mso-number-format:'0.00'; text-align:right">${Number(totals.total || 0)}</td></tr>
      <tr><td colspan="10"><i>Amount in words:</i> <b>${escapeHtml(totalWords)}</b></td></tr>
    </table>

    <br/>
    <table>
      <tr>
        <td><b>${escapeHtml(firm.name || '')}</b></td>
        <td align="right" style="border:none">
          <div style="height:28px"></div>
          <div style="border-top:1px solid #999; padding-top:4px">Authorised Signatory</div>
        </td>
      </tr>
    </table>
  </body></html>`;
}
function fmtDMY(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
function num(v) { return (Number(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function inr(v) { return `<span class="money"><span class="rs">&#8377;</span><span class="amt">${num(v)}</span></span>`; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function qtyTotalDisplay(items) {
  let total = 0;
  for (const it of (items || [])) {
    const qty = Number(it?.qty || 0);
    if (!Number.isFinite(qty)) continue;
    total += qty;
  }
  return `${num(total)} M.T.`;
}

// ---- helpers: amount in words (Indian numbering) ----
function amountToWordsIndian(n) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function twoDigits(num) {
    if (num < 20) return units[num] || '';
    const t = Math.floor(num / 10), u = num % 10;
    return tens[t] + (u ? ' ' + units[u] : '');
  }
  function threeDigits(num) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return (h ? units[h] + ' Hundred' + (rest ? ' ' : '') : '') + (rest ? twoDigits(rest) : '');
  }
  function section(num, name) { return num ? threeDigits(num) + (name ? ' ' + name : '') : ''; }
  n = Math.round(Number(n || 0));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  const parts = [
    section(crore, 'Crore'),
    section(lakh, 'Lakh'),
    section(thousand, 'Thousand'),
    threeDigits(hundred)
  ].filter(Boolean);
  return parts.join(' ') + ' Rupees Only';
}


