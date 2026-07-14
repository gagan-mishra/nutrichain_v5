const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

jest.mock('../src/lib/db', () => ({
  pool: { execute: jest.fn() },
}));

const { pool } = require('../src/lib/db');
const app = require('../src/app');

describe('all-firms party billing report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('aggregates billed, received, and outstanding by party and firm', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ c: 0 }]])
      .mockResolvedValueOnce([[
        { id: 1, name: 'Firm One' },
        { id: 2, name: 'Firm Two' },
      ]])
      .mockResolvedValueOnce([[
        { id: 10, firm_id: 1, party_id: 7, party_name: 'Party A', from_date: '2025-04-01', to_date: '2026-03-31', brokerage: 40 },
        { id: 11, firm_id: 2, party_id: 7, party_name: 'Party A', from_date: '2025-04-01', to_date: '2026-03-31', brokerage: 40 },
      ]])
      .mockResolvedValueOnce([[
        { party_bill_id: 10, received: 150, receipt_count: 1 },
        { party_bill_id: 11, received: 50, receipt_count: 2 },
      ]])
      .mockResolvedValueOnce([[
        { seller_id: 7, buyer_id: 8, max_qty: 10, seller_brokerage: 40, buyer_brokerage: 40 },
      ]])
      .mockResolvedValueOnce([[{ gst_type: 'INTRA', cgst_rate: 0, sgst_rate: 0, igst_rate: 0 }]])
      .mockResolvedValueOnce([[{ gst_no: null }]])
      .mockResolvedValueOnce([[
        { seller_id: 7, buyer_id: 9, max_qty: 5, seller_brokerage: 40, buyer_brokerage: 40 },
      ]])
      .mockResolvedValueOnce([[{ gst_type: 'INTRA', cgst_rate: 0, sgst_rate: 0, igst_rate: 0 }]])
      .mockResolvedValueOnce([[{ gst_no: null }]]);

    const token = jwt.sign({ id: 1, username: 'admin', firmId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const response = await request(app)
      .get('/reports/party-bills-all-firms?fy_id=3')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      grand_total: 600,
      grand_received: 200,
      grand_outstanding: 400,
      bill_count: 2,
      receipt_count: 3,
      party_count: 1,
    });
    expect(response.body.rows[0]).toMatchObject({
      party_id: 7,
      total: 600,
      received: 200,
      outstanding: 400,
      firm_totals: { 1: 400, 2: 200 },
      firm_received: { 1: 150, 2: 50 },
      firm_outstanding: { 1: 250, 2: 150 },
    });
    expect(response.body.firms).toEqual([
      { id: 1, name: 'Firm One', total: 400, received: 150, outstanding: 250 },
      { id: 2, name: 'Firm Two', total: 200, received: 50, outstanding: 150 },
    ]);
  });
});
