const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Zapier Dashboard Verkennen');

  // 1. Dashboard
  await page.goto('https://zapier.com/app/home', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'ZAP-01-home');

  const homeText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nDashboard:', homeText.substring(0, 500));

  // 2. Check bestaande zaps
  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'ZAP-02-zaps');

  const zapsText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nZaps pagina:', zapsText.substring(0, 500));

  // 3. Check connected apps
  await page.goto('https://zapier.com/app/connections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'ZAP-03-connections');

  const connText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nConnections:', connText.substring(0, 800));

  // 4. Check account/plan
  await page.goto('https://zapier.com/app/settings/billing', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'ZAP-04-billing');

  const billText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nBilling:', billText.substring(0, 500));

  // Sla bijgewerkte sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState));

  await context.close();
  await browser.close();
})();
