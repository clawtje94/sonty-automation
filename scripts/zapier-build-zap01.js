const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-01 bouwen: Reuzenpanda → HubSpot');

  // Maak een nieuwe zap
  await page.goto('https://zapier.com/webintent/create-zap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await ss(page, 'Z01-01-new');

  console.log('URL:', page.url());
  const text1 = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log('Page:', text1.substring(0, 400));

  // Zoek de trigger stap en zoek naar app selectie
  // In de editor verschijnt er meestal een trigger card met "1." of een search
  const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"]').first();
  if (await searchInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    await searchInput.fill('Reuzenpanda');
    await page.waitForTimeout(3000);
    console.log('  "Reuzenpanda" gezocht');
    await ss(page, 'Z01-02-search');

    const rpOption = page.locator('[role="option"], li, button, a').filter({ hasText: /Reuzenpanda/i }).first();
    if (await rpOption.isVisible().catch(() => false)) {
      await rpOption.click();
      console.log('  ✅ Reuzenpanda geselecteerd');
      await page.waitForTimeout(5000);
    }
  } else {
    // Probeer de trigger card te klikken
    console.log('  Geen zoekbalk — probeer trigger card');
    const triggerCard = page.getByText('Trigger').first()
      .or(page.locator('[class*="trigger"]').first());
    if (await triggerCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await triggerCard.click();
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'Z01-03-after-select');
  const text2 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Status:', text2.substring(0, 600));

  // Dump buttons
  const btns = await page.locator('button:visible').all();
  for (const btn of btns.slice(0, 20)) {
    const t = await btn.innerText().catch(() => '');
    if (t.trim() && t.trim().length < 60) console.log(`  btn: "${t.trim()}"`);
  }

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
