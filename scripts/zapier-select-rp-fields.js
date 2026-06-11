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
  console.log('🎬 ZAP-01 Reuzenpanda velden selecteren');

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

  // --- PROFILE ---
  console.log('\n--- Profile selecteren ---');
  // Click the Profile dropdown
  await page.mouse.click(1050, 247);
  await page.waitForTimeout(2000);

  // Select "Sonty B.V."
  const sontyOpt = page.locator('[role="option"]').filter({ hasText: /Sonty/i }).first()
    .or(page.locator('text=Sonty B.V.').first());
  if (await sontyOpt.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sontyOpt.click();
    console.log('  Sonty B.V. geselecteerd!');
    await page.waitForTimeout(3000);
  }
  await ss(page, 'Z01-SEL-01-profile');

  // --- BOARD ---
  console.log('\n--- Board selecteren ---');
  // The Board dropdown should now be enabled
  const boardDropdown = page.locator('text=Choose value...').nth(0); // First remaining "Choose value"
  await page.waitForTimeout(2000);

  // Click on the Board dropdown area (second dropdown)
  await page.mouse.click(1050, 322);
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-SEL-02-board-dropdown');

  // Get board options
  const boardOpts = await page.evaluate(() => {
    const items = document.querySelectorAll('[role="option"]');
    return Array.from(items).map(i => i.innerText.trim()).filter(t => t.length > 0).slice(0, 20);
  });
  console.log('Board opties:', boardOpts);

  // Select first option
  const firstBoardOpt = page.locator('[role="option"]').first();
  if (await firstBoardOpt.isVisible({ timeout: 5000 }).catch(() => false)) {
    const text = await firstBoardOpt.innerText();
    console.log(`  Board selecteren: "${text}"`);
    await firstBoardOpt.click();
    await page.waitForTimeout(3000);
  }
  await ss(page, 'Z01-SEL-03-board-selected');

  // --- BACKLOG ---
  console.log('\n--- Backlog selecteren ---');
  await page.waitForTimeout(2000);

  // Click backlog dropdown area (third dropdown)
  await page.mouse.click(1050, 397);
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-SEL-04-backlog-dropdown');

  const backlogOpts = await page.evaluate(() => {
    const items = document.querySelectorAll('[role="option"]');
    return Array.from(items).map(i => i.innerText.trim()).filter(t => t.length > 0).slice(0, 20);
  });
  console.log('Backlog opties:', backlogOpts);

  const firstBacklogOpt = page.locator('[role="option"]').first();
  if (await firstBacklogOpt.isVisible({ timeout: 5000 }).catch(() => false)) {
    const text = await firstBacklogOpt.innerText();
    console.log(`  Backlog selecteren: "${text}"`);
    await firstBacklogOpt.click();
    await page.waitForTimeout(3000);
  }
  await ss(page, 'Z01-SEL-05-backlog-selected');

  // Check if Continue is now enabled
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-SEL-06-status');

  const statusText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nStatus:', statusText.substring(0, 800));

  // Try clicking Continue
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const isDisabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true');
    console.log(`Continue disabled: ${isDisabled}`);
    if (!isDisabled) {
      await continueBtn.click();
      console.log('  Continue geklikt!');
      await page.waitForTimeout(5000);
      await ss(page, 'Z01-SEL-07-after-continue');
    } else {
      console.log('  Continue nog disabled, velden niet compleet');
    }
  }

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
