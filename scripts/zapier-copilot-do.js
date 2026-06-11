const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-check', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Should already be on login page from previous check
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  await page.waitForTimeout(500);
  const b1 = await page.$$('button');
  for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(5000);

  await page.screenshot({ path: '/tmp/zco-pw.png' });
  const pwInput = await page.$('input[type="password"]');
  if (!pwInput) { console.log('No password field'); await ctx.close(); return; }

  await pwInput.fill('D^mR&F%82WtBrVK&fnm8');
  const b2 = await page.$$('button');
  for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(15000);

  console.log('URL:', page.url());
  if (page.url().includes('login')) {
    await page.screenshot({ path: '/tmp/zco-login-fail.png' });
    console.log('Login failed');
    await ctx.close();
    return;
  }
  console.log('LOGGED IN!');

  // Go to ZAP-01 editor
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);

  // Click step 3 and use the existing working scroll method
  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Scroll using the method that worked before
  let foundRp = false;
  for (let i = 0; i < 80; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.left > 450 && r.height > 200 &&
            (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
            d.scrollHeight > d.clientHeight + 50) {
          d.scrollTop += 150;
        }
      });
    });
    await page.waitForTimeout(100);

    const rpLabel = await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) return l.textContent.trim();
      }
      return null;
    });

    if (rpLabel) {
      console.log('Found at scroll ' + i + ':', rpLabel);
      foundRp = true;

      // Get ALL RP fields
      const allRp = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('label'))
          .filter(l => l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0)
          .map(l => l.textContent.trim());
      });
      console.log('All RP fields:', allRp.join(' | '));
      await page.screenshot({ path: '/tmp/zco-rp-found.png' });

      // Fill omschrijving: click + and select Description
      for (const ft of allRp) {
        const fn = ft.toLowerCase();
        console.log('\nFilling: ' + ft);

        await page.evaluate((text) => {
          const labels = document.querySelectorAll('label');
          for (const l of labels) {
            if (l.textContent.trim() === text) l.scrollIntoView({ block: 'center' });
          }
        }, ft);
        await page.waitForTimeout(500);

        const pos = await page.evaluate((text) => {
          const labels = document.querySelectorAll('label');
          for (const l of labels) {
            if (l.textContent.trim() === text) {
              const r = l.getBoundingClientRect();
              return { x: r.x, y: r.y + r.height + 15 };
            }
          }
          return null;
        }, ft);
        if (!pos) continue;

        if (fn.includes('omschrijving')) {
          await page.mouse.click(pos.x + 420, pos.y);
          await page.waitForTimeout(2000);
          await page.keyboard.type('Description');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: '/tmp/zco-desc-picker.png' });
          try {
            const items = await page.$$('text=Description');
            for (const item of items) {
              const r = await item.boundingBox();
              if (r && r.x < 500 && r.y > 80) { await item.click({ force: true }); console.log('  ✅'); break; }
            }
          } catch(e) { console.log('  ❌'); }
          await page.mouse.click(700, 300);
          await page.waitForTimeout(500);

        } else if (fn.includes('lead id')) {
          await page.mouse.click(pos.x + 420, pos.y);
          await page.waitForTimeout(2000);
          await page.keyboard.type('ID');
          await page.waitForTimeout(2000);
          try {
            const items = await page.$$('text=/^ID /');
            if (items[0]) { await items[0].click({ force: true }); console.log('  ✅'); }
          } catch(e) { console.log('  ❌'); }
          await page.mouse.click(700, 300);
          await page.waitForTimeout(500);

        } else if (fn.includes('link')) {
          await page.mouse.click(pos.x + 10, pos.y);
          await page.waitForTimeout(300);
          await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=', { delay: 3 });
          await page.mouse.click(pos.x + 420, pos.y);
          await page.waitForTimeout(2000);
          await page.keyboard.type('ID');
          await page.waitForTimeout(2000);
          try {
            const items = await page.$$('text=/^ID /');
            if (items[0]) { await items[0].click({ force: true }); console.log('  ✅'); }
          } catch(e) { console.log('  ❌'); }
          await page.mouse.click(700, 300);
          await page.waitForTimeout(500);
        }
      }
      break;
    }
  }

  if (!foundRp) {
    console.log('RP fields not found after scrolling');
    await page.screenshot({ path: '/tmp/zco-no-rp.png' });
  }

  // Publish
  console.log('\n=== Publishing ===');
  await page.mouse.move(1320, 32);
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(3000);

  const dialog = await page.$('[role="dialog"]');
  if (dialog) {
    console.log('Dialog!');
    try { const inp = await dialog.$('input'); if (inp) await inp.fill('v-rp-sync'); } catch(e) {}
    const dBtns = await dialog.$$('button');
    for (const btn of dBtns) {
      if ((await btn.textContent()).trim() === 'Publish') { await btn.click(); console.log('PUBLISHED!'); break; }
    }
    await page.waitForTimeout(5000);
  }

  await page.screenshot({ path: '/tmp/zco-done.png' });
  const status = await page.evaluate(() => document.body.innerText.includes('Draft') ? 'DRAFT' : 'PUBLISHED');
  console.log('Final:', status);

  await ctx.close();
})().catch(console.error);
