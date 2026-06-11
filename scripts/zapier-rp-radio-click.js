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
  console.log('🎬 ZAP-01 Radio button klikken');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Double-click step 1
  await page.mouse.dblclick(660, 170);
  await page.waitForTimeout(5000);

  // === BOARD ===
  console.log('--- Board ---');
  // Open Board dropdown
  const boardBtn = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
    }
    return null;
  });

  if (boardBtn) {
    await page.mouse.click(boardBtn.x, boardBtn.y);
    await page.waitForTimeout(3000);

    // Analyze the popup structure
    const popupInfo = await page.evaluate(() => {
      // Find all inputs in the popup area
      const inputs = document.querySelectorAll('input');
      const info = [];
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        // Skip if outside popup area (popup is center of screen)
        if (rect.x < 400 || rect.x > 900) continue;
        info.push({
          type: inp.type,
          name: inp.name,
          value: inp.value,
          checked: inp.checked,
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          width: rect.width,
          height: rect.height,
          id: inp.id,
          ariaLabel: inp.getAttribute('aria-label'),
          parentTag: inp.parentElement?.tagName,
          parentClass: inp.parentElement?.className?.substring(0, 50)
        });
      }
      return info;
    });
    console.log('Popup inputs:', JSON.stringify(popupInfo, null, 2));

    if (popupInfo.length > 0) {
      // Click on the first input's coordinates
      const radioInput = popupInfo[0];
      console.log(`  Klik op radio (${radioInput.x}, ${radioInput.y})`);

      // Use page.mouse.click directly on the radio coordinates
      await page.mouse.click(radioInput.x, radioInput.y);
      await page.waitForTimeout(4000);
      await ss(page, 'Z01-RAD-01-after-board-click');

      // Check if popup closed (selection was made)
      const stillOpen = await page.evaluate(() =>
        document.body.innerText.includes('Select value for Select a Board'));
      console.log('  Popup nog open:', stillOpen);

      if (stillOpen) {
        // Try clicking on the radio text "Leads" instead
        console.log('  Probeer "Leads" tekst klik...');
        await page.mouse.click(572, 373); // "Leads" text position from screenshot
        await page.waitForTimeout(3000);

        const stillOpen2 = await page.evaluate(() =>
          document.body.innerText.includes('Select value for Select a Board'));
        console.log('  Popup nog open:', stillOpen2);

        if (stillOpen2) {
          // Try using Playwright locator on the specific radio
          console.log('  Probeer Playwright locator...');
          const radioLocator = page.locator('input[type="radio"]').first();
          if (await radioLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
            await radioLocator.check({ force: true });
            console.log('  Radio checked via locator');
            await page.waitForTimeout(3000);
          }
        }
      }

      await ss(page, 'Z01-RAD-02-board-status');
    }
  }

  // Check Board status
  const boardSet = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/Select a Board\*\n(.*)/);
    return match?.[1]?.trim();
  });
  console.log('Board waarde:', boardSet);

  // === BACKLOG ===
  if (boardSet && boardSet !== 'Choose value…') {
    console.log('\n--- Backlog ---');
    await page.waitForTimeout(3000);

    const backlogBtn = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
          const rect = btn.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }
      }
      return null;
    });

    if (backlogBtn) {
      await page.mouse.click(backlogBtn.x, backlogBtn.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-RAD-03-backlog-popup');

      // Use same radio click approach
      const radioInfo = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const rect = inp.getBoundingClientRect();
          if (rect.x < 400 || rect.x > 900) continue;
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
        return null;
      });

      if (radioInfo) {
        await page.mouse.click(radioInfo.x, radioInfo.y);
        await page.waitForTimeout(3000);
      }

      // Try check via locator if popup still open
      const radioLocator = page.locator('input[type="radio"]').first();
      if (await radioLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
        await radioLocator.check({ force: true });
        await page.waitForTimeout(3000);
      }

      await ss(page, 'Z01-RAD-04-backlog-done');
    }
  }

  // === Continue ===
  const continueEnabled = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.textContent.trim() === 'Continue' && !btn.disabled) return true;
    }
    return false;
  });

  if (continueEnabled) {
    const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
    await continueBtn.click({ force: true });
    console.log('Continue geklikt!');
    await page.waitForTimeout(5000);
    await ss(page, 'Z01-RAD-05-continued');
  }

  await ss(page, 'Z01-RAD-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 800));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
