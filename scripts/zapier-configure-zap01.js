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
  console.log('🎬 ZAP-01 configureren');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Klik op Reuzenpanda Account koppeling in Copilot panel
  const rpAccount = page.locator('button, a, div').filter({ hasText: /Reuzenpanda.*Account/ }).first();
  if (await rpAccount.isVisible().catch(() => false)) {
    await rpAccount.click();
    await page.waitForTimeout(3000);
    console.log('  Reuzenpanda account geklikt');
    await ss(page, 'CFG01-01-rp-account');

    // Er verschijnt een dropdown met bestaande accounts
    const existingAccount = page.locator('[role="option"], button, a').filter({ hasText: /Reuzenpanda|account/i }).first();
    if (await existingAccount.isVisible().catch(() => false)) {
      const accText = await existingAccount.innerText().catch(() => '');
      console.log(`  Account optie: "${accText.substring(0, 50)}"`);
      await existingAccount.click();
      await page.waitForTimeout(3000);
    }
  }

  // Stuur Copilot bericht om deprecated stap te fixen
  const chatInput = page.locator('textarea').filter({ hasText: '' }).first()
    .or(page.locator('[placeholder*="Chat"]').first());

  // Focus op de chat input
  const chatArea = page.locator('textarea').first();
  if (await chatArea.isVisible().catch(() => false)) {
    await chatArea.click();
    await chatArea.fill('Please replace step 3 "Create Deal Deprecated" with the current non-deprecated "Create Deal" action. Set pipeline to Sonty Verkooppijplijn and stage to Nieuwe Lead. Also rename this zap to "ZAP-01: Reuzenpanda Lead Intake"');
    await page.waitForTimeout(500);

    // Send via arrow button or Enter
    const sendArrow = page.locator('button[type="submit"], button[aria-label*="send"], button[aria-label*="Send"]').first();
    if (await sendArrow.isVisible().catch(() => false)) {
      await sendArrow.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('  Copilot correctie verstuurd');

    await page.waitForTimeout(30000);
    await ss(page, 'CFG01-02-copilot-fix');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Na fix:', text.substring(0, 600));

    // Wacht meer als het nog bezig is
    if (text.includes('Loading') || text.includes('Working')) {
      await page.waitForTimeout(20000);
    }
  }

  await ss(page, 'CFG01-03-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 800));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
