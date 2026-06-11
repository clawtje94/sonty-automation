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
  console.log('🎬 ZAP-01 Step 1 Reuzenpanda configureren');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Click on step 1
  await page.mouse.click(660, 170);
  await page.waitForTimeout(4000);
  await ss(page, 'Z01-RP-01-step1-open');

  // Click on "Select a Profile" dropdown
  const profileDropdown = page.locator('text=Choose value...').first();
  if (await profileDropdown.isVisible().catch(() => false)) {
    await profileDropdown.click();
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-RP-02-profile-dropdown');

    // Get dropdown options
    const options = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="option"], [class*="option"], [class*="Option"], li, [class*="menu-item"]');
      return Array.from(items).map(i => i.innerText.trim()).filter(t => t.length > 0 && t.length < 100).slice(0, 20);
    });
    console.log('Profile opties:', options);

    // If there's only one option, select it
    if (options.length === 1) {
      console.log(`  Enige optie: "${options[0]}", selecteren...`);
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(3000);
    } else if (options.length > 0) {
      // Select the first one for now
      console.log(`  ${options.length} opties gevonden, eerste selecteren...`);
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(3000);
    }

    await ss(page, 'Z01-RP-03-profile-selected');
  }

  // Click on "Select a Board" dropdown
  const boardDropdown = page.locator('text=Choose value...').first();
  if (await boardDropdown.isVisible().catch(() => false)) {
    await boardDropdown.click();
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-RP-04-board-dropdown');

    const options = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="option"]');
      return Array.from(items).map(i => i.innerText.trim()).filter(t => t.length > 0).slice(0, 20);
    });
    console.log('Board opties:', options);

    if (options.length >= 1) {
      console.log(`  Eerste optie selecteren: "${options[0]}"`);
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(3000);
    }

    await ss(page, 'Z01-RP-05-board-selected');
  }

  // Click on "Select Backlog(s)" dropdown
  const backlogDropdown = page.locator('text=Choose value...').first();
  if (await backlogDropdown.isVisible().catch(() => false)) {
    await backlogDropdown.click();
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-RP-06-backlog-dropdown');

    const options = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="option"]');
      return Array.from(items).map(i => i.innerText.trim()).filter(t => t.length > 0).slice(0, 20);
    });
    console.log('Backlog opties:', options);

    if (options.length >= 1) {
      console.log(`  Eerste optie selecteren: "${options[0]}"`);
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(3000);
    }

    await ss(page, 'Z01-RP-07-backlog-selected');
  }

  await ss(page, 'Z01-RP-08-final');

  // Check if Continue button is enabled
  const continueBtn = page.locator('button').filter({ hasText: /Continue/i }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    const disabled = await continueBtn.getAttribute('disabled').catch(() => null);
    const ariaDisabled = await continueBtn.getAttribute('aria-disabled').catch(() => null);
    console.log(`Continue button: disabled=${disabled}, aria-disabled=${ariaDisabled}`);

    if (!disabled && ariaDisabled !== 'true') {
      await continueBtn.click();
      console.log('  Continue geklikt!');
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-RP-09-continued');
    }
  }

  // Get full status
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nPagina tekst:', text.substring(0, 800));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
