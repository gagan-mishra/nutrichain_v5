function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function dmy(value) {
  if (!value) return '-';
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return esc(value);
  const [year, month, day] = text.split('-');
  return `${day}/${month}/${year}`;
}

function monthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return esc(value || '');
  const date = new Date(`${value}-01T00:00:00Z`);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function number(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits });
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(value) {
  return value == null ? '-' : `${number(value, 1)}%`;
}

function buildPartyInsightsPrintHtml(payload) {
  const meta = payload?.meta || {};
  const summary = payload?.summary || {};
  const financial = payload?.financial || {};
  const months = Array.isArray(payload?.monthly_activity) ? payload.monthly_activity : [];
  const products = Array.isArray(payload?.products) ? payload.products.slice(0, 6) : [];
  const counterparties = Array.isArray(payload?.counterparties) ? payload.counterparties.slice(0, 6) : [];
  const highlights = Array.isArray(payload?.highlights) ? payload.highlights : [];
  const opportunities = Array.isArray(payload?.opportunities) ? payload.opportunities : [];
  const quantities = Array.isArray(payload?.quantity_by_unit) ? payload.quantity_by_unit : [];
  const party = meta.party || {};
  const firm = meta.firm || {};
  const fy = meta.fy || {};
  const period = meta.period || {
    key: 'consolidated',
    label: 'Consolidated FY',
    start_date: fy.start_date,
    end_date: fy.end_date,
    is_consolidated: true,
  };
  const maxMonthQty = Math.max(1, ...months.map((row) => Number(row.qty || 0)));

  const monthRows = months.length
    ? months.map((row) => `
      <tr>
        <td>${monthLabel(row.period)}</td>
        <td class="qty">${number(row.qty)} ${esc(row.unit || '')}</td>
        <td class="bar-cell"><span class="bar" style="width:${Math.max(2, (Number(row.qty || 0) / maxMonthQty) * 100)}%"></span></td>
        <td class="num">${number(row.trades, 0)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty">No contract activity recorded in this FY.</td></tr>';

  const productRows = products.length
    ? products.map((row) => `
      <tr>
        <td>${esc(row.product_name)}</td>
        <td class="num">${number(row.trades, 0)}</td>
        <td class="num">${number(row.qty)} ${esc(row.unit)}</td>
        <td class="num">${row.weighted_avg_price == null ? '-' : money(row.weighted_avg_price)}</td>
        <td class="num">${row.min_price == null ? '-' : `${money(row.min_price)} - ${money(row.max_price)}`}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty">No product activity recorded.</td></tr>';

  const counterpartyRows = counterparties.length
    ? counterparties.map((row) => `
      <tr>
        <td>${esc(row.party_name)}</td>
        <td>${esc(row.relationship)}</td>
        <td class="num">${number(row.trades, 0)}</td>
        <td class="num">${number(row.qty)} ${esc(row.unit)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty">No trading connections recorded.</td></tr>';
  const quantitiesText = quantities.length
    ? quantities.map((row) => `${number(row.qty)} ${esc(row.unit)}`).join(' | ')
    : `0 ${esc(summary.primary_unit || '')}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relationship Insights - ${esc(party.name || 'Party')}</title>
  <style>
    :root { --ink:#132235; --muted:#64748b; --line:#dce5ec; --soft:#f3f7f8; --teal:#087f72; --amber:#bd6b08; }
    * { box-sizing: border-box; }
    body { margin:0; color:var(--ink); font:11px/1.42 "Noto Sans", "Segoe UI", Arial, sans-serif; background:#fff; }
    .page { padding:0; }
    .hero { border:1px solid var(--line); border-top:5px solid var(--teal); border-radius:10px; padding:16px 18px; background:linear-gradient(120deg,#f4fbfa 0%,#fff 72%); }
    .hero-top { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
    .eyebrow { color:var(--teal); font-size:9px; font-weight:800; letter-spacing:1.4px; text-transform:uppercase; }
    h1 { margin:3px 0 2px; font-size:24px; letter-spacing:-.6px; line-height:1.12; }
    .party { font-size:15px; font-weight:700; margin-top:5px; }
    .muted { color:var(--muted); }
    .badge { display:inline-block; border:1px solid #f2c98b; border-radius:999px; padding:3px 8px; background:#fff8e8; color:#8a4b00; font-size:8px; font-weight:800; letter-spacing:.8px; }
    .right { text-align:right; min-width:180px; }
    .right strong { display:block; font-size:13px; }
    .right div { margin-top:2px; }
    .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:11px 0; }
    .kpi { border:1px solid var(--line); border-radius:8px; padding:9px 10px; background:#fff; }
    .kpi-label { color:var(--muted); font-size:8px; font-weight:800; letter-spacing:.7px; text-transform:uppercase; }
    .kpi-value { margin-top:3px; font-size:17px; font-weight:800; line-height:1.15; }
    .kpi-note { margin-top:2px; color:var(--muted); font-size:8.5px; }
    .section { margin-top:12px; break-inside:avoid; }
    .section-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:5px; }
    h2 { margin:0; font-size:13px; }
    .section-note { color:var(--muted); font-size:8.5px; }
    .highlights { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
    .highlight { border-left:3px solid var(--teal); border-radius:5px; padding:7px 9px; background:var(--soft); }
    table { width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:7px; overflow:hidden; }
    th { padding:6px 7px; background:#edf3f5; color:#405467; text-align:left; font-size:8px; letter-spacing:.5px; text-transform:uppercase; }
    td { padding:6px 7px; border-top:1px solid var(--line); vertical-align:middle; }
    tbody tr:first-child td { border-top:0; }
    tr { break-inside:avoid; }
    .num { text-align:right; white-space:nowrap; }
    .qty { width:125px; white-space:nowrap; }
    .bar-cell { width:34%; }
    .bar { display:block; height:7px; border-radius:999px; background:linear-gradient(90deg,var(--teal),#4db6a9); }
    .empty { padding:12px; text-align:center; color:var(--muted); }
    .split { display:grid; grid-template-columns:1.15fr .85fr; gap:9px; }
    .financial { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
    .money-card { border:1px solid var(--line); border-radius:7px; padding:8px; }
    .money-card strong { display:block; margin-top:3px; font-size:14px; }
    .outstanding { color:#a33b2d; }
    .opportunities { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
    .opportunity { border:1px solid var(--line); border-radius:7px; padding:9px; background:#fff; }
    .opportunity strong { color:var(--teal); display:block; margin-bottom:3px; }
    .continuation { break-before:page; padding-top:2px; }
    .continuation-head { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid var(--teal); padding-bottom:7px; margin-bottom:12px; }
    .continuation-head strong { font-size:14px; }
    .profile { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-bottom:12px; }
    .profile-card { border:1px solid var(--line); border-radius:7px; padding:8px; background:var(--soft); }
    .profile-card span { display:block; color:var(--muted); font-size:8px; font-weight:800; letter-spacing:.5px; text-transform:uppercase; }
    .profile-card strong { display:block; margin-top:3px; font-size:12px; }
    .profile-wide { grid-column:span 2; }
    .footer { margin-top:12px; padding-top:7px; border-top:1px solid var(--line); display:flex; justify-content:space-between; gap:18px; color:var(--muted); font-size:7.5px; }
    @page { size:A4; margin:9mm; }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div class="hero-top">
        <div>
          <div class="eyebrow">Relationship intelligence</div>
          <h1>Your ${period.is_consolidated ? 'trading year' : 'quarter'}, at a glance</h1>
          <div class="party">Prepared for ${esc(party.name || '')}</div>
          ${party.address ? `<div class="muted">${esc(party.address)}</div>` : ''}
        </div>
        <div class="right">
          <span class="badge">BETA REPORT</span>
          <strong>${esc(firm.name || '')}</strong>
          <div class="muted">FY ${esc(fy.label || '')} | ${esc(period.label || '')}${period.is_ongoing && !period.is_consolidated ? ' (Ongoing)' : ''}</div>
          <div class="muted">${dmy(period.start_date)} to ${dmy(period.end_date)}</div>
        </div>
      </div>
    </header>

    <section class="kpis">
      <div class="kpi"><div class="kpi-label">Trades</div><div class="kpi-value">${number(summary.trades, 0)}</div><div class="kpi-note">${number(summary.active_months, 0)} active months</div></div>
      <div class="kpi"><div class="kpi-label">Primary volume</div><div class="kpi-value">${number(summary.primary_qty)}</div><div class="kpi-note">${esc(summary.primary_unit || '')}</div></div>
      <div class="kpi"><div class="kpi-label">Average trade</div><div class="kpi-value">${number(summary.avg_trade_qty)}</div><div class="kpi-note">${esc(summary.primary_unit || '')}</div></div>
      <div class="kpi"><div class="kpi-label">Collection rate</div><div class="kpi-value">${pct(financial.collection_rate)}</div><div class="kpi-note">${number(financial.bills, 0)} generated bills</div></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>What stands out</h2><span class="section-note">Based on recorded contracts and receipts</span></div>
      <div class="highlights">${highlights.length ? highlights.slice(0, 4).map((item) => `<div class="highlight">${esc(item)}</div>`).join('') : '<div class="highlight">No activity is available for this period yet.</div>'}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Monthly trading rhythm</h2><span class="section-note">Volume shown in ${esc(summary.primary_unit || '')}</span></div>
      <table><thead><tr><th>Month</th><th>Volume</th><th>Relative activity</th><th class="num">Trades</th></tr></thead><tbody>${monthRows}</tbody></table>
    </section>

    <section class="section split">
      <div>
        <div class="section-head"><h2>Product mix and pricing</h2></div>
        <table><thead><tr><th>Product</th><th class="num">Trades</th><th class="num">Qty</th><th class="num">Avg price</th><th class="num">Range</th></tr></thead><tbody>${productRows}</tbody></table>
      </div>
      <div>
        <div class="section-head"><h2>Financial position</h2></div>
        <div class="financial">
          <div class="money-card"><span class="muted">Billed</span><strong>${money(financial.bill_total)}</strong></div>
          <div class="money-card"><span class="muted">Received</span><strong>${money(financial.received)}</strong></div>
          <div class="money-card"><span class="muted">Outstanding</span><strong class="outstanding">${money(financial.outstanding)}</strong></div>
          <div class="money-card"><span class="muted">Collection</span><strong>${pct(financial.collection_rate)}</strong></div>
        </div>
      </div>
    </section>

    ${counterparties.length || opportunities.length ? (period.is_consolidated ? `
      <div class="continuation">
        <div class="continuation-head">
          <div><div class="eyebrow">Relationship details</div><strong>${esc(party.name || '')}</strong></div>
          <div class="right muted">${esc(firm.name || '')}<br/>FY ${esc(fy.label || '')} | ${esc(period.label || '')}</div>
        </div>

        <div class="profile">
          <div class="profile-card"><span>As seller</span><strong>${number(summary.seller_trades, 0)} trades | ${number(summary.seller_qty)} ${esc(summary.primary_unit || '')}</strong></div>
          <div class="profile-card"><span>As buyer</span><strong>${number(summary.buyer_trades, 0)} trades | ${number(summary.buyer_qty)} ${esc(summary.primary_unit || '')}</strong></div>
          <div class="profile-card"><span>First period trade</span><strong>${dmy(summary.first_trade_date)}</strong></div>
          <div class="profile-card"><span>Latest period trade</span><strong>${dmy(summary.last_trade_date)}</strong></div>
          <div class="profile-card profile-wide"><span>Recorded volume by unit</span><strong>${quantitiesText}</strong></div>
          <div class="profile-card profile-wide"><span>Relationship activity</span><strong>${number(summary.active_months, 0)} active of ${number(summary.elapsed_months, 0)} elapsed period months</strong></div>
        </div>

        <section class="section">
          <div class="section-head"><h2>Frequent trading connections</h2><span class="section-note">Top connections by recorded activity</span></div>
          <table><thead><tr><th>Counterparty</th><th>Role</th><th class="num">Trades</th><th class="num">Volume</th></tr></thead><tbody>${counterpartyRows}</tbody></table>
        </section>

        ${opportunities.length ? `<section class="section"><div class="section-head"><h2>Ideas for the next conversation</h2></div><div class="opportunities">${opportunities.map((item) => `<div class="opportunity"><strong>${esc(item.title)}</strong>${esc(item.text)}</div>`).join('')}</div></section>` : ''}
      </div>` : `
      <div class="quarter-tail">
        <section class="section">
          <div class="section-head"><h2>Frequent trading connections</h2><span class="section-note">Top connections by recorded activity</span></div>
          <table><thead><tr><th>Counterparty</th><th>Role</th><th class="num">Trades</th><th class="num">Volume</th></tr></thead><tbody>${counterpartyRows}</tbody></table>
        </section>
        ${opportunities.length ? `<section class="section"><div class="section-head"><h2>Ideas for the next conversation</h2></div><div class="opportunities">${opportunities.map((item) => `<div class="opportunity"><strong>${esc(item.title)}</strong>${esc(item.text)}</div>`).join('')}</div></section>` : ''}
      </div>`) : ''}

    <footer class="footer">
      <span>Selected-period historical summary only. Price statistics are quantity-weighted from recorded contracts and are not a market forecast or commercial commitment.</span>
      <span>Generated ${dmy(meta.generated_at)}</span>
    </footer>
  </main>
</body>
</html>`;
}

module.exports = { buildPartyInsightsPrintHtml };
