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
  console.log('🎬 ZAP-01 Step 4 finish');

  await page.goto('https://zapier.com/editor/353405789/draft/_GEN_1773140876863/fields', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Scroll to bottom of config panel
  await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const d of divs) {
      const rect = d.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && d.scrollHeight > d.clientHeight + 50) {
        d.scrollTop = d.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-FIN4-01-scrolled');

  // Find all remaining "Choose value" buttons (visible, in right panel)
  const chooseBtns = await page.evaluate(() => {
    const spans = document.querySelectorAll('*');
    const results = [];
    for (const el of spans) {
      if (el.textContent.trim() === 'Choose value…' && el.children.length === 0 && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        if (rect.left > 800 && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= 800) {
          results.push({
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            tag: el.tagName
          });
        }
      }
    }
    return results;
  });
  console.log('Visible Choose value:', JSON.stringify(chooseBtns));

  for (let i = 0; i < chooseBtns.length; i++) {
    const btn = chooseBtns[i];
    console.log(`\n--- Dropdown ${i+1} op (${btn.x}, ${btn.y}) ---`);
    await page.mouse.click(btn.x, btn.y);
    await page.waitForTimeout(3000);
    await ss(page, `Z01-FIN4-02-dropdown${i+1}`);

    // Get popup content
    const popupText = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('Select value for')) {
        const idx = text.indexOf('Select value for');
        return text.substring(idx, idx + 500);
      }
      return 'no popup';
    });
    console.log('Popup:', popupText.substring(0, 200));

    if (popupText !== 'no popup') {
      // Find first radio and click it (usually the default/most common option)
      const radios = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="radio"]'))
          .filter(i => i.offsetParent !== null)
          .map(i => {
            const rect = i.getBoundingClientRect();
            return {
              x: Math.round(rect.x + rect.width/2),
              y: Math.round(rect.y + rect.height/2),
              val: i.value
            };
          });
      });
      console.log('Radios:', radios.map(r => r.val));

      // For "Type of the association" - should be "deal_to_contact" or similar
      const dealContact = radios.find(r =>
        r.val.includes('deal_to_contact') || r.val.includes('contact') || r.val.includes('default')
      );
      if (dealContact) {
        await page.mouse.click(dealContact.x, dealContact.y);
        console.log(`  Geselecteerd: ${dealContact.val}`);
      } else if (radios.length > 0) {
        await page.mouse.click(radios[0].x, radios[0].y);
        console.log(`  Eerste optie geselecteerd: ${radios[0].val}`);
      }
      await page.waitForTimeout(3000);
    }

    // Check if we also need "From Object ID"
    // Scroll again to see new fields
    await page.evaluate(() => {
      const divs = document.querySelectorAll('div');
      for (const d of divs) {
        const rect = d.getBoundingClientRect();
        if (rect.left > 800 && rect.width > 200 && d.scrollHeight > d.clientHeight + 50) {
          d.scrollTop = d.scrollHeight;
        }
      }
    });
    await page.waitForTimeout(1000);
  }

  // Check if there's a "From Object ID" or similar field that needs to be filled
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-FIN4-03-after-all');

  const panelText = await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const d of divs) {
      const rect = d.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && rect.height > 300) {
        return d.innerText;
      }
    }
    return document.body.innerText;
  });
  console.log('Panel:', panelText.substring(0, 1000));

  // Check for "From Object ID" field
  if (panelText.includes('From Object') || panelText.includes('from object')) {
    console.log('\n--- From Object ID invullen ---');
    // This should be mapped to the contact ID from step 2
    // Look for input fields that are empty and in the right panel
    const emptyInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
      const results = [];
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        if (rect.left > 800 && rect.width > 50) {
          results.push({
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            value: inp.value || inp.textContent || '',
            placeholder: inp.placeholder || '',
            tag: inp.tagName,
            label: ''
          });
        }
      }
      return results;
    });
    console.log('Lege inputs in panel:', JSON.stringify(emptyInputs.slice(0, 5)));
  }

  // Try Continue
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
    console.log('Continue geklikt!');
    await page.waitForTimeout(5000);

    const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      console.log('Test geskipt!');
      await page.waitForTimeout(3000);
    }
    await ss(page, 'Z01-FIN4-04-done');
  } else {
    console.log('Continue nog disabled');
    // Check what's still missing
    const missingFields = await page.evaluate(() => {
      const text = document.body.innerText;
      const chooseCount = (text.match(/Choose value…/g) || []).length;
      return { chooseCount, hasFinish: text.includes('finish required') };
    });
    console.log('Missing:', JSON.stringify(missingFields));
  }

  await ss(page, 'Z01-FIN4-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
