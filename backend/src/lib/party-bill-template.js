function fmtDMY(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function num(v){ return (Number(v||0)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

function amountToWordsIndian(n){
  const units=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function two(x){ if(x<20) return units[x]||''; const t=Math.floor(x/10),u=x%10; return tens[t]+(u?' '+units[u]:''); }
  function three(x){ const h=Math.floor(x/100),r=x%100; return (h?units[h]+' Hundred'+(r?' ':''):'')+(r?two(r):''); }
  function sec(x,name){ return x? three(x)+(name?' '+name:''):''; }
  n=Math.round(Number(n||0)); if(n===0) return 'Zero';
  const crore=Math.floor(n/10000000); n%=10000000;
  const lakh=Math.floor(n/100000); n%=100000;
  const thousand=Math.floor(n/1000); n%=1000;
  const hundred=n;
  return [sec(crore,'Crore'),sec(lakh,'Lakh'),sec(thousand,'Thousand'),three(hundred)].filter(Boolean).join(' ')+' Only';
}

function buildPartyBillPrintHtml(data){
  const { meta, items, totals } = data;
  const firm = meta.firm||{}; const party = meta.party||{};
  const styles = `body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Cantarell,Noto Sans,Ubuntu,Helvetica Neue,Arial;color:#111827} .wrap{max-width:900px;margin:24px auto;padding:16px} .center{text-align:center} .muted{color:#6B7280} table{width:100%;border-collapse:collapse} th,td{border:1px solid #E5E7EB;padding:6px 8px;font-size:12px} th{background:#F3F4F6;text-align:left} .totals td{border:none}`;
  const header = `
    <div class="center" style="margin-bottom:8px;font-weight:700;font-size:18px">Trade Brokerage Statement</div>
    <div class="center" style="font-weight:700;font-size:16px">${escapeHtml(firm.name||'')}</div>
    ${firm.gst_no?`<div class="center muted">GSTIN: ${escapeHtml(firm.gst_no)}</div>`:''}
    ${firm.address?`<div class="center muted">${escapeHtml(firm.address)}</div>`:''}
  `;
  const metaHtml = `
    <div style="display:flex;justify-content:space-between;margin:10px 0 6px 0;font-size:12px">
      <div><div><strong>Bill No:</strong> ${escapeHtml(meta.bill_no||'—')}</div><div><strong>From:</strong> ${fmtDMY(meta.from)} &nbsp; <strong>To:</strong> ${fmtDMY(meta.to)}</div></div>
      <div><strong>Date:</strong> ${fmtDMY(meta.bill_date)}</div>
    </div>
    <div style="font-size:12px;margin-bottom:8px"><strong>Party:</strong> ${escapeHtml(party.name||'')} ${firm.gst_no&&party.gst_no?`&nbsp;&nbsp;<strong>GSTIN:</strong> ${escapeHtml(party.gst_no)}`:''}</div>
  `;
  const rows = items.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.contract_no)}</td><td>${fmtDMY(r.order_date)}</td><td>${escapeHtml(r.other_party)}</td><td>${escapeHtml(r.product||'')}</td><td style="text-align:right">${num(r.qty)}</td><td>${escapeHtml(r.unit||'')}</td><td style="text-align:right">${num(r.brokerage_rate)}</td><td style="text-align:right">${num(r.amount)}</td></tr>`).join('');
  const cg=Number(party.cgst_rate||0), sg=Number(party.sgst_rate||0), ig=Number(party.igst_rate||0);
  const taxes=[]; if((totals.cgst||0)>0) taxes.push(`<tr><td class="label" colspan="8">CGST (${cg.toFixed(0)}%)</td><td style="text-align:right">${num(totals.cgst)}</td></tr>`);
  if((totals.sgst||0)>0) taxes.push(`<tr><td class="label" colspan="8">SGST (${sg.toFixed(0)}%)</td><td style="text-align:right">${num(totals.sgst)}</td></tr>`);
  if((totals.igst||0)>0) taxes.push(`<tr><td class="label" colspan="8">IGST (${ig.toFixed(0)}%)</td><td style="text-align:right">${num(totals.igst)}</td></tr>`);
  const words = amountToWordsIndian(totals.total||0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Party Bill</title><style>${styles}</style></head><body><div class="wrap">${header}${metaHtml}<table><thead><tr><th>Sr.</th><th>Contract No</th><th>Date</th><th>Other Party</th><th>Product</th><th>Qty</th><th>Unit</th><th>Brokerage</th><th>Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="totals"><td class="label" colspan="8"><strong>Subtotal</strong></td><td style="text-align:right">${num(totals.subtotal)}</td></tr>${taxes.join('')}<tr class="totals"><td colspan="6" style="border:none"></td><td class="label" colspan="2"><strong>Total</strong></td><td style="text-align:right">${num(totals.total)}</td></tr><tr class="totals"><td colspan="9" style="border:none;padding-top:8px"><em>Amount in words:</em> <strong>${escapeHtml(words)}</strong></td></tr></tfoot></table><div style="display:flex;justify-content:space-between;margin-top:40px;font-size:12px"><div><strong>${escapeHtml(firm.name||'')}</strong></div><div style="text-align:right"><div style="height:36px"></div><div style="border-top:1px solid #9CA3AF;padding-top:4px">Authorised Signatory</div></div></div></div></body></html>`;
}

module.exports = { buildPartyBillPrintHtml };

