const app = require('./app');
const puppeteer = require('puppeteer');
const { startBillingCron } = require('./jobs/billing-cron');
const { startFyEnsureCron } = require('./jobs/fy-ensure');

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
