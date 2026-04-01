require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const auth = require('./routes/auth');
const firms = require('./routes/firms');
const parties = require('./routes/parties');
const contracts = require('./routes/contracts');
const productsRouter = require('./routes/products');
const partyBills = require('./routes/party-bills');
const partyLedger = require('./routes/party-ledger');
const reports = require('./routes/reports');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

const defaultOrigins = isProd ? '' : 'http://localhost:5173,http://127.0.0.1:5173';
const origins = (process.env.CORS_ORIGINS || defaultOrigins)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, cb) {
    // In production, do not auto-allow origin-less browser CORS requests.
    if (!origin) return cb(null, !isProd);
    return cb(null, origins.includes(origin));
  },
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));

if (isProd) {
  app.use((req, res, next) => {
    const proto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (req.secure || proto === 'https') return next();
    return res.status(400).json({ error: 'HTTPS required' });
  });
}

app.use('/auth', auth);
app.use('/firms', firms);
app.use('/parties', parties);
app.use('/contracts', contracts);
app.use('/products', productsRouter);
app.use('/billing/party-bills', partyBills);
app.use('/party-bills', partyBills);
app.use('/billing/party-ledger', partyLedger);
app.use('/reports', reports);

module.exports = app;
