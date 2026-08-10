const path = require('path');

module.exports = {
  // Keep Chrome inside the deployed app instead of Railway's transient home cache.
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
};
