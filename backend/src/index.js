const app = require('./app');
const { startBillingCron } = require('./jobs/billing-cron');
const { startFyEnsureCron } = require('./jobs/fy-ensure');
const { validateStartupSecurity } = require('./lib/security-startup');
const { checkPdfEngineReady, closePdfBrowser } = require('./lib/pdf-renderer');

validateStartupSecurity();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

// Optional: start scheduler to auto-create bills at FY end
startBillingCron();
// Ensure current FY exists and next FY appears from Mar 26 onward
startFyEnsureCron();

// Optional readiness: verify Puppeteer can launch (for printing/emailing bills)
(async () => {
  try {
    await checkPdfEngineReady();
    console.log('Puppeteer ready');
  } catch (e) {
    console.warn('Puppeteer launch failed. PDF/email features may not work:', e.message);
  }
})();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, async () => {
    try {
      await closePdfBrowser();
    } finally {
      process.exit(0);
    }
  });
}
