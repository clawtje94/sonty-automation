const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 Check ZAP-02');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await page.screenshot({ path: path.join(__dirname, 'wf-debug-Z02-CHECK.png') });

  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log(text.substring(0, 1500));
  console.log('\nURL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
