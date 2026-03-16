process.env.NODE_ENV = 'test';

const { allocateNextBillNo } = require('../src/lib/bill-number-sequence');

describe('bill number sequence allocator', () => {
  test('throws if firm or fiscal year are missing', async () => {
    const conn = { execute: jest.fn() };

    await expect(allocateNextBillNo(conn, null, 2)).rejects.toThrow(
      'firm_id and fiscal_year_id are required for bill number allocation'
    );
    await expect(allocateNextBillNo(conn, 1, null)).rejects.toThrow(
      'firm_id and fiscal_year_id are required for bill number allocation'
    );

    expect(conn.execute).not.toHaveBeenCalled();
  });

  test('allocates current next_no and increments it', async () => {
    const conn = {
      execute: jest
        .fn()
        .mockResolvedValueOnce([{}]) // ensure row exists
        .mockResolvedValueOnce([[{ next_no: 12 }]]) // lock and read next_no
        .mockResolvedValueOnce([{}]), // increment
    };

    const billNo = await allocateNextBillNo(conn, 9, 3);

    expect(billNo).toBe('12');
    expect(conn.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO party_bill_sequences'),
      [9, 3]
    );
    expect(conn.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SELECT next_no'),
      [9, 3]
    );
    expect(conn.execute).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE party_bill_sequences'),
      [13, 9, 3]
    );
  });

  test('starts from 1 when sequence row has no readable value', async () => {
    const conn = {
      execute: jest
        .fn()
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{}]),
    };

    const billNo = await allocateNextBillNo(conn, 5, 8);

    expect(billNo).toBe('1');
    expect(conn.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE party_bill_sequences'),
      [2, 5, 8]
    );
  });
});
