const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

jest.mock('../src/lib/db', () => ({
  pool: { execute: jest.fn() },
}));

const { pool } = require('../src/lib/db');
const app = require('../src/app');

describe('sales report firm scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('aggregates each contract once across all accessible firms', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ c: 0 }]])
      .mockResolvedValueOnce([[
        { id: 1, name: 'Firm One' },
        { id: 2, name: 'Firm Two' },
      ]])
      .mockResolvedValueOnce([[
        { period: '2026-07', trades: 4, firms: 2, total_qty: 375, avg_price: 41250 },
      ]]);

    const token = jwt.sign({ id: 1, username: 'admin', firmId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const response = await request(app)
      .get('/reports/sales?group=month&scope=all_firms&product_id=9')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Fy-Id', '3');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{
      period: '2026-07',
      trades: 4,
      firms: 2,
      total_qty: 375,
      avg_price: 41250,
    }]);
    expect(pool.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('c.firm_id IN (?,?)'),
      [1, 2, 3, 9],
    );
    expect(pool.execute.mock.calls[2][0]).toContain('COUNT(*) AS trades');
  });

  test('returns a visible quantity total for every accessible firm', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ c: 0 }]])
      .mockResolvedValueOnce([[
        { id: 1, name: 'Firm One' },
        { id: 2, name: 'Firm Two' },
        { id: 3, name: 'Firm Three' },
      ]])
      .mockResolvedValueOnce([[
        { firm_id: 1, trades: 3, total_qty: 250 },
        { firm_id: 2, trades: 2, total_qty: 125 },
      ]]);

    const token = jwt.sign({ id: 1, username: 'admin', firmId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const response = await request(app)
      .get('/reports/sales/firm-totals?product_id=9')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Fy-Id', '3');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { firm_id: 1, firm_name: 'Firm One', trades: 3, total_qty: 250 },
      { firm_id: 2, firm_name: 'Firm Two', trades: 2, total_qty: 125 },
      { firm_id: 3, firm_name: 'Firm Three', trades: 0, total_qty: 0 },
    ]);
    expect(pool.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('GROUP BY c.firm_id'),
      [1, 2, 3, 3, 9],
    );
  });
});
