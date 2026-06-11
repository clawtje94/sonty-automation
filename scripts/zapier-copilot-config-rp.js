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
  console.log('🎬 ZAP-01 Copilot configureer Reuzenpanda trigger');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Open Copilot chat bubble
  await page.mouse.click(1224, 668);
  await page.waitForTimeout(3000);

  const chatArea = page.locator('textarea').first();
  if (await chatArea.isVisible({ timeout: 10000 }).catch(() => false)) {
    await chatArea.click();
    const msg = `Please configure step 1 (Reuzenpanda trigger "Lead Created"):
- Select Profile: "Sonty B.V." (ID: 731483fa-ef6b-4aae-afcf-883ec09219dd)
- Then select the first available Board
- Then select the first available Backlog
- Set "Also trigger when manually created" to True
Please use the exact IDs when configuring.`;

    await chatArea.fill(msg);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('  Copilot instructie verstuurd');

    // Wait for Copilot
    await page.waitForTimeout(40000);
    await ss(page, 'Z01-COP-01-working');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 4000));
    console.log('Na copilot:', text.substring(0, 1000));

    // Wait more if needed
    if (text.includes('Working') || text.includes('being called') || text.includes('Thought')) {
      console.log('  Nog bezig...');
      await page.waitForTimeout(30000);
      await ss(page, 'Z01-COP-02-more');

      const text2 = await page.evaluate(() => document.body.innerText.substring(0, 4000));
      if (text2.includes('Working') || text2.includes('being called')) {
        await page.waitForTimeout(30000);
      }
    }
  } else {
    console.log('  Chat niet gevonden, probeer Copilot paneel');
    // Click on the Copilot toggle at bottom left
    const copilotToggle = page.locator('[aria-label*="Copilot"]').first();
    if (await copilotToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await copilotToggle.click();
      await page.waitForTimeout(2000);
    }
  }

  await ss(page, 'Z01-COP-03-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 4000));
  console.log('\nFinal:', finalText.substring(0, 1200));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
