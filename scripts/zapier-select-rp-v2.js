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
  console.log('🎬 ZAP-01 Reuzenpanda velden selecteren v2');

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

  // === PROFILE ===
  console.log('\n--- Profile ---');
  await page.mouse.click(1050, 247); // Click Profile dropdown
  await page.waitForTimeout(2000);

  // The popup should appear with "Sonty B.V." - click the radio button
  const sontyRow = page.locator('text=Sonty B.V.').first();
  if (await sontyRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Click on the radio input or the row itself
    const radio = page.locator('input[type="radio"]').first();
    if (await radio.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click the label/parent like we did with HubSpot OAuth
      await radio.evaluate(el => {
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        if (parent) parent.click();
        else el.click();
      });
      console.log('  Radio button geklikt via label');
    } else {
      // Click on the "Sonty B.V." text directly
      await sontyRow.click();
      console.log('  Sonty B.V. tekst geklikt');
    }
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-V2-01-profile-selected');

    // Check if the popup auto-closed or if we need to close it
    const closeBtn = page.locator('button').filter({ hasText: /×|Close/ }).first()
      .or(page.locator('[aria-label="Close"]').first());
    // The modal might have closed automatically on selection

    // Check if we see "Sonty B.V." in the profile field now
    const profileField = await page.evaluate(() => {
      const el = document.querySelector('[class*="profile"], [class*="Profile"]');
      return el ? el.innerText : 'not found';
    });
    console.log('Profile veld:', profileField);
  }

  // Wait for Board to become enabled
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-V2-02-after-profile');

  // Check current state of the form
  const formText = await page.evaluate(() => {
    const panel = document.querySelector('[class*="panel"]');
    return panel ? panel.innerText.substring(0, 800) : document.body.innerText.substring(0, 1000);
  });
  console.log('Form state:', formText.substring(0, 500));

  // === BOARD ===
  console.log('\n--- Board ---');
  // Check if Board is now enabled (not "Disabled" anymore)
  const boardBtn = page.locator('text=Choose value...').first();
  if (await boardBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await boardBtn.click();
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-V2-03-board-popup');

    // Select first board option (similar radio button popup)
    const boardOption = page.locator('[role="radio"], input[type="radio"]').first()
      .or(page.locator('[role="option"]').first());
    if (await boardOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      const boardText = await boardOption.evaluate(el => {
        // Try to get the text
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        if (parent) {
          parent.click();
          return parent.innerText;
        }
        el.click();
        return el.innerText;
      });
      console.log(`  Board geselecteerd: "${boardText}"`);
      await page.waitForTimeout(3000);
    } else {
      // Try clicking text
      const optText = page.locator('text=Sonty').nth(0);
      console.log('  Probeer tekst te klikken');
    }
    await ss(page, 'Z01-V2-04-board-selected');
  }

  // === BACKLOG ===
  console.log('\n--- Backlog ---');
  await page.waitForTimeout(2000);
  const backlogBtn = page.locator('text=Choose value...').first();
  if (await backlogBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await backlogBtn.click();
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-V2-05-backlog-popup');

    const backlogOption = page.locator('[role="radio"], input[type="radio"]').first()
      .or(page.locator('[role="option"]').first());
    if (await backlogOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await backlogOption.evaluate(el => {
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        if (parent) parent.click();
        else el.click();
      });
      console.log('  Backlog geselecteerd');
      await page.waitForTimeout(3000);
    }

    // Check if it's a checkbox (multi-select)
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkbox.evaluate(el => {
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        if (parent) parent.click();
        else el.click();
      });
      console.log('  Backlog checkbox geklikt');
      await page.waitForTimeout(2000);

      // Close the popup
      const xBtn = page.locator('button[aria-label*="close"], button[aria-label*="Close"]').first()
        .or(page.locator('button').filter({ hasText: '×' }).first());
      if (await xBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await xBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    await ss(page, 'Z01-V2-06-backlog-selected');
  }

  await page.waitForTimeout(2000);
  await ss(page, 'Z01-V2-07-final');

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  // Try Continue
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const isDisabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
    console.log(`Continue disabled: ${isDisabled}`);
    if (!isDisabled) {
      await continueBtn.click();
      console.log('  Continue geklikt!');
      await page.waitForTimeout(5000);
      await ss(page, 'Z01-V2-08-after-continue');
    }
  }

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
