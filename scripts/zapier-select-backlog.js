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
  console.log('🎬 ZAP-01 Backlog selecteren + Continue');

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

  // Verify Profile and Board are set
  const status = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      profile: text.includes('Sonty B.V.'),
      board: text.includes('Leads') && !text.includes('Select a Board*\nChoose value'),
    };
  });
  console.log('Profile:', status.profile, 'Board:', status.board);

  // Click the Backlog dropdown
  console.log('\n--- Backlog ---');
  // Find the first non-disabled button with "Choose value"
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
    await page.mouse.click(1041, backlogY);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-BL-01-popup');

    // The popup has a radio with "Leads" - click it by clicking on the text "Leads" inside the popup
    // The popup is a modal overlay - let's click on "Leads" text
    const leadsInPopup = page.locator('text=Leads').filter({ hasText: 'ID:' }).first()
      .or(page.locator('text=Leads').nth(0));

    // Better: look for the row that contains both "Leads" and "ID:"
    const popupRow = page.evaluate(() => {
      const items = document.querySelectorAll('*');
      for (const el of items) {
        if (el.textContent.includes('Leads') && el.textContent.includes('ID:') &&
            el.textContent.includes('0815a228') && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 200 && rect.width < 500 && rect.height > 30 && rect.height < 100) {
            el.click();
            return `Clicked at ${rect.x},${rect.y} size ${rect.width}x${rect.height}`;
          }
        }
      }
      return 'not found';
    });
    console.log('  Row click:', await popupRow);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-BL-02-clicked');

    // Check if it was selected
    const selected = await page.evaluate(() => {
      return !document.body.innerText.includes('Select value for Select Backlog');
    });
    console.log('  Popup gesloten:', selected);

    if (!selected) {
      // The popup might still be open - try clicking the radio circle directly
      // The radio is at approximately x=534, y=453 based on the screenshot
      console.log('  Probeer directe radio klik...');
      await page.mouse.click(534, 453);
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-BL-03-radio-click');
    }
  }

  await page.waitForTimeout(2000);
  await ss(page, 'Z01-BL-04-status');

  const formStatus = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nStatus:', formStatus.substring(0, 800));

  // Try Continue
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const disabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
    if (!disabled) {
      await continueBtn.click({ force: true });
      console.log('  Continue geklikt!');
      await page.waitForTimeout(8000);
      await ss(page, 'Z01-BL-05-continued');

      // Test trigger
      const testBtn = page.locator('button').filter({ hasText: /Test trigger/i });
      if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await testBtn.click();
        console.log('  Test trigger geklikt!');
        await page.waitForTimeout(15000);
        await ss(page, 'Z01-BL-06-tested');
      }

      // Skip test if visible
      const skipTest = page.locator('button').filter({ hasText: /Skip test/i });
      if (await skipTest.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipTest.click();
        console.log('  Skip test geklikt');
        await page.waitForTimeout(3000);
      }
    } else {
      console.log('  Continue disabled');
    }
  }

  await ss(page, 'Z01-BL-final');
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
