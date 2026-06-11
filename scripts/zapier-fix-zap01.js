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
  console.log('🎬 ZAP-01 Copilot corrigeren');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await ss(page, 'FIX01-01');

  // Check huidige status
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Status:', text.substring(0, 800));

  // Stuur een correctie via Copilot chat
  const chatInput = page.locator('textarea[placeholder*="Chat"], textarea, [contenteditable="true"]').first();
  if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    const msg = 'Step 3 uses "Create Deal Deprecated". Please replace it with the current "Create Deal" action for HubSpot. Also set the deal pipeline to "Sonty Verkooppijplijn" (ID: 3623322812) and the deal stage to "Nieuwe Lead" (ID: 4998659267). Map the contact from step 2 as the deal association. Then rename this zap to "ZAP-01: Reuzenpanda Lead → HubSpot"';
    await chatInput.fill(msg);
    await page.waitForTimeout(500);

    // Send
    const sendBtn = page.locator('button[type="submit"]').first()
      .or(page.locator('button').filter({ hasText: /send/i }).first());
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('  Correctie verstuurd');

    // Wacht op Copilot
    await page.waitForTimeout(30000);
    await ss(page, 'FIX01-02-copilot');

    const text2 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Na correctie:', text2.substring(0, 800));
  } else {
    console.log('  Chat input niet gevonden');
  }

  await ss(page, 'FIX01-03-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
