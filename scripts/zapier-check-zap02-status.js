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
  console.log('🎬 ZAP-02 status check');

  // First check the zaps list to find ZAP-02
  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await ss(page, 'Z02-CHK-01-list');

  const listText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  console.log('Zaps list:', listText.substring(0, 1500));

  // Look for the ZAP-02 draft or any Untitled zap
  // From the earlier screenshot, ZAP-02 was an "Untitled Zap" with HubSpot + Trengo
  // Let's find all draft zaps
  const zaps = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/editor/"]');
    return Array.from(links).map(l => ({
      text: l.textContent.trim().substring(0, 80),
      href: l.href
    })).filter(l => l.text.length > 0);
  });
  console.log('Zap links:', JSON.stringify(zaps.slice(0, 10)));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
