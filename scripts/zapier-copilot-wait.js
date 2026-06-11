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
  page.setDefaultTimeout(60000);
  console.log('🎬 Zapier — Check laatste zap status en ga door');

  // Ga naar de zaps lijst
  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Dismiss cookies
  const cookieBtn = page.locator('button').filter({ hasText: /accept all/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  await ss(page, 'ZWAIT-01-zaps-list');

  // Dump alle zaps
  const zapsText = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr, [class*="row"], [class*="zap"]');
    return Array.from(rows).map(r => r.innerText?.trim()).filter(t => t && t.length > 5).join('\n---\n');
  });
  console.log('Zaps:\n', zapsText.substring(0, 1500));

  // Klik op de eerste/nieuwste "Untitled Zap" — die is van de copilot
  const untitledZap = page.locator('a, button, tr, div').filter({ hasText: /untitled zap/i }).first();
  if (await untitledZap.isVisible().catch(() => false)) {
    await untitledZap.click();
    await page.waitForTimeout(8000);
    console.log('  Untitled Zap geopend');
    await ss(page, 'ZWAIT-02-zap-opened');

    // Dump de zap inhoud
    const zapText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Zap inhoud:', zapText.substring(0, 800));

    // Check of copilot klaar is
    const isWorking = zapText.includes('Working on it') || zapText.includes('being called');
    if (isWorking) {
      console.log('  Copilot is nog bezig — wacht 30 sec');
      await page.waitForTimeout(30000);
      await ss(page, 'ZWAIT-03-after-wait');
      const zapText2 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('Na wachten:', zapText2.substring(0, 800));
    }

    // Dump alle stappen
    const steps = await page.locator('[class*="step"], [data-testid*="step"]').all();
    console.log(`\nStappen: ${steps.length}`);
    for (const step of steps) {
      const t = await step.innerText().catch(() => '');
      if (t.trim()) console.log(`  Step: "${t.trim().substring(0, 80)}"`);
    }
  } else {
    console.log('  Geen Untitled Zap gevonden');
    // Zoek naar alle zap namen
    const links = await page.locator('a:visible').all();
    for (const link of links.slice(0, 15)) {
      const t = await link.innerText().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');
      if (t.trim() && href?.includes('/editor')) {
        console.log(`  Zap: "${t.trim()}" → ${href}`);
      }
    }
  }

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
