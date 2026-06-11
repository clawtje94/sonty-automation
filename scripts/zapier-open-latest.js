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
  console.log('🎬 Open nieuwste zap');

  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Dismiss cookies
  const cookieBtn = page.locator('button').filter({ hasText: /accept all/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Klik op de eerste "Untitled Zap" link — de nieuwste
  const firstZapLink = page.locator('a').filter({ hasText: /Untitled Zap/ }).first();
  if (await firstZapLink.isVisible().catch(() => false)) {
    const href = await firstZapLink.getAttribute('href').catch(() => '');
    console.log('  Zap link:', href);
    await firstZapLink.click();
    await page.waitForTimeout(8000);
  } else {
    // Dubbelklik op de rij
    const firstRow = page.locator('tr, [class*="row"]').filter({ hasText: /Untitled Zap/ }).first();
    await firstRow.dblclick();
    await page.waitForTimeout(8000);
  }

  await ss(page, 'ZOPEN-01-zap');
  const url = page.url();
  console.log('URL:', url);

  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Inhoud:', text.substring(0, 1000));

  // Check of we in de editor zijn
  if (url.includes('/editor')) {
    console.log('  ✅ In de editor!');

    // Check de stappen
    // Zoek trigger en action elementen
    const triggerInfo = await page.evaluate(() => {
      const steps = document.querySelectorAll('[class*="node"], [class*="step"], [data-testid*="step"]');
      return Array.from(steps).map(s => s.innerText?.substring(0, 100)).join('\n');
    });
    console.log('\nStappen:', triggerInfo);

    // Klik op de trigger stap om details te zien
    const triggerNode = page.locator('[data-testid*="trigger"], [class*="trigger"]').first()
      .or(page.getByText('Trigger').first());
    if (await triggerNode.isVisible().catch(() => false)) {
      await triggerNode.click();
      await page.waitForTimeout(3000);
      await ss(page, 'ZOPEN-02-trigger-details');

      const triggerText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      console.log('\nTrigger details:', triggerText.substring(0, 500));
    }
  }

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
