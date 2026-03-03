const { add, has } = require('../src/lib/token-blacklist');

describe('token-blacklist', () => {
  test('has() returns false for unknown jti', () => {
    expect(has('nonexistent-jti')).toBe(false);
  });

  test('add() + has() tracks a blacklisted token', () => {
    const decoded = { jti: 'test-jti-1', exp: Math.floor(Date.now() / 1000) + 3600 };
    add(decoded);
    expect(has('test-jti-1')).toBe(true);
  });

  test('add() ignores decoded without jti', () => {
    add({});
    add(null);
    add(undefined);
    // should not throw
  });
});
