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
  console.log('🎬 ZAP-01 Step 4 - Remove bh@hubspot.com');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Double-click Step 4
  const step4El = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === '4.') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 5) return { x: Math.round(rect.x + 100), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });
  if (step4El) {
    await page.mouse.dblclick(step4El.x, step4El.y);
    await page.waitForTimeout(5000);
  }

  // Go to Configure tab
  const configTab = page.locator('button').filter({ hasText: /^Configure$/ }).first();
  if (await configTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await configTab.click();
    await page.waitForTimeout(3000);
  }

  // Scroll down
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(2000);

  // Find the "Remove this item" button next to bh@hubspot.com
  const removeBtn = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button[aria-label="Remove this item"]');
    let bhRemove = null;
    for (const btn of buttons) {
      if (btn.offsetParent === null) continue;
      const rect = btn.getBoundingClientRect();
      // Check if this remove button is near bh@hubspot.com (within same row)
      // bh@hubspot.com was at y=536, so the remove button should be at similar y
      // Get all nearby elements to check
      const parent = btn.closest('[class*="field"], [class*="Field"], [class*="row"], [class*="Row"]') || btn.parentElement;
      if (parent?.textContent?.includes('bh@hubspot')) {
        bhRemove = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    // If not found by parent check, get the last Remove button (which should be the bh one)
    if (!bhRemove) {
      const allRemove = [];
      for (const btn of buttons) {
        if (btn.offsetParent === null) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.y > 400) {
          allRemove.push({ x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
        }
      }
      // The last one should be the bh@hubspot.com entry
      if (allRemove.length > 0) bhRemove = allRemove[allRemove.length - 1];
    }
    return bhRemove;
  });

  if (removeBtn) {
    console.log(`Removing bh@hubspot.com at (${removeBtn.x}, ${removeBtn.y})`);
    await page.mouse.click(removeBtn.x, removeBtn.y);
    await page.waitForTimeout(3000);
    console.log('Verwijderd!');
    await ss(page, 'Z01-REM-01-removed');

    // Check what's left
    const text = await page.evaluate(() => document.body.innerText.substring(0, 5000));
    console.log('\nAfter removal:', text.substring(text.length - 1500));

    // Also check: is the first "Choose value…" still there? We may need to also check that row
    const remainingEntries = await page.evaluate(() => {
      const result = [];
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.x < 850 || rect.y < 400 || rect.y > 650) continue;
        const text = btn.textContent?.trim() || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (text.length > 0) {
          result.push({ text: text.substring(0, 60), ariaLabel: ariaLabel.substring(0, 60), y: Math.round(rect.y) });
        }
      }
      return result;
    });
    console.log('\nRemaining entries:', JSON.stringify(remainingEntries, null, 2));

    // Click Continue
    const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueBtn.click();
      console.log('Continue geklikt');
      await page.waitForTimeout(5000);
      await ss(page, 'Z01-REM-02-test');

      // Check test data
      const testText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
      console.log('\nTest data:', testText.substring(testText.length - 1500));
    }
  }

  await ss(page, 'Z01-REM-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
