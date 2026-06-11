const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

// Click the popup option by finding the row with matching text and clicking it
async function clickPopupRadio(page, searchText) {
  await page.waitForTimeout(2000);

  // Approach 1: find the label containing the text
  const result = await page.evaluate((text) => {
    // Find all elements that look like selectable rows in the popup
    const allElements = document.querySelectorAll('div, label, li, span');
    for (const el of allElements) {
      if (el.offsetParent === null) continue;
      const elText = el.textContent || '';
      if (!elText.includes(text)) continue;

      const rect = el.getBoundingClientRect();
      // The popup row should be between 200-500px wide and 40-80px tall
      if (rect.width < 100 || rect.width > 600) continue;
      if (rect.height < 30 || rect.height > 100) continue;

      // This looks like a row - click it
      el.click();
      return `clicked element: ${el.tagName} ${rect.width}x${rect.height} text="${elText.substring(0,50)}"`;
    }

    // Approach 2: find radio/checkbox inputs near the text
    const radios = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (const radio of radios) {
      if (radio.offsetParent === null) continue;
      // Check if nearby text contains our search text
      let parent = radio.parentElement;
      for (let i = 0; i < 5; i++) {
        if (parent && parent.textContent && parent.textContent.includes(text)) {
          // Found it - click via label walk-up
          let label = radio.parentElement;
          while (label && label.tagName !== 'LABEL') label = label.parentElement;
          if (label) {
            label.click();
            return `clicked label near radio: ${label.textContent.substring(0,50)}`;
          }
          radio.click();
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          return `clicked radio directly`;
        }
        if (parent) parent = parent.parentElement;
      }
    }

    return 'not found';
  }, searchText);

  console.log(`  clickPopupRadio("${searchText}"): ${result}`);
  return result !== 'not found';
}

// Find first enabled "Choose value" button and return its y coordinate
async function findEnabledChooseButton(page) {
  return page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
    }
    return null;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 Reuzenpanda complete configuratie');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Double-click step 1 to open config panel
  await page.mouse.dblclick(660, 170);
  await page.waitForTimeout(5000);

  // Check which fields need to be set
  const fields = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      profile: text.includes('Sonty B.V.') ? 'set' : 'empty',
      board: text.match(/Select a Board\*\n(.*)/)?.[1]?.trim() || 'unknown',
      backlog: text.match(/Select Backlog\(s\)\*\n(.*)/)?.[1]?.trim() || 'unknown',
    };
  });
  console.log('Current state:', JSON.stringify(fields));

  // === BOARD ===
  if (fields.board.includes('Choose value') || fields.board === 'unknown') {
    console.log('\n--- Board selecteren ---');
    const boardBtn = await findEnabledChooseButton(page);
    if (boardBtn) {
      console.log(`  Board button at (${Math.round(boardBtn.x)}, ${Math.round(boardBtn.y)})`);
      await page.mouse.click(boardBtn.x, boardBtn.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-CMP-01-board-popup');

      // Wait for popup and select "Leads"
      const success = await clickPopupRadio(page, 'Leads');
      if (success) {
        await page.waitForTimeout(4000);
        await ss(page, 'Z01-CMP-02-board-selected');
      }
    }
  }

  // === BACKLOG ===
  console.log('\n--- Backlog selecteren ---');
  await page.waitForTimeout(3000); // Wait for Backlog to become enabled

  const backlogBtn = await findEnabledChooseButton(page);
  if (backlogBtn) {
    console.log(`  Backlog button at (${Math.round(backlogBtn.x)}, ${Math.round(backlogBtn.y)})`);
    await page.mouse.click(backlogBtn.x, backlogBtn.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-CMP-03-backlog-popup');

    const success = await clickPopupRadio(page, 'Leads');
    if (success) {
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-CMP-04-backlog-selected');
    }
  } else {
    console.log('  Geen enabled "Choose value" button gevonden');
    // The Backlog might be disabled - check
    const disabledButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const result = [];
      for (const btn of buttons) {
        if (btn.textContent.trim().startsWith('Choose value')) {
          result.push({ disabled: btn.disabled, text: btn.textContent.trim().substring(0, 30) });
        }
      }
      return result;
    });
    console.log('  Disabled Choose buttons:', JSON.stringify(disabledButtons));
  }

  // === FINAL STATUS ===
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-CMP-05-status');
  const finalFields = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      profile: text.match(/Select a Profile\*\n(.*)/)?.[1]?.trim(),
      board: text.match(/Select a Board\*\n(.*)/)?.[1]?.trim(),
      backlog: text.match(/Select Backlog\(s\)\*\n(.*)/)?.[1]?.trim(),
      hasContinue: text.includes('Continue'),
      continueFinishRequired: text.includes('finish required'),
    };
  });
  console.log('\nFinal fields:', JSON.stringify(finalFields, null, 2));

  // === CONTINUE ===
  if (!finalFields.continueFinishRequired) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ force: true });
      console.log('  Continue geklikt!');
      await page.waitForTimeout(8000);
      await ss(page, 'Z01-CMP-06-continued');

      // Test trigger or Skip test
      const testBtn = page.locator('button').filter({ hasText: /Test trigger/i });
      const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });

      if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await skipBtn.click();
        console.log('  Skip test geklikt');
        await page.waitForTimeout(3000);
      } else if (await testBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await testBtn.click();
        console.log('  Test trigger geklikt');
        await page.waitForTimeout(15000);
      }

      await ss(page, 'Z01-CMP-07-after-test');
    }
  }

  await ss(page, 'Z01-CMP-final');
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
