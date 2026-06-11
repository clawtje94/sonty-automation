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
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-02 bouwen via Copilot: HubSpot → Trengo WhatsApp');

  // Maak nieuwe zap
  await page.goto('https://zapier.com/webintent/create-zap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Gebruik Copilot
  const copilotInput = page.locator('textarea').first();
  if (await copilotInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    const desc = 'When a HubSpot deal stage changes to "Prijsindicatie Verstuurd" in the "Sonty Verkooppijplijn" pipeline, send a WhatsApp message via Trengo to the contact. Then update the HubSpot deal stage to "WhatsApp Verstuurd". Name this zap "ZAP-02: WhatsApp Follow-up via Trengo"';
    await copilotInput.fill(desc);
    await page.waitForTimeout(500);

    const startBtn = page.locator('button').filter({ hasText: /Start building/i }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('  Copilot instructie verstuurd');

    // Wacht op build
    await page.waitForTimeout(40000);
    await ss(page, 'Z02-01-copilot');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Status:', text.substring(0, 800));

    // Wacht meer als bezig
    if (text.includes('Thought') || text.includes('Loading') || text.includes('building')) {
      await page.waitForTimeout(30000);
      await ss(page, 'Z02-02-wait');
    }
  }

  await ss(page, 'Z02-03-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
