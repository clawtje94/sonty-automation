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
  console.log('🎬 ZAP-02 configureren via Copilot');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open Copilot by clicking the chat bubble
  await page.mouse.click(1224, 668);
  await page.waitForTimeout(3000);

  // Look for the chat textarea
  let chatArea = page.locator('textarea').first();
  if (!await chatArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Try to find and click the Copilot toggle button on the left sidebar
    const copilotBtns = page.locator('button, [aria-label*="opilot"]');
    const count = await copilotBtns.count();
    for (let i = 0; i < count; i++) {
      const btn = copilotBtns.nth(i);
      const text = await btn.innerText().catch(() => '');
      if (text.includes('Copilot') || text.includes('copilot')) {
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
    chatArea = page.locator('textarea').first();
  }

  if (await chatArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    const msg = `Please complete this zap with the following configuration:

1. Step 1 (HubSpot Updated Deal Stage trigger):
   - Pipeline: "Sonty Verkooppijplijn" (ID: 3623322812)
   - Stage: "Prijsindicatie Verstuurd" (stage 4)

2. Step 2 (Trengo Send a Message):
   - Configure Trengo account connection
   - Send a WhatsApp message to the contact's phone number
   - Message: "Hoi {{contact_name}}, bedankt voor je interesse! We hebben je een prijsindicatie gestuurd per e-mail. Heb je vragen? Neem gerust contact op! Groeten, Team Sonty"

3. Add step 3: HubSpot Update Deal
   - Update deal stage to "WhatsApp Verstuurd"

4. Add step 4: HubSpot Create Note
   - Log a note on the deal: "WhatsApp follow-up verstuurd via Trengo"

5. Rename this zap to "ZAP-02: WhatsApp Follow-up via Trengo"`;

    await chatArea.click();
    await chatArea.fill(msg);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('  Copilot instructie verstuurd');

    // Wait for Copilot to work
    await page.waitForTimeout(50000);
    await ss(page, 'Z02-BUILD-01-copilot');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Na copilot:', text.substring(0, 800));

    // Wait more if still working
    if (text.includes('Working') || text.includes('called') || text.includes('Thought')) {
      await page.waitForTimeout(40000);
      await ss(page, 'Z02-BUILD-02-more');

      const text2 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      if (text2.includes('Working') || text2.includes('called')) {
        await page.waitForTimeout(30000);
      }
    }
  } else {
    console.log('  Copilot chat niet gevonden');
    // Take a screenshot to debug
    await ss(page, 'Z02-BUILD-00-no-copilot');
  }

  await ss(page, 'Z02-BUILD-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1200));
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
