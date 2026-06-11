const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function selectPopupOption(page, label) {
  // Click the radio via its parent label, filtering by text content
  const option = page.locator('label').filter({ hasText: new RegExp(label, 'i') }).first();
  if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
    await option.click({ force: true });
    console.log(`  "${label}" geklikt`);
    return true;
  }

  // Fallback: click text directly
  const textEl = page.locator(`text=${label}`).first();
  if (await textEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textEl.click({ force: true });
    console.log(`  "${label}" text geklikt`);
    return true;
  }

  // Fallback: click radio via evaluate
  const clicked = await page.evaluate((lbl) => {
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (const inp of inputs) {
      let parent = inp.parentElement;
      for (let i = 0; i < 5; i++) {
        if (parent && parent.textContent.includes(lbl)) {
          let label = inp.parentElement;
          while (label && label.tagName !== 'LABEL') label = label.parentElement;
          if (label) { label.click(); return 'label'; }
          inp.click(); return 'input';
        }
        if (parent) parent = parent.parentElement;
      }
    }
    return false;
  }, label);
  console.log(`  evaluate result: ${clicked}`);
  return clicked;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 Board + Backlog (profile already set)');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Double-click step 1 to open config
  await page.mouse.dblclick(660, 170);
  await page.waitForTimeout(5000);

  // Verify Profile is still set
  const profileSet = await page.evaluate(() => document.body.innerText.includes('Sonty B.V.'));
  console.log('Profile set:', profileSet);

  if (!profileSet) {
    // Re-select profile
    console.log('Profile niet set, opnieuw selecteren...');
    // Click Profile dropdown (first "Choose value" at y=248)
    await page.mouse.click(1041, 248);
    await page.waitForTimeout(2000);
    await selectPopupOption(page, 'Sonty');
    await page.waitForTimeout(4000);
  }

  // === BOARD ===
  console.log('\n--- Board selecteren ---');
  // Board dropdown at y=323 (but only if Profile was just set, it should be enabled now)
  // Find first non-disabled "Choose value" dropdown
  const boardY = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('Choose value') && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        return rect.y + rect.height / 2;
      }
    }
    return null;
  });

  if (boardY) {
    console.log(`  Board dropdown op y=${boardY}`);
    await page.mouse.click(1041, boardY);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-BB2-01-board-popup');

    // Select "Leads"
    await selectPopupOption(page, 'Leads');
    await page.waitForTimeout(4000);
    await ss(page, 'Z01-BB2-02-board-done');
  } else {
    // Board might still be disabled, try clicking at known position
    console.log('  Board button niet gevonden, probeer bekende positie...');
    await page.mouse.click(1041, 323);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-BB2-01b-board-try');

    const popupVisible = await page.evaluate(() => document.body.innerText.includes('Select value for'));
    if (popupVisible) {
      await selectPopupOption(page, 'Leads');
      await page.waitForTimeout(4000);
    }
  }

  // === BACKLOG ===
  console.log('\n--- Backlog selecteren ---');
  await page.waitForTimeout(2000);

  const backlogY = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('Choose value') && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        return rect.y + rect.height / 2;
      }
    }
    return null;
  });

  if (backlogY) {
    console.log(`  Backlog dropdown op y=${backlogY}`);
    await page.mouse.click(1041, backlogY);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-BB2-03-backlog-popup');

    // Get popup options
    const popupText = await page.evaluate(() => {
      const modal = document.querySelectorAll('*');
      for (const el of modal) {
        if (el.textContent.includes('Select value for') && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 200) return el.innerText;
        }
      }
      return '';
    });
    console.log('Backlog popup:', popupText.substring(0, 200));

    // Click first option (checkbox or radio)
    const firstOpt = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      for (const inp of inputs) {
        if (inp.offsetParent !== null) {
          let parent = inp.parentElement;
          while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
          if (parent) {
            parent.click();
            return parent.textContent.trim().substring(0, 100);
          }
        }
      }
      return null;
    });
    console.log(`  Backlog optie geselecteerd: "${firstOpt}"`);
    await page.waitForTimeout(2000);

    // Close popup
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    await ss(page, 'Z01-BB2-04-backlog-done');
  }

  // === STATUS CHECK ===
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-BB2-05-status');
  const statusText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nStatus:', statusText.substring(0, 800));

  // === CONTINUE ===
  const continueEnabled = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.textContent.trim() === 'Continue' && !btn.disabled && btn.getAttribute('data-disabled') !== 'true') {
        return true;
      }
    }
    return false;
  });

  if (continueEnabled) {
    const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
    await continueBtn.click({ force: true });
    console.log('  Continue geklikt!');
    await page.waitForTimeout(8000);
    await ss(page, 'Z01-BB2-06-continued');

    // Test trigger
    const testBtn = page.locator('button').filter({ hasText: /Test trigger|Test step/i }).first();
    if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await testBtn.click();
      console.log('  Test trigger geklikt!');
      await page.waitForTimeout(15000);
      await ss(page, 'Z01-BB2-07-tested');
    }
  } else {
    console.log('  Continue niet enabled');
  }

  await ss(page, 'Z01-BB2-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
