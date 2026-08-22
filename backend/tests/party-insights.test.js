const { derivePartyInsights, monthSequence, resolveInsightPeriod } = require('../src/lib/party-insights');

const fy = {
  start_date: '2026-04-01',
  end_date: '2027-03-31',
};

describe('party insights calculations', () => {
  test('builds party activity, weighted prices, momentum, and financial summary', () => {
    const contracts = [
      {
        order_date: '2026-04-04', product_id: 1, product_name: 'D.O.R.B.', qty: 100, unit: 'M.T.', price: 40000,
        seller_id: 7, buyer_id: 8, seller_name: 'Selected Party', buyer_name: 'Buyer One',
      },
      {
        order_date: '2026-04-19', product_id: 2, product_name: 'D.O.C.', qty: 50, unit: 'M.T.', price: 35000,
        seller_id: 9, buyer_id: 7, seller_name: 'Seller One', buyer_name: 'Selected Party',
      },
      {
        order_date: '2026-06-11', product_id: 1, product_name: 'D.O.R.B.', qty: 200, unit: 'M.T.', price: 42000,
        seller_id: 7, buyer_id: 8, seller_name: 'Selected Party', buyer_name: 'Buyer One',
      },
      {
        order_date: '2026-08-02', product_id: 2, product_name: 'D.O.C.', qty: 100, unit: 'M.T.', price: 36000,
        seller_id: 7, buyer_id: 10, seller_name: 'Selected Party', buyer_name: 'Buyer Two',
      },
    ];

    const result = derivePartyInsights({
      contracts,
      partyId: 7,
      fy,
      today: new Date('2026-08-22T00:00:00Z'),
      financial: { bills: 2, bill_total: 100000, received: 75000, outstanding: 25000 },
    });

    expect(result.summary).toMatchObject({
      trades: 4,
      active_months: 3,
      elapsed_months: 5,
      primary_unit: 'M.T.',
      primary_qty: 450,
      avg_trade_qty: 112.5,
      seller_trades: 3,
      buyer_trades: 1,
      seller_qty: 400,
      buyer_qty: 50,
    });
    expect(result.monthly_activity.map((row) => row.qty)).toEqual([150, 0, 200, 0, 100]);
    expect(result.momentum).toMatchObject({
      current_period: '2026-08',
      previous_period: '2026-07',
      change: 100,
      change_pct: null,
      direction: 'up',
    });
    expect(result.products[0]).toMatchObject({
      product_name: 'D.O.R.B.',
      qty: 300,
      weighted_avg_price: 41333.33,
      min_price: 40000,
      max_price: 42000,
    });
    expect(result.counterparties[0]).toMatchObject({
      party_name: 'Buyer One',
      relationship: 'Buyer',
      trades: 2,
      qty: 300,
    });
    expect(result.financial).toMatchObject({
      bill_total: 100000,
      received: 75000,
      outstanding: 25000,
      collection_rate: 75,
    });
  });

  test('does not combine unlike units into a misleading total', () => {
    const result = derivePartyInsights({
      partyId: 7,
      fy,
      today: new Date('2026-04-30T00:00:00Z'),
      contracts: [
        { order_date: '2026-04-01', product_name: 'Meal', qty: 100, unit: 'M.T.', seller_id: 7, buyer_id: 8 },
        { order_date: '2026-04-02', product_name: 'Meal', qty: 200, unit: 'M.T.', seller_id: 7, buyer_id: 8 },
        { order_date: '2026-04-03', product_name: 'Bags', qty: 5000, unit: 'Bags', seller_id: 7, buyer_id: 9 },
      ],
    });

    expect(result.summary.primary_unit).toBe('M.T.');
    expect(result.summary.primary_qty).toBe(300);
    expect(result.quantity_by_unit).toEqual([
      { unit: 'M.T.', trades: 2, qty: 300 },
      { unit: 'Bags', trades: 1, qty: 5000 },
    ]);
    expect(result.products.find((row) => row.unit === 'Bags').share_pct).toBeNull();
  });

  test('returns every elapsed FY month, including months with no trades', () => {
    expect(monthSequence('2026-04-01', '2027-03-31', '2026-08-22')).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
  });

  test('resolves fiscal-year quarters and marks the current quarter', () => {
    expect(resolveInsightPeriod(fy, 'q2', '2026-08-22')).toEqual({
      key: 'q2',
      label: 'Q2',
      start_date: '2026-07-01',
      end_date: '2026-09-30',
      is_consolidated: false,
      is_ongoing: true,
    });
    expect(resolveInsightPeriod(fy, 'q4', '2026-08-22')).toMatchObject({
      start_date: '2027-01-01',
      end_date: '2027-03-31',
      is_ongoing: false,
    });
  });

  test('keeps consolidated reporting available for the complete FY', () => {
    expect(resolveInsightPeriod(fy, 'consolidated', '2026-08-22')).toEqual({
      key: 'consolidated',
      label: 'Consolidated FY',
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      is_consolidated: true,
      is_ongoing: true,
    });
    expect(resolveInsightPeriod(fy, 'q5', '2026-08-22')).toBeNull();
  });
});
