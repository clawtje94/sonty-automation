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
  console.log('🎬 ZAP-01 Step 4 veld invullen');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Open step 4
  await page.mouse.dblclick(660, 590);
  await page.waitForTimeout(5000);

  // Scroll down to see "Type of objects the from object is being associated with"
  // This should be a dropdown - need to select "contact"
  await ss(page, 'Z01-S4-01-open');

  // Check current page state for step 4
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Step 4 status:', text.substring(0, 800));

  // Find the "Choose value" dropdown for the association type
  const chooseBtn = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
    }
    return null;
  });

  if (chooseBtn) {
    console.log(`  Dropdown at (${Math.round(chooseBtn.x)}, ${Math.round(chooseBtn.y)})`);
    await page.mouse.click(chooseBtn.x, chooseBtn.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-S4-02-dropdown');

    // Look for "contact" option
    const options = await page.evaluate(() => {
      const items = document.querySelectorAll('*');
      const results = [];
      for (const el of items) {
        if (el.offsetParent === null) continue;
        const rect = el.getBoundingClientRect();
        // Look in popup area
        if (rect.x < 400 || rect.x > 900) continue;
        if (rect.height < 20 || rect.height > 100) continue;
        if (rect.width < 100 || rect.width > 600) continue;

        const text = el.textContent.trim();
        if (text.includes('contact') || text.includes('Contact')) {
          results.push({
            text: text.substring(0, 100),
            tag: el.tagName,
            x: Math.round(rect.x + rect.width/2),
            y: Math.round(rect.y + rect.height/2)
          });
        }
      }
      return results;
    });
    console.log('Contact opties:', JSON.stringify(options.slice(0, 5)));

    // Also check for radio inputs
    const radioInfo = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="radio"]');
      const results = [];
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        if (rect.x < 400 || rect.x > 900) continue;
        let parent = inp.parentElement;
        let text = '';
        for (let i = 0; i < 5; i++) {
          if (parent) {
            text = parent.textContent.trim();
            parent = parent.parentElement;
          }
        }
        results.push({
          x: Math.round(rect.x + rect.width/2),
          y: Math.round(rect.y + rect.height/2),
          value: inp.value,
          text: text.substring(0, 100)
        });
      }
      return results;
    });
    console.log('Radio buttons:', JSON.stringify(radioInfo));

    // Click the "contact" radio
    for (const radio of radioInfo) {
      if (radio.text.toLowerCase().includes('contact') || radio.value.toLowerCase().includes('contact')) {
        console.log(`  Klik contact radio (${radio.x}, ${radio.y})`);
        await page.mouse.click(radio.x, radio.y);
        await page.waitForTimeout(3000);
        break;
      }
    }

    // If no radio found, try clicking first option
    if (radioInfo.length > 0 && !radioInfo.some(r => r.text.toLowerCase().includes('contact'))) {
      // Check all available options text
      const allRadioTexts = radioInfo.map(r => r.text);
      console.log('  Alle opties:', allRadioTexts);

      // Click first one
      await page.mouse.click(radioInfo[0].x, radioInfo[0].y);
      await page.waitForTimeout(3000);
    }

    await ss(page, 'Z01-S4-03-selected');
  } else {
    console.log('  Geen Choose value dropdown gevonden');
    // Scroll down to find it
    await page.evaluate(() => {
      const panel = document.querySelector('[class*="panel"]');
      if (panel) panel.scrollTop += 300;
    });
    await page.waitForTimeout(2000);
    await ss(page, 'Z01-S4-02b-scrolled');
  }

  // Check if Continue is now available
  const continueEnabled = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.textContent.trim() === 'Continue' && !btn.disabled) return true;
    }
    return false;
  });

  if (continueEnabled) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    await btn.click({ force: true });
    console.log('  Continue geklikt!');
    await page.waitForTimeout(5000);

    // Skip test
    const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      console.log('  Test geskipt');
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'Z01-S4-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 800));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
