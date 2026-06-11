const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 Zapier overzicht + cleanup');

  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await ss(page, 'CLEANUP-01-list');

  const listText = await page.evaluate(() => document.body.innerText.substring(0, 6000));
  console.log('Zaps list:\n', listText.substring(0, 3000));

  // Find all zap entries with their details
  const zaps = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr, [class*="zap-row"], [class*="ZapRow"], a[href*="/editor/"]');
    const result = [];
    for (const row of rows) {
      const text = row.textContent?.trim() || '';
      const href = row.getAttribute('href') || row.querySelector('a[href*="/editor/"]')?.href || '';
      if (text.length > 5 && text.length < 300) {
        result.push({ text: text.substring(0, 150), href: href.substring(0, 80) });
      }
    }
    return result;
  });
  console.log('\nZap entries:', JSON.stringify(zaps.slice(0, 15), null, 2));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
