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
  console.log('🎬 ZAP-02 Step 1 skip + Step 2 Trengo');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open step 1 and skip test
  await page.mouse.dblclick(660, 275);
  await page.waitForTimeout(5000);

  const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
    console.log('  Step 1 test geskipt');
    await page.waitForTimeout(3000);
  }

  // Open step 2 (Trengo)
  console.log('\n--- Step 2: Trengo ---');
  await page.mouse.dblclick(660, 465);
  await page.waitForTimeout(5000);
  await ss(page, 'Z02-S2-01-trengo');

  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Step 2:', text.substring(0, 800));

  // Check if Trengo needs to be connected first
  if (text.includes('Sign in') || text.includes('Connect') || text.includes('Account')) {
    console.log('  Trengo moet nog verbonden worden');
    await ss(page, 'Z02-S2-02-needs-connect');
  }

  // Check for Configure tab
  if (text.includes('Configure')) {
    const configTab = page.locator('text=Configure').first();
    if (await configTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await configTab.click();
      await page.waitForTimeout(3000);
      await ss(page, 'Z02-S2-03-configure');

      const configText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('Configure tab:', configText.substring(0, 800));
    }
  }

  await ss(page, 'Z02-S2-final');

  // Now use Copilot to add step 3 and rename
  // Try opening copilot from the editor
  const chatBubble = page.locator('[class*="chat"], [class*="Chat"]').filter({ hasText: '' }).last();
  // Click the floating chat button at bottom right
  await page.mouse.click(1224, 668);
  await page.waitForTimeout(3000);
  await ss(page, 'Z02-S2-04-copilot-try');

  const chatArea = page.locator('textarea').first();
  if (await chatArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatArea.click();
    await chatArea.fill('Please add a third step: HubSpot "Update Deal" action to change the deal stage to "WhatsApp Verstuurd". Also rename this zap to "ZAP-02: WhatsApp Follow-up via Trengo"');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('  Copilot instructie verstuurd');
    await page.waitForTimeout(40000);
    await ss(page, 'Z02-S2-05-copilot');
  } else {
    console.log('  Copilot chat niet gevonden');
  }

  await ss(page, 'Z02-S2-done');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
