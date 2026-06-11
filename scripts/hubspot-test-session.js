const { chromium } = require('playwright');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();

  await page.goto('https://app-eu1.hubspot.com/workflows/147970649', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log('Huidige URL:', url);

  if (url.includes('login')) {
    console.log('RESULTAAT: Sessie verlopen');
  } else {
    console.log('RESULTAAT: Sessie geldig');
  }

  await browser.close();
})();
