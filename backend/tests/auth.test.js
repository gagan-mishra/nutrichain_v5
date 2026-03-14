const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Set test env before requiring app
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

// Mock the DB pool
jest.mock('../src/lib/db', () => ({
  pool: { execute: jest.fn() },
}));

const { pool } = require('../src/lib/db');
const app = require('../src/app');

describe('Auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    test('returns 400 for invalid credentials (user not found)', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'unknown', password: 'pass' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('returns 400 for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      pool.execute.mockResolvedValueOnce([[{ id: 1, username: 'admin', password_hash: hash, firm_id: 1 }]]);

      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'wrong' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('returns user info and sets httpOnly cookie on success', async () => {
      const hash = await bcrypt.hash('correct', 10);
      pool.execute.mockResolvedValueOnce([[{ id: 1, username: 'admin', password_hash: hash, firm_id: 1 }]]);

      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'correct' });

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: 1, username: 'admin', firmId: 1 });
      // Token should NOT be in response body
      expect(res.body.token).toBeUndefined();
      // httpOnly cookie should be set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('token=') && c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('GET /auth/me', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    test('returns user info with valid cookie', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: 1, username: 'admin', firmId: 1 });
    });

    test('returns user info with valid Bearer token', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-2' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: 1, username: 'admin', firmId: 1 });
    });
  });

  describe('POST /auth/logout', () => {
    test('clears cookie and blacklists token', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-logout' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/logout')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Token should be cleared (set-cookie with expires in past or empty value)
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // After logout, using the same token should return 401
      const res2 = await request(app)
        .get('/auth/me')
        .set('Cookie', `token=${token}`);
      expect(res2.status).toBe(401);
    });
  });

  describe('POST /auth/change-password', () => {
    test('returns 400 if currentPassword or newPassword missing', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-cp1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword: 'old' });

      expect(res.status).toBe(400);
    });

    test('returns 400 if current password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      pool.execute.mockResolvedValueOnce([[{ id: 1, password_hash: hash }]]);

      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-cp2' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword: 'wrong', newPassword: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Current password is incorrect');
    });

    test('returns 400 if new password is too short', async () => {
      const hash = await bcrypt.hash('correct', 10);
      pool.execute.mockResolvedValueOnce([[{ id: 1, password_hash: hash }]]);

      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-cp3' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword: 'correct', newPassword: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 8 characters');
    });

    test('succeeds with valid credentials', async () => {
      const hash = await bcrypt.hash('correct', 10);
      pool.execute
        .mockResolvedValueOnce([[{ id: 1, password_hash: hash }]])  // SELECT user
        .mockResolvedValueOnce([{ affectedRows: 1 }]);              // UPDATE password

      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-cp4' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', `token=${token}`)
        .send({ currentPassword: 'correct', newPassword: 'newpassword123' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('POST /auth/switch-firm', () => {
    test('returns 400 without firmId', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-sf1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/switch-firm')
        .set('Cookie', `token=${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test('returns 403 if user not allowed for firm', async () => {
      pool.execute
        .mockResolvedValueOnce([[{ c: 1 }]])   // user has user_firms entries
        .mockResolvedValueOnce([[]]);           // but not for target firm

      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-sf2' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/switch-firm')
        .set('Cookie', `token=${token}`)
        .send({ firmId: 99 });

      expect(res.status).toBe(403);
    });

    test('switches firm and sets new cookie', async () => {
      pool.execute
        .mockResolvedValueOnce([[{ c: 0 }]])       // no user_firms = allow all
        .mockResolvedValueOnce([[{ id: 2 }]]);      // firm exists

      const token = jwt.sign({ id: 1, username: 'admin', firmId: 1, jti: 'jti-sf3' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/auth/switch-firm')
        .set('Cookie', `token=${token}`)
        .send({ firmId: 2 });

      expect(res.status).toBe(200);
      expect(res.body.user.firmId).toBe(2);
      // New cookie should be set
      const cookies = res.headers['set-cookie'];
      expect(cookies.some(c => c.startsWith('token=') && c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('POST /auth/seed-admin', () => {
    test('returns 404 when ENABLE_SEED_ADMIN is disabled', async () => {
      delete process.env.ENABLE_SEED_ADMIN;
      const res = await request(app)
        .post('/auth/seed-admin')
        .send({ username: 'admin', password: 'secret123', firmId: 1 });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /health', () => {
    test('returns ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
