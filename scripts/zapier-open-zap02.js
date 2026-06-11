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
  console.log('🎬 ZAP-02 openen en bekijken');

  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Click on the second "Untitled Zap" (55 min ago, HubSpot + Trengo)
  const untitledZaps = page.locator('text=Untitled Zap');
  const count = await untitledZaps.count();
  console.log(`${count} Untitled Zaps gevonden`);

  // Click the first Untitled Zap (which should be ZAP-02 since ZAP-01 is named now)
  if (count > 0) {
    await untitledZaps.first().click();
    await page.waitForTimeout(10000);
    await ss(page, 'Z02-OPEN-01-loaded');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Page:', text.substring(0, 1000));
    console.log('URL:', page.url());
  }

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
