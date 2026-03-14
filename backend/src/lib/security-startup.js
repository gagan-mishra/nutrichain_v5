function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function isTruthy(v) {
  return /^(1|true|yes|on)$/i.test(String(v || '').trim());
}

function isWeakJwtSecret(secret) {
  const weak = new Set([
    '',
    'change_me',
    'changeme',
    'secret',
    'jwt_secret',
    'your_jwt_secret',
    'replace_me',
    'default',
  ]);
  return weak.has(String(secret || '').trim().toLowerCase());
}

function validateStartupSecurity() {
  const env = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';

  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
  }

  if (!isProd) return;

  if (jwtSecret.length < 32 || isWeakJwtSecret(jwtSecret)) {
    throw new Error('In production, JWT_SECRET must be strong and at least 32 characters');
  }

  const origins = parseCsv(process.env.CORS_ORIGINS);
  if (!origins.length) {
    throw new Error('In production, CORS_ORIGINS must be set with exact allowed HTTPS origins');
  }
  if (origins.includes('*')) {
    throw new Error('In production, CORS_ORIGINS cannot include wildcard (*)');
  }
  const invalidOrigins = origins.filter((o) => !o.startsWith('https://'));
  if (invalidOrigins.length) {
    throw new Error(`In production, every CORS origin must use https://. Invalid: ${invalidOrigins.join(', ')}`);
  }

  if (isTruthy(process.env.ENABLE_SEED_ADMIN)) {
    throw new Error('ENABLE_SEED_ADMIN must be false in production');
  }

  const provider = String(process.env.MAIL_PROVIDER || '').toLowerCase();
  if (provider !== 'gmail_api') {
    throw new Error("In production, MAIL_PROVIDER must be 'gmail_api'");
  }

  const requiredMail = ['MAIL_FROM', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
  const missingMail = requiredMail.filter((k) => !String(process.env[k] || '').trim());
  if (missingMail.length) {
    throw new Error(`Missing required Gmail API vars in production: ${missingMail.join(', ')}`);
  }

  const legacyMailVars = [
    'RESEND_API_KEY',
    'SMTP_SERVICE',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
  ];
  const presentLegacy = legacyMailVars.filter((k) => String(process.env[k] || '').trim());
  if (presentLegacy.length) {
    throw new Error(`Remove legacy mail vars in production: ${presentLegacy.join(', ')}`);
  }
}

module.exports = { validateStartupSecurity };
