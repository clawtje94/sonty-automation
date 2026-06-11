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
  console.log('🎬 ZAP-01 Step 4 laatste 2 velden');

  await page.goto('https://zapier.com/editor/353405789/draft/_GEN_1773140876863/fields', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Scroll to bottom
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

  // Find all visible "Choose value" spans
  let chooseSpans = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => el.textContent.trim() === 'Choose value…' && el.children.length === 0 && el.offsetParent !== null)
      .map(el => {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width/2), y: Math.round(rect.y + rect.height/2), visible: rect.top >= 0 && rect.bottom <= 800, left: rect.left };
      })
      .filter(s => s.left > 800 && s.visible);
  });
  console.log('Choose value spans:', JSON.stringify(chooseSpans));

  // === Field 1: Type of the association ===
  if (chooseSpans.length >= 1) {
    console.log('\n--- Type of the association ---');
    await page.mouse.click(chooseSpans[0].x, chooseSpans[0].y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-L2-01-assoc-type-popup');

    // Get options
    const radios = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input[type="radio"]'))
        .filter(i => i.offsetParent !== null)
        .map(i => ({ x: Math.round(i.getBoundingClientRect().x + 8), y: Math.round(i.getBoundingClientRect().y + 8), val: i.value }));
    });
    console.log('Opties:', radios.map(r => r.val));

    // Select default/first option (should be like "deal_to_contact" or similar)
    const preferred = radios.find(r => r.val.includes('deal_to_contact') || r.val.includes('default'));
    if (preferred) {
      await page.mouse.click(preferred.x, preferred.y);
      console.log(`  Geselecteerd: ${preferred.val}`);
    } else if (radios.length > 0) {
      await page.mouse.click(radios[0].x, radios[0].y);
      console.log(`  Eerste geselecteerd: ${radios[0].val}`);
    }
    await page.waitForTimeout(3000);
  }

  // Scroll again for the second field
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

  // === Field 2: Id's of the objects ===
  chooseSpans = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => el.textContent.trim() === 'Choose value…' && el.children.length === 0 && el.offsetParent !== null)
      .map(el => {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width/2), y: Math.round(rect.y + rect.height/2), visible: rect.top >= 0 && rect.bottom <= 800, left: rect.left };
      })
      .filter(s => s.left > 800 && s.visible);
  });
  console.log('\nRemaining Choose value:', JSON.stringify(chooseSpans));

  if (chooseSpans.length >= 1) {
    console.log('\n--- IDs of objects ---');
    await page.mouse.click(chooseSpans[0].x, chooseSpans[0].y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-L2-02-ids-popup');

    // This should be a multi-value field where we insert the contact ID from step 2
    // Check what kind of popup appeared
    const popupText = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('Select value for')) {
        const idx = text.indexOf('Select value for');
        return text.substring(idx, idx + 500);
      }
      return 'no popup';
    });
    console.log('Popup:', popupText.substring(0, 300));

    // If it's a data mapping field, we need to insert {{step2.id}} or similar
    // Check for Insert Data button or similar
    const insertBtn = page.locator('button').filter({ hasText: /Insert|Map|Data/ }).first();
    if (await insertBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await insertBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check for radios
    const radios2 = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input[type="radio"]'))
        .filter(i => i.offsetParent !== null)
        .map(i => ({ x: Math.round(i.getBoundingClientRect().x + 8), y: Math.round(i.getBoundingClientRect().y + 8), val: i.value }));
    });
    console.log('Radios:', radios2.map(r => r.val));

    // Find step 2 contact ID
    const step2Id = radios2.find(r =>
      r.val.includes('contact') || r.val.includes('2__') || r.val.includes('vid')
    );
    if (step2Id) {
      await page.mouse.click(step2Id.x, step2Id.y);
      console.log(`  Geselecteerd: ${step2Id.val}`);
    } else if (radios2.length > 0) {
      // Try the first option
      await page.mouse.click(radios2[0].x, radios2[0].y);
      console.log(`  Eerste geselecteerd: ${radios2[0].val}`);
    }
    await page.waitForTimeout(3000);
  }

  // Check final status
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-L2-03-status');

  const remaining = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasFinish: text.includes('finish required'),
      chooseCount: (text.match(/Choose value…/g) || []).length,
    };
  });
  console.log('Remaining:', JSON.stringify(remaining));

  // Try Continue
  if (!remaining.hasFinish || remaining.chooseCount === 0) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ force: true });
      console.log('Continue!');
      await page.waitForTimeout(5000);

      const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
      if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await skipBtn.click();
        console.log('Test geskipt!');
      }
    }
  }

  await ss(page, 'Z01-L2-final');
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
