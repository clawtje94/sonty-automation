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
  console.log('🎬 ZAP-01 Board + Backlog selecteren');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Click step 1 to open config panel
  await page.mouse.click(660, 170);
  await page.waitForTimeout(5000);
  await ss(page, 'Z01-BB-00-opened');

  // Profile should already show "Sonty B.V." - verify
  const profileCheck = await page.evaluate(() => document.body.innerText.includes('Sonty B.V.'));
  console.log('Profile "Sonty B.V." zichtbaar:', profileCheck);

  // === BOARD ===
  console.log('\n--- Board selecteren ---');
  // The "Select a Board" dropdown should be clickable now
  // Find the "Choose value..." text that comes after "Select a Board"

  // Use the three-dot menu or click the select button for Board
  // Board is the second field, at roughly y=322
  // First let's try a more targeted click on the Board dropdown
  const boardTrigger = page.locator('button, [role="combobox"]').filter({ hasText: /Choose value/ }).first();

  // Actually, let's find all "Choose value..." buttons
  const chooseButtons = page.locator('button').filter({ hasText: 'Choose value...' });
  const chooseCount = await chooseButtons.count();
  console.log(`"Choose value..." buttons: ${chooseCount}`);

  if (chooseCount >= 1) {
    // First one should be Board (Profile is already "Sonty B.V.")
    await chooseButtons.nth(0).click();
    console.log('  Board dropdown geklikt');
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-BB-01-board-popup');

    // Get popup content
    const popupText = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="popup"], [class*="Popup"]');
      return modal ? modal.innerText.substring(0, 500) : 'no popup found';
    });
    console.log('Popup:', popupText);

    // Find and click radio/option
    const radioInputs = page.locator('input[type="radio"]');
    const radioCount = await radioInputs.count();
    console.log(`Radio inputs: ${radioCount}`);

    if (radioCount > 0) {
      await radioInputs.first().evaluate(el => {
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        if (parent) parent.click();
        else el.click();
      });
      console.log('  Board radio geklikt');
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-BB-02-board-selected');
    } else {
      // Try role="option"
      const opts = page.locator('[role="option"]');
      const optCount = await opts.count();
      console.log(`Options: ${optCount}`);
      if (optCount > 0) {
        await opts.first().click();
        await page.waitForTimeout(3000);
      }
    }
  }

  // === BACKLOG ===
  console.log('\n--- Backlog selecteren ---');
  await page.waitForTimeout(2000);

  // Find remaining "Choose value..." buttons
  const remainingChoose = page.locator('button').filter({ hasText: 'Choose value...' });
  const remaining = await remainingChoose.count();
  console.log(`Remaining "Choose value..." buttons: ${remaining}`);

  if (remaining >= 1) {
    // The first should be Backlog now
    await remainingChoose.nth(0).click();
    console.log('  Backlog dropdown geklikt');
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-BB-03-backlog-popup');

    const popupText = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]');
      return modal ? modal.innerText.substring(0, 500) : 'no popup';
    });
    console.log('Backlog popup:', popupText);

    // For multi-select (Backlog(s)), it might use checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    console.log(`Checkboxes: ${cbCount}`);

    if (cbCount > 0) {
      // Click all checkboxes or just the first
      await checkboxes.first().evaluate(el => {
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        if (parent) parent.click();
        else el.click();
      });
      console.log('  Backlog checkbox geklikt');
      await page.waitForTimeout(2000);

      // Close popup via X button
      const closeX = page.locator('[aria-label="Close"], [aria-label="close"], button svg').first();
      // Or click outside
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else {
      const radios = page.locator('input[type="radio"]');
      const rCount = await radios.count();
      if (rCount > 0) {
        await radios.first().evaluate(el => {
          let parent = el.parentElement;
          while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
          if (parent) parent.click();
          else el.click();
        });
        console.log('  Backlog radio geklikt');
        await page.waitForTimeout(2000);
      }
    }
    await ss(page, 'Z01-BB-04-backlog-selected');
  }

  await page.waitForTimeout(2000);
  await ss(page, 'Z01-BB-05-final');

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  // Try Continue
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const isDisabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
    if (!isDisabled) {
      await continueBtn.click();
      console.log('  Continue geklikt!');
      await page.waitForTimeout(5000);
      await ss(page, 'Z01-BB-06-continued');
    } else {
      console.log('  Continue nog disabled');
    }
  }

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
