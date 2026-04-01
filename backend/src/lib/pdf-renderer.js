const puppeteer = require('puppeteer');

const LAUNCH_OPTIONS = {
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
};

let browserPromise = null;
let renderQueue = Promise.resolve();

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch(LAUNCH_OPTIONS);
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }

  const browser = await browserPromise;
  if (!browser.__nutrichainPdfHooked) {
    browser.__nutrichainPdfHooked = true;
    browser.on('disconnected', () => {
      browserPromise = null;
    });
  }
  return browser;
}

function enqueueRender(task) {
  const run = async () => task();
  const next = renderQueue.then(run, run);
  renderQueue = next.catch(() => {});
  return next;
}

async function renderPdfFromHtml(html, options = {}) {
  if (!html || typeof html !== 'string') {
    throw new Error('renderPdfFromHtml requires HTML string');
  }

  return enqueueRender(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      return await page.pdf(options);
    } finally {
      await page.close().catch(() => {});
    }
  });
}

async function checkPdfEngineReady() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.close().catch(() => {});
}

async function closePdfBrowser() {
  if (!browserPromise) return;
  let browser = null;
  try {
    browser = await browserPromise;
  } catch (_) {
    browser = null;
  } finally {
    browserPromise = null;
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  renderPdfFromHtml,
  checkPdfEngineReady,
  closePdfBrowser,
};

