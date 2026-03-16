process.env.NODE_ENV = 'test';

jest.mock('../src/lib/db', () => ({
  pool: { execute: jest.fn() },
}));

const { pool } = require('../src/lib/db');
const { ensureFiscalYears } = require('../src/jobs/fy-ensure');

function mockFiscalYearDb() {
  const existingLabels = new Set();
  const inserted = [];

  pool.execute.mockImplementation(async (sql, params) => {
    if (String(sql).includes('SELECT id FROM fiscal_years')) {
      const label = params[0];
      if (existingLabels.has(label)) return [[{ id: 1 }]];
      return [[]];
    }

    if (String(sql).includes('INSERT INTO fiscal_years')) {
      const [label, start, end] = params;
      existingLabels.add(label);
      inserted.push({ label, start, end });
      return [{ insertId: inserted.length }];
    }

    throw new Error(`Unexpected query in test: ${sql}`);
  });

  return { existingLabels, inserted };
}

describe('FY ensure scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('before March 26, ensures only current FY', async () => {
    const { inserted } = mockFiscalYearDb();

    await ensureFiscalYears(new Date(2026, 2, 25)); // Mar 25, 2026

    expect(inserted.map((x) => x.label)).toEqual(['2025-26']);
  });

  test('on March 26, ensures current and next FY', async () => {
    const { inserted } = mockFiscalYearDb();

    await ensureFiscalYears(new Date(2026, 2, 26)); // Mar 26, 2026

    expect(inserted.map((x) => x.label)).toEqual(['2025-26', '2026-27']);
  });

  test('if rows already exist, does not insert duplicates', async () => {
    const { existingLabels, inserted } = mockFiscalYearDb();
    existingLabels.add('2025-26');
    existingLabels.add('2026-27');

    await ensureFiscalYears(new Date(2026, 2, 27)); // Mar 27, 2026

    expect(inserted).toHaveLength(0);
  });
});
