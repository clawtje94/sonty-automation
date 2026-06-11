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
  console.log('🎬 ZAP-01 Step 1 Reuzenpanda velden invullen');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Click on step 1 card
  await page.mouse.click(660, 170);
  await page.waitForTimeout(4000);

  // Now click on the Profile dropdown - it's a button/div with "Choose value..."
  // The dropdown is in the right panel, around x=1050, y=247
  console.log('\n--- Profile dropdown ---');
  await page.mouse.click(1050, 247);
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-FILL-01-profile-click');

  // Get any visible dropdown options
  const profileOptions = await page.evaluate(() => {
    const elements = document.querySelectorAll('[role="option"], [role="listbox"] li, [class*="menu"] li, [class*="dropdown"] li, [class*="listbox"] [role="option"]');
    const texts = [];
    elements.forEach(el => {
      const t = el.innerText.trim();
      if (t && t.length < 200) texts.push(t);
    });
    return texts.slice(0, 20);
  });
  console.log('Profile dropdown opties:', profileOptions);

  // If nothing, try clicking the actual select element
  if (profileOptions.length === 0) {
    // Try finding a combobox or button with "Choose value" aria
    const comboboxes = page.locator('[role="combobox"], button[aria-haspopup]');
    const count = await comboboxes.count();
    console.log(`Combobox/haspopup elementen: ${count}`);

    // Click the first combobox (should be Profile)
    if (count > 0) {
      await comboboxes.first().click();
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-FILL-02-combobox-click');

      const opts = await page.evaluate(() => {
        const items = document.querySelectorAll('[role="option"], [role="listbox"] *, [class*="option"]');
        return Array.from(items).map(i => i.innerText.trim()).filter(t => t.length > 0 && t.length < 200).slice(0, 20);
      });
      console.log('Opties na combobox click:', opts);
    }
  }

  // Let's try a different approach - use Copilot to configure step 1
  console.log('\n--- Copilot gebruiken ---');

  // Open Copilot
  const copilotBtn = page.locator('button').filter({ hasText: /Copilot/i }).first()
    .or(page.locator('[class*="chat-bubble"], [class*="copilot"]').first());

  // Click the chat bubble in bottom right
  await page.mouse.click(1224, 668);
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-FILL-03-copilot-open');

  const chatArea = page.locator('textarea').first();
  if (await chatArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatArea.click();
    await chatArea.fill('Please configure step 1 (Reuzenpanda Lead Created trigger). Select the first available Profile, Board, and Backlog. If there is only one option for each, select it automatically.');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('  Copilot instructie verstuurd');

    await page.waitForTimeout(30000);
    await ss(page, 'Z01-FILL-04-copilot-response');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Na copilot:', text.substring(0, 800));

    // Wait more if needed
    if (text.includes('Working') || text.includes('called') || text.includes('Thought')) {
      await page.waitForTimeout(20000);
      await ss(page, 'Z01-FILL-05-copilot-done');
    }
  }

  await ss(page, 'Z01-FILL-06-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
