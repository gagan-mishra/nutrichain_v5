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
});
