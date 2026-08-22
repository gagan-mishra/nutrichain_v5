function toDateStr(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(value) {
  const date = toDateStr(value);
  return date ? date.slice(0, 7) : null;
}

function normalizeUnit(value) {
  return String(value || 'Unit').trim().replace(/\s+/g, ' ') || 'Unit';
}

function shiftMonths(dateText, months) {
  const text = toDateStr(dateText);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function previousDay(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function resolveInsightPeriod(fy, periodKey = 'consolidated', todayInput = new Date()) {
  const fyStart = toDateStr(fy?.start_date || fy?.startDate);
  const fyEnd = toDateStr(fy?.end_date || fy?.endDate);
  const today = toDateStr(todayInput);
  if (!fyStart || !fyEnd) return null;

  const key = String(periodKey || 'consolidated').toLowerCase();
  if (key === 'consolidated') {
    return {
      key,
      label: 'Consolidated FY',
      start_date: fyStart,
      end_date: fyEnd,
      is_consolidated: true,
      is_ongoing: Boolean(today && fyStart <= today && today <= fyEnd),
    };
  }

  const match = key.match(/^q([1-4])$/);
  if (!match) return null;
  const quarter = Number(match[1]);
  const startDate = shiftMonths(fyStart, (quarter - 1) * 3);
  const nextQuarterStart = shiftMonths(fyStart, quarter * 3);
  const calculatedEnd = previousDay(nextQuarterStart);
  const endDate = calculatedEnd > fyEnd ? fyEnd : calculatedEnd;

  return {
    key,
    label: `Q${quarter}`,
    start_date: startDate,
    end_date: endDate,
    is_consolidated: false,
    is_ongoing: Boolean(today && startDate <= today && today <= endDate),
  };
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function monthSequence(startInput, endInput, todayInput = new Date()) {
  const startText = toDateStr(startInput);
  const endText = toDateStr(endInput);
  const todayText = toDateStr(todayInput);
  if (!startText || !endText || !todayText) return [];

  const start = new Date(`${startText.slice(0, 7)}-01T00:00:00Z`);
  const fyEnd = new Date(`${endText.slice(0, 7)}-01T00:00:00Z`);
  const today = new Date(`${todayText.slice(0, 7)}-01T00:00:00Z`);
  if (today < start) return [];
  const end = today < fyEnd ? today : fyEnd;

  const out = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    out.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function percent(part, whole) {
  return whole > 0 ? round((part / whole) * 100, 1) : 0;
}

function derivePartyInsights({ contracts = [], partyId, fy, period, financial = {}, today = new Date() }) {
  const safeRows = Array.isArray(contracts) ? contracts : [];
  const numericPartyId = Number(partyId);
  const unitStats = new Map();

  for (const row of safeRows) {
    const unit = normalizeUnit(row.unit);
    const qty = Number(row.qty || 0);
    const current = unitStats.get(unit) || { unit, trades: 0, qty: 0 };
    current.trades += 1;
    current.qty += qty;
    unitStats.set(unit, current);
  }

  const quantityByUnit = Array.from(unitStats.values())
    .map((item) => ({ ...item, qty: round(item.qty, 3) }))
    .sort((a, b) => b.trades - a.trades || b.qty - a.qty || a.unit.localeCompare(b.unit));
  const primaryUnit = quantityByUnit[0]?.unit || 'Unit';
  const primaryQty = Number(quantityByUnit[0]?.qty || 0);

  const productMap = new Map();
  const counterpartyMap = new Map();
  const monthMap = new Map();
  let sellerTrades = 0;
  let buyerTrades = 0;
  let sellerQty = 0;
  let buyerQty = 0;

  for (const row of safeRows) {
    const qty = Number(row.qty || 0);
    const unit = normalizeUnit(row.unit);
    const price = row.price == null ? null : Number(row.price);
    const isSeller = Number(row.seller_id) === numericPartyId;
    const isBuyer = Number(row.buyer_id) === numericPartyId;

    if (isSeller) {
      sellerTrades += 1;
      if (unit === primaryUnit) sellerQty += qty;
    }
    if (isBuyer) {
      buyerTrades += 1;
      if (unit === primaryUnit) buyerQty += qty;
    }

    const productName = row.product_name || 'Unspecified product';
    const productKey = `${row.product_id || productName}::${unit}`;
    const product = productMap.get(productKey) || {
      product_id: row.product_id || null,
      product_name: productName,
      unit,
      trades: 0,
      qty: 0,
      priced_qty: 0,
      weighted_value: 0,
      min_price: null,
      max_price: null,
    };
    product.trades += 1;
    product.qty += qty;
    if (price != null && Number.isFinite(price) && price > 0) {
      product.priced_qty += qty;
      product.weighted_value += price * qty;
      product.min_price = product.min_price == null ? price : Math.min(product.min_price, price);
      product.max_price = product.max_price == null ? price : Math.max(product.max_price, price);
    }
    productMap.set(productKey, product);

    const counterpartId = isSeller ? Number(row.buyer_id) : Number(row.seller_id);
    const counterpartName = isSeller ? row.buyer_name : row.seller_name;
    const counterpartRole = isSeller ? 'Buyer' : 'Seller';
    if (counterpartId && counterpartId !== numericPartyId) {
      const counterKey = `${counterpartId}::${counterpartRole}::${unit}`;
      const counter = counterpartyMap.get(counterKey) || {
        party_id: counterpartId,
        party_name: counterpartName || 'Unnamed party',
        relationship: counterpartRole,
        unit,
        trades: 0,
        qty: 0,
      };
      counter.trades += 1;
      counter.qty += qty;
      counterpartyMap.set(counterKey, counter);
    }

    const period = monthKey(row.order_date);
    if (period) {
      const monthly = monthMap.get(period) || { period, trades: 0, qty: 0 };
      monthly.trades += 1;
      if (unit === primaryUnit) monthly.qty += qty;
      monthMap.set(period, monthly);
    }
  }

  const products = Array.from(productMap.values())
    .map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      unit: item.unit,
      trades: item.trades,
      qty: round(item.qty, 3),
      share_pct: item.unit === primaryUnit ? percent(item.qty, primaryQty) : null,
      weighted_avg_price: item.priced_qty > 0 ? round(item.weighted_value / item.priced_qty, 2) : null,
      min_price: item.min_price == null ? null : round(item.min_price, 2),
      max_price: item.max_price == null ? null : round(item.max_price, 2),
    }))
    .sort((a, b) => b.trades - a.trades || b.qty - a.qty || a.product_name.localeCompare(b.product_name));

  const counterparties = Array.from(counterpartyMap.values())
    .map((item) => ({
      ...item,
      qty: round(item.qty, 3),
      share_pct: item.unit === primaryUnit ? percent(item.qty, primaryQty) : null,
    }))
    .sort((a, b) => b.trades - a.trades || b.qty - a.qty || a.party_name.localeCompare(b.party_name));

  const reportRange = period || fy;
  const periods = monthSequence(
    reportRange?.start_date || reportRange?.startDate,
    reportRange?.end_date || reportRange?.endDate,
    today
  );
  const monthlyActivity = periods.map((period) => {
    const current = monthMap.get(period);
    return {
      period,
      trades: Number(current?.trades || 0),
      qty: round(current?.qty || 0, 3),
      unit: primaryUnit,
    };
  });
  const activeMonths = new Set(safeRows.map((row) => monthKey(row.order_date)).filter(Boolean)).size;
  const latest = monthlyActivity[monthlyActivity.length - 1] || null;
  const previous = monthlyActivity[monthlyActivity.length - 2] || null;
  const qtyChange = latest && previous ? round(latest.qty - previous.qty, 3) : null;
  const qtyChangePct = latest && previous && previous.qty > 0 ? round((qtyChange / previous.qty) * 100, 1) : null;
  let momentumDirection = 'flat';
  if (qtyChange > 0) momentumDirection = 'up';
  if (qtyChange < 0) momentumDirection = 'down';

  const dates = safeRows.map((row) => toDateStr(row.order_date)).filter(Boolean).sort();
  const financialOut = {
    bills: Number(financial.bills || 0),
    bill_total: round(financial.bill_total || 0, 2),
    received: round(financial.received || 0, 2),
    outstanding: round(financial.outstanding || 0, 2),
    collection_rate: Number(financial.bill_total || 0) > 0
      ? percent(Number(financial.received || 0), Number(financial.bill_total || 0))
      : null,
  };

  const summary = {
    trades: safeRows.length,
    active_months: activeMonths,
    elapsed_months: periods.length,
    primary_unit: primaryUnit,
    primary_qty: round(primaryQty, 3),
    avg_trade_qty: safeRows.length ? round(primaryQty / safeRows.filter((row) => normalizeUnit(row.unit) === primaryUnit).length, 3) : 0,
    seller_trades: sellerTrades,
    buyer_trades: buyerTrades,
    seller_qty: round(sellerQty, 3),
    buyer_qty: round(buyerQty, 3),
    first_trade_date: dates[0] || null,
    last_trade_date: dates[dates.length - 1] || null,
  };

  const highlights = [];
  if (summary.trades > 0) {
    highlights.push(`${summary.trades} trade${summary.trades === 1 ? '' : 's'} recorded across ${summary.active_months} active month${summary.active_months === 1 ? '' : 's'}, covering ${summary.primary_qty.toLocaleString('en-IN')} ${primaryUnit} in the primary unit.`);
  }
  if (products[0]) {
    const share = products[0].share_pct == null ? '' : ` (${products[0].share_pct}% of ${primaryUnit} volume)`;
    highlights.push(`${products[0].product_name} was the leading product with ${products[0].qty.toLocaleString('en-IN')} ${products[0].unit}${share}.`);
  }
  if (counterparties[0]) {
    highlights.push(`${counterparties[0].party_name} was the most frequent ${counterparties[0].relationship.toLowerCase()} connection, appearing in ${counterparties[0].trades} trade${counterparties[0].trades === 1 ? '' : 's'}.`);
  }
  if (latest && previous) {
    if (previous.qty === 0 && latest.qty > 0) highlights.push(`Activity resumed in ${latest.period} with ${latest.qty.toLocaleString('en-IN')} ${primaryUnit}.`);
    else if (qtyChange !== 0) highlights.push(`${latest.period} volume was ${Math.abs(qtyChange).toLocaleString('en-IN')} ${primaryUnit} ${qtyChange > 0 ? 'higher' : 'lower'} than ${previous.period}${qtyChangePct == null ? '' : ` (${Math.abs(qtyChangePct)}%)`}.`);
    else highlights.push(`${latest.period} volume was unchanged from ${previous.period}.`);
  }
  if (financialOut.bill_total > 0) {
    highlights.push(`${financialOut.collection_rate}% of billed value has been received; current outstanding is Rs. ${financialOut.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
  }

  const opportunities = [];
  if (products[0]) opportunities.push({
    title: `Plan around ${products[0].product_name}`,
    text: `This is the strongest product relationship by recorded activity. Discuss upcoming requirements, preferred price bands, and delivery windows early.`,
  });
  if (counterparties[0]) opportunities.push({
    title: 'Build on repeat connections',
    text: `${counterparties[0].party_name} is the most frequent counterparty in this period. A forward plan may help preserve continuity and reduce last-minute coordination.`,
  });
  if (summary.elapsed_months > 0 && summary.active_months < Math.ceil(summary.elapsed_months / 2)) opportunities.push({
    title: 'Create a steadier trading rhythm',
    text: `Trading occurred in ${summary.active_months} of ${summary.elapsed_months} elapsed period months. Periodic requirement sharing could create more consistent opportunities.`,
  });
  if (financialOut.outstanding > 0) opportunities.push({
    title: 'Keep the account ready for the next cycle',
    text: `Review the outstanding position alongside upcoming business so both teams can plan settlements and new trades clearly.`,
  });

  return {
    summary,
    quantity_by_unit: quantityByUnit,
    monthly_activity: monthlyActivity,
    momentum: {
      current_period: latest?.period || null,
      previous_period: previous?.period || null,
      current_qty: latest?.qty ?? null,
      previous_qty: previous?.qty ?? null,
      change: qtyChange,
      change_pct: qtyChangePct,
      direction: momentumDirection,
      unit: primaryUnit,
    },
    products,
    counterparties,
    financial: financialOut,
    highlights,
    opportunities: opportunities.slice(0, 3),
  };
}

module.exports = { derivePartyInsights, monthSequence, normalizeUnit, resolveInsightPeriod };
