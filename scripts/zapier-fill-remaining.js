const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile6', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    let b = await page.$$('button');
    for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
    await page.waitForTimeout(4000);
    await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
    b = await page.$$('button');
    for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
    await page.waitForTimeout(12000);
    await page.goto('https://zapier.com/editor/353405789/draft');
    await page.waitForTimeout(8000);
  }

  console.log('On editor');

  // Click step 3 Configure
  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Scroll to find ALL Reuzenpanda fields — scroll incrementally and collect them
  const allRpFields = [];
  for (let i = 0; i < 80; i++) {
    const newFields = await page.evaluate(() => {
      const results = [];
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        const text = l.textContent.trim();
        if (text.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) {
          const r = l.getBoundingClientRect();
          results.push({ text, y: Math.round(r.y), x: Math.round(r.x) });
        }
      }
      return results;
    });

    for (const f of newFields) {
      if (!allRpFields.find(e => e.text === f.text)) {
        allRpFields.push(f);
        console.log('Found: ' + f.text + ' at y=' + f.y);
      }
    }

    // Stop scrolling once we've found all 3 or passed the R section
    if (allRpFields.length >= 3) break;

    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.height > 300 && (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
            d.scrollHeight > d.clientHeight + 20) {
          d.scrollTop += 80;
        }
      });
    });
    await page.waitForTimeout(80);
  }

  console.log('\nAll Reuzenpanda fields found:', allRpFields.length);
  allRpFields.forEach(f => console.log('  ' + f.text));

  // Now fill each field — scroll to it and interact
  for (const field of allRpFields) {
    // Scroll to make the field visible
    await page.evaluate((labelText) => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.textContent.trim() === labelText) {
          l.scrollIntoView({ block: 'center' });
          return;
        }
      }
    }, field.text);
    await page.waitForTimeout(500);

    // Get fresh position after scroll
    const pos = await page.evaluate((labelText) => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.textContent.trim() === labelText) {
          const r = l.getBoundingClientRect();
          return { y: r.y, x: r.x, w: r.width };
        }
      }
      return null;
    }, field.text);

    if (!pos) continue;

    const editorY = pos.y + 35;
    const fieldName = field.text.toLowerCase();

    if (fieldName.includes('omschrijving')) {
      // Check if already filled (from previous run)
      const editorContent = await page.evaluate((y) => {
        const editors = document.querySelectorAll('[data-slate-editor]');
        for (const ed of editors) {
          const r = ed.getBoundingClientRect();
          if (Math.abs(r.y - y) < 20) {
            return ed.textContent.trim();
          }
        }
        return '';
      }, editorY);

      if (editorContent && !editorContent.includes('Enter text')) {
        console.log('  omschrijving: already filled ✅');
        continue;
      }

      // Click + button and select Description
      console.log('  Filling omschrijving...');
      await page.mouse.click(pos.x + pos.w + 30, editorY);
      await page.waitForTimeout(1500);
      await page.keyboard.type('Description');
      await page.waitForTimeout(1500);
      try {
        await page.click('text=Description >> nth=0', { timeout: 2000, force: true });
        console.log('  omschrijving: ✅');
      } catch(e) { console.log('  omschrijving: selection failed'); }
      await page.waitForTimeout(500);

    } else if (fieldName.includes('lead id')) {
      console.log('  Filling Lead ID...');
      await page.mouse.click(pos.x + pos.w + 30, editorY);
      await page.waitForTimeout(1500);
      await page.keyboard.type('ID');
      await page.waitForTimeout(1500);
      // Click the first "ID" result
      try {
        const items = await page.$$('text=/^ID /');
        if (items.length > 0) {
          await items[0].click({ force: true });
          console.log('  Lead ID: ✅');
        }
      } catch(e) { console.log('  Lead ID: selection failed'); }
      await page.waitForTimeout(500);

    } else if (fieldName.includes('link')) {
      console.log('  Filling offerte link...');
      // Click editor first
      await page.mouse.click(pos.x + 50, editorY);
      await page.waitForTimeout(300);
      await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=', { delay: 3 });
      await page.waitForTimeout(300);

      // Click + to add ID
      await page.mouse.click(pos.x + pos.w + 30, editorY);
      await page.waitForTimeout(1500);
      await page.keyboard.type('ID');
      await page.waitForTimeout(1500);
      try {
        const items = await page.$$('text=/^ID /');
        if (items.length > 0) {
          await items[0].click({ force: true });
          console.log('  link: ✅');
        }
      } catch(e) { console.log('  link: selection failed'); }
      await page.waitForTimeout(500);
    }

    // Click somewhere neutral to close any picker
    await page.mouse.click(700, 300);
    await page.waitForTimeout(300);
  }

  // Publish
  console.log('\nPublishing...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.trim() === 'Publish') { b.click(); return; } }
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap-fill-done.png' });

  await ctx.close();
  console.log('Done');
})().catch(console.error);
