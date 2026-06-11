const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function selectDropdownOption(page, dropdownIndex, optionIndex = 0) {
  // Find all dropdown trigger elements
  // Zapier uses custom select components - let's find them via aria or data attributes
  const triggers = await page.evaluate((idx) => {
    // Look for elements that contain "Choose value..." text
    const all = document.querySelectorAll('*');
    const triggers = [];
    for (const el of all) {
      if (el.children.length === 0 && el.textContent.trim() === 'Choose value…') {
        // Walk up to find the clickable parent
        let clickable = el;
        for (let i = 0; i < 5; i++) {
          if (clickable.parentElement) clickable = clickable.parentElement;
          if (clickable.tagName === 'BUTTON' || clickable.getAttribute('role') === 'combobox' ||
              clickable.getAttribute('role') === 'button') break;
        }
        triggers.push({
          tag: clickable.tagName,
          role: clickable.getAttribute('role'),
          className: clickable.className.substring(0, 100),
          rect: clickable.getBoundingClientRect()
        });
      }
    }
    return triggers;
  }, dropdownIndex);

  console.log(`  Dropdown triggers gevonden: ${triggers.length}`);
  if (triggers.length > dropdownIndex) {
    const t = triggers[dropdownIndex];
    console.log(`  Target: ${t.tag} role=${t.role} at (${Math.round(t.rect.x + t.rect.width/2)}, ${Math.round(t.rect.y + t.rect.height/2)})`);
    return { x: t.rect.x + t.rect.width/2, y: t.rect.y + t.rect.height/2 };
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-01 Alles-in-één configuratie');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Close copilot sidebar if open by clicking the < chevron button
  const chevronClose = page.locator('button[aria-label*="Close"]').first();
  if (await chevronClose.isVisible({ timeout: 2000 }).catch(() => false)) {
    await chevronClose.click();
    await page.waitForTimeout(1000);
  }
  // Try pressing Escape to close any open panel
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Click step 1 in canvas to open config
  await page.mouse.click(660, 170);
  await page.waitForTimeout(5000);
  await ss(page, 'Z01-AIO-01-step1');

  // Find and log all "Choose value…" triggers
  const coords = await selectDropdownOption(page, 0);

  // === PROFILE ===
  console.log('\n--- Profile ---');
  if (coords) {
    await page.mouse.click(coords.x, coords.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-AIO-02-profile-dropdown');

    // Select Sonty B.V. via radio label
    const sontyLabel = page.locator('label').filter({ hasText: /Sonty/ }).first();
    if (await sontyLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sontyLabel.click();
      console.log('  Sonty B.V. label geklikt');
    } else {
      // Try clicking the text
      await page.locator('text=Sonty B.V.').first().click();
      console.log('  Sonty B.V. tekst geklikt');
    }
    await page.waitForTimeout(4000);
    await ss(page, 'Z01-AIO-03-profile-selected');
  }

  // Check if profile was set
  const profileSet = await page.evaluate(() => document.body.innerText.includes('Sonty B.V.'));
  console.log('Profile set:', profileSet);

  // === BOARD ===
  console.log('\n--- Board ---');
  await page.waitForTimeout(2000);

  // Find the Board dropdown (should be next "Choose value" after profile is set)
  const boardCoords = await selectDropdownOption(page, 0); // Index 0 because Profile is no longer "Choose value"
  if (boardCoords) {
    console.log(`  Board dropdown at (${Math.round(boardCoords.x)}, ${Math.round(boardCoords.y)})`);
    await page.mouse.click(boardCoords.x, boardCoords.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-AIO-04-board-dropdown');

    // Select first board option
    const boardLabel = page.locator('label').filter({ hasText: /.+/ }).first();
    if (await boardLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      const boardText = await boardLabel.innerText().catch(() => 'unknown');
      console.log(`  Board label: "${boardText}"`);
      await boardLabel.click();
      console.log('  Board label geklikt');
    }
    await page.waitForTimeout(4000);
    await ss(page, 'Z01-AIO-05-board-selected');
  } else {
    console.log('  Board dropdown niet gevonden');
  }

  // === BACKLOG ===
  console.log('\n--- Backlog ---');
  await page.waitForTimeout(2000);

  const backlogCoords = await selectDropdownOption(page, 0);
  if (backlogCoords) {
    console.log(`  Backlog dropdown at (${Math.round(backlogCoords.x)}, ${Math.round(backlogCoords.y)})`);
    await page.mouse.click(backlogCoords.x, backlogCoords.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-AIO-06-backlog-dropdown');

    // Select first backlog (may be checkbox for multi)
    const firstLabel = page.locator('label').filter({ hasText: /.+/ }).first();
    if (await firstLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      const blText = await firstLabel.innerText().catch(() => 'unknown');
      console.log(`  Backlog label: "${blText}"`);
      await firstLabel.click();
      console.log('  Backlog label geklikt');
    }
    await page.waitForTimeout(2000);

    // Close popup if still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    await ss(page, 'Z01-AIO-07-backlog-selected');
  }

  // === CONTINUE ===
  console.log('\n--- Continue ---');
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-AIO-08-before-continue');

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Status:', finalText.substring(0, 800));

  // Find and click Continue
  const continueBtn = page.locator('button').filter({ hasText: /Continue/ }).first();
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const isDisabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
    if (!isDisabled) {
      await continueBtn.click();
      console.log('  Continue geklikt!');
      await page.waitForTimeout(5000);
      await ss(page, 'Z01-AIO-09-continued');

      // Now we should be on Test tab or next step
      const afterText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      console.log('Na continue:', afterText.substring(0, 500));

      // Click "Test trigger" if visible
      const testBtn = page.locator('button').filter({ hasText: /Test trigger|Test step/i }).first();
      if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await testBtn.click();
        console.log('  Test trigger geklikt!');
        await page.waitForTimeout(10000);
        await ss(page, 'Z01-AIO-10-tested');
      }
    } else {
      console.log('  Continue is disabled');
    }
  }

  await ss(page, 'Z01-AIO-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
