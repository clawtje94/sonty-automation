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
  console.log('🎬 ZAP-01 Step 3 configureren via Copilot');

  // Open ZAP-01
  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await ss(page, 'Z01-CFG-01-loaded');

  // Check current state
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Status:', text.substring(0, 600));

  // Use Copilot to configure step 3
  const chatArea = page.locator('textarea').first();
  if (await chatArea.isVisible({ timeout: 10000 }).catch(() => false)) {
    await chatArea.click();
    const msg = `Please configure this zap completely:

1. For step 3 "Create Deal":
   - Click "Continue" on the Setup tab
   - Set "Deal Pipeline" to "Sonty Verkooppijplijn"
   - Set "Deal Stage" to "Nieuwe Lead"
   - Map "Deal Name" to the lead's name from step 1
   - Map "Associated Contact" to the contact from step 2
   - Map any available fields (email, phone, address) from step 1

2. Rename this zap to "ZAP-01: Reuzenpanda Lead Intake"

3. After configuring, test the zap if possible`;

    await chatArea.fill(msg);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('  Copilot instructie verstuurd');

    // Wait for Copilot to work
    await page.waitForTimeout(45000);
    await ss(page, 'Z01-CFG-02-copilot-working');

    const text2 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Na copilot:', text2.substring(0, 800));

    // Wait more if still working
    if (text2.includes('Thought') || text2.includes('Loading') || text2.includes('Working') || text2.includes('called')) {
      console.log('  Copilot nog bezig, extra wachttijd...');
      await page.waitForTimeout(30000);
      await ss(page, 'Z01-CFG-03-copilot-more');

      const text3 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('Na extra wacht:', text3.substring(0, 800));

      if (text3.includes('Thought') || text3.includes('Loading') || text3.includes('Working') || text3.includes('called')) {
        await page.waitForTimeout(30000);
      }
    }
  } else {
    console.log('  Chat input niet gevonden, probeer direct configuratie');
    // Click on step 3 to open it
    const step3 = page.locator('text=Create Deal').first();
    if (await step3.isVisible().catch(() => false)) {
      await step3.click();
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'Z01-CFG-04-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
