require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

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
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
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
