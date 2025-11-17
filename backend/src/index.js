require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const puppeteer = require('puppeteer');

const auth = require('./routes/auth');
const firms = require('./routes/firms');
const parties = require('./routes/parties');
const contracts = require('./routes/contracts');
const productsRouter = require('./routes/products');
const partyBills = require('./routes/party-bills');
const reports = require('./routes/reports');
const { startBillingCron } = require('./jobs/billing-cron');
const { startFyEnsureCron } = require('./jobs/fy-ensure');



const app = express();
// Tighten CORS with allowlist from env (comma separated). Defaults to local dev.
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s=>s.trim());
app.use(cors({
  origin: function(origin, cb){
    if (!origin) return cb(null, true); // allow curl/postman
    return cb(null, origins.includes(origin));
  },
  credentials: true,
}));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', auth);
app.use('/firms', firms);
app.use('/parties', parties);
app.use('/contracts', contracts);
app.use('/products', productsRouter);
app.use('/billing/party-bills', partyBills);
app.use('/party-bills', partyBills);
app.use('/reports', reports);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

// Optional: start scheduler to auto-create bills at FY end
startBillingCron();
// Ensure current FY exists and next FY appears around Mar 30/31
startFyEnsureCron();

// Optional readiness: verify Puppeteer can launch (for printing/emailing bills)
(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    await browser.close();
    console.log('Puppeteer ready');
  } catch (e) {
    console.warn('Puppeteer launch failed. PDF/email features may not work:', e.message);
  }
})();
