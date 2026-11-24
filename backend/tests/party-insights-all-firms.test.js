jest.mock('../src/lib/db', () => ({ pool: { execute: jest.fn() } }));
const { pool } = require('../src/lib/db');
const { buildPartyInsightsPayload } = require('../src/routes/party-insights');
const { buildPartyInsightsPrintHtml } = require('../src/lib/party-insights-template');

const options = { userId: 9, fyId: 3, partyId: 7, today: '2025-07-12' };
const from = '2025-04-01';
const fy = { id: 3, label: '2025-26', start_date: from, end_date: '2026-03-31' };
const party = { id: 7, name: 'Sample Party' };

test.each([['q1', '2025-06-30'], ['consolidated', fy.end_date]])(
  '%s combines trades and bill balances only for the permitted firms',
  async (periodKey, end) => {
    pool.execute.mockImplementation(async (sql, params) => {
      if (sql.includes('COUNT(*) AS c FROM user_firms')) {
        expect(params).toEqual([9]);
        return [[{ c: 2 }]];
      }
      if (sql.includes('JOIN user_firms')) {
        expect(params).toEqual([9]);
        return [[{ id: 1, name: 'First Firm' }, { id: 2, name: 'Second Firm' }]];
      }
      if (sql.includes('FROM parties WHERE')) return [[party]];
      if (sql.includes('FROM fiscal_years')) return [[fy]];
      if (sql.includes('product.name AS product_name')) {
        expect(sql).toContain('c.firm_id IN (?,?)');
        expect(params).toEqual([1, 2, 3, 7, 7, from, end]);
        return [[1, 2].map((i) => ({ contract_no: 1, product_id: 5, unit: 'MT', order_date: from,
          qty: i * 10, price: i * 30, seller_id: 7, buyer_id: 8 }))];
      }
      if (sql.includes('FROM party_bills pb')) {
        expect(sql).toContain('pb.firm_id IN (?,?)');
        expect(params).toEqual([1, 2, 7, from, end, 3]);
        return [[1, 2].map((i) => ({ id: i + 100, firm_id: i, bill_no: '1', from_date: from,
          to_date: end, brokerage: 10, firm_gst: i === 2 ? 'GST' : null, gst_type: 'INTER', igst_rate: 18 }))];
      }
      if (sql.includes('FROM contracts c')) {
        expect(sql).toContain('c.firm_id = ?');
        expect(params.slice(1)).toEqual([from, end, 7, 7]);
        return [[{ seller_id: 7, max_qty: params[0] * 10 }]];
      }
      if (sql.includes('FROM party_bill_receipts r')) {
        expect(sql).toContain('pb.firm_id = r.firm_id');
        expect(sql).toContain('r.receive_date <= ?');
        expect(params).toEqual([101, 102, options.today]);
        return [[{ party_bill_id: 101, received: 25 }, { party_bill_id: 102, received: 101 }]];
      }
      throw new Error('Unexpected SQL: ' + sql);
    });

    const report = await buildPartyInsightsPayload({ ...options, periodKey });
    expect(report.summary).toMatchObject({ trades: 2, primary_qty: 30, active_months: 1 });
    expect(report.products[0].weighted_avg_price).toBe(50);
    expect(report.financial).toEqual({ bills: 2, bill_total: 336, received: 126, outstanding: 210, collection_rate: 37.5 });
    expect(report.meta.scope).toBe('all_firms');
    expect(report.meta).not.toHaveProperty('firm');
    const html = buildPartyInsightsPrintHtml({ ...report, meta: { ...report.meta, firm: { name: 'First Firm' } } });
    expect(html).toContain('Prepared for Sample Party');
    expect(html).toContain(report.meta.period.label);
    expect(html).not.toContain('First Firm');
  }
);
