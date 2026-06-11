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
  console.log('🎬 ZAP-01 afmaken');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Klik "Skip test" als die zichtbaar is
  const skipTest = page.locator('button').filter({ hasText: /Skip test/i }).first();
  if (await skipTest.isVisible().catch(() => false)) {
    await skipTest.click();
    console.log('  Skip test geklikt');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'FIN01-01');

  // Stuur Copilot bericht om de pipeline/stage in te vullen en zap te hernoemen
  const chatArea = page.locator('textarea').first();
  if (await chatArea.isVisible().catch(() => false)) {
    await chatArea.click();
    await chatArea.fill('Please configure step 3 Create Deal: set Deal Pipeline to "Sonty Verkooppijplijn" and Deal Stage to "Nieuwe Lead". Map the Name field to the lead name from step 1. Then rename this zap to "ZAP-01: Reuzenpanda Lead Intake"');
    await page.waitForTimeout(500);

    // Send
    await page.keyboard.press('Enter');
    console.log('  Copilot instructie verstuurd');

    await page.waitForTimeout(40000);
    await ss(page, 'FIN01-02-copilot');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Na copilot:', text.substring(0, 800));

    // Wacht meer als bezig
    if (text.includes('Loading') || text.includes('Working') || text.includes('Thought')) {
      await page.waitForTimeout(20000);
    }
  }

  await ss(page, 'FIN01-03-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
