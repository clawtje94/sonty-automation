const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

  const cap = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap > 0) {
    console.log('CAPTCHA detected - waiting 60s for manual solve...');
    await page.waitForTimeout(60000);
  } else {
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    const b1 = await page.$$('button');
    for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(4000);

    await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
    const b2 = await page.$$('button');
    for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(12000);
  }

  if (page.url().includes('login')) { console.log('Login failed'); await browser.close(); return; }
  console.log('Logged in!\n');

  // Go to ZAP-01 draft — step 4
  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  // Click step 4 → Configure
  await page.click('text=Create Associations');
  await page.waitForTimeout(3000);
  await page.click('text=Configure');
  await page.waitForTimeout(2000);
  console.log('Step 4 Configure open');
  await page.screenshot({ path: '/tmp/fix-s4-1.png' });

  // Scroll to see all fields
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.left > 450 && r.height > 200 && (s.overflowY === 'auto' || s.overflowY === 'scroll'))
          d.scrollTop += 100;
      });
    });
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: '/tmp/fix-s4-2.png' });

  // Get all editors in the right panel
  const editors = await page.$$('[data-slate-editor="true"]');
  console.log('Editors:', editors.length);

  // Find editors in the right panel area
  const rightEditors = [];
  for (const ed of editors) {
    const rect = await ed.boundingBox();
    if (rect && rect.left > 450) {
      const text = await ed.textContent();
      rightEditors.push({ editor: ed, text, y: rect.y, rect });
      console.log('  y=' + Math.round(rect.y) + ': "' + text.substring(0, 50) + '"');
    }
  }

  // The toObjectIds editor is the LAST one — it contains the contact ID placeholder
  // Find it by looking at labels
  const toObjectIdsEditor = rightEditors[rightEditors.length - 1];
  if (toObjectIdsEditor) {
    console.log('\nFixing toObjectIds field (currently: "' + toObjectIdsEditor.text + '")');

    // Clear the field
    await toObjectIdsEditor.editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    console.log('Cleared field');

    // Click the + button to the right of the field
    const plusX = toObjectIdsEditor.rect.x + toObjectIdsEditor.rect.width + 25;
    const plusY = toObjectIdsEditor.rect.y + toObjectIdsEditor.rect.height / 2;
    await page.mouse.click(plusX, plusY);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/fix-s4-picker.png' });

    // In the data picker, search for the contact ID
    // Type in the search
    await page.keyboard.type('Hs Object Id');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/fix-s4-search.png' });

    // Find and click the result - look for step 2 section
    const pickerItems = await page.evaluate(() => {
      const all = document.querySelectorAll('div, span, button');
      const results = [];
      all.forEach(el => {
        const text = el.textContent.trim();
        const rect = el.getBoundingClientRect();
        if (rect.x < 500 && rect.x > 30 && rect.y > 80 &&
            text.includes('Hs Object Id') && text.length < 80 && rect.height > 10 && rect.height < 50) {
          results.push({ text: text.substring(0, 60), y: rect.y, x: rect.x, tag: el.tagName });
        }
      });
      return results;
    });
    console.log('Picker results:', pickerItems.length);
    pickerItems.forEach(p => console.log('  ' + p.tag + ' at ' + Math.round(p.x) + ',' + Math.round(p.y) + ': ' + p.text));

    // Click the first matching item
    if (pickerItems.length > 0) {
      await page.mouse.click(pickerItems[0].x + 10, pickerItems[0].y + 5);
      await page.waitForTimeout(1000);
      console.log('Clicked Hs Object Id!');
    } else {
      // Try broader search - just "Object Id"
      console.log('No exact match, trying broader search...');
      await page.keyboard.press('Meta+A');
      await page.keyboard.type('Object');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/fix-s4-search2.png' });
    }

    await page.screenshot({ path: '/tmp/fix-s4-after.png' });
  }

  // Now continue + skip test + publish
  console.log('\nPublishing...');
  try { await page.click('text=Continue', { timeout: 3000 }); await page.waitForTimeout(1000); } catch(e) {}
  try { await page.click('text=Skip test', { timeout: 3000 }); await page.waitForTimeout(1000); } catch(e) {}

  // Click Publish button at the top right
  try {
    await page.click('text=Publish', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/fix-s4-pub-dialog.png' });

    // Confirm in dialog
    const allBtns = await page.$$('button');
    for (const btn of allBtns) {
      const text = (await btn.textContent()).trim();
      const rect = await btn.boundingBox();
      if (text === 'Publish' && rect && rect.y > 200 && rect.y < 500) {
        await btn.click();
        console.log('Publish confirmed!');
        break;
      }
    }
    await page.waitForTimeout(8000);
  } catch(e) {
    console.log('Publish click failed:', e.message.substring(0, 60));
  }

  await page.screenshot({ path: '/tmp/fix-final.png' });

  const status = await page.evaluate(() => document.body.innerText.includes('Draft') ? 'DRAFT' : 'PUBLISHED');
  console.log('Status:', status);

  await browser.close();
  console.log('Done');
})().catch(console.error);
