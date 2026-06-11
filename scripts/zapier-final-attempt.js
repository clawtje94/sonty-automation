const { chromium } = require('playwright');

(async () => {
  const dir = '/tmp/zapier-fin-' + Date.now();
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Login
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  let btns = await page.$$('button');
  for (const b of btns) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(4000);
  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  btns = await page.$$('button');
  for (const b of btns) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(12000);
  if (page.url().includes('login')) { console.log('Login failed'); await ctx.close(); return; }
  console.log('Logged in');

  // Go to ZAP-01 and open step 3 Configure
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);

  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);
  console.log('Step 3 Configure open');

  // Find the scrollable container in the right panel
  const scrollContainerId = await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const d of divs) {
      const r = d.getBoundingClientRect();
      const s = window.getComputedStyle(d);
      if (r.left > 450 && r.height > 300 &&
          (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
          d.scrollHeight > d.clientHeight + 100) {
        d.id = d.id || 'scroll-target-' + Math.random().toString(36).substr(2, 9);
        return { id: d.id, scrollHeight: d.scrollHeight, clientHeight: d.clientHeight };
      }
    }
    return null;
  });

  console.log('Scroll container:', scrollContainerId);

  if (scrollContainerId) {
    // Scroll ALL the way down to find the R-section (Reuzenpanda)
    const totalScroll = scrollContainerId.scrollHeight;
    console.log('Total scroll height:', totalScroll);

    // Scroll in chunks, checking for RP fields each time
    for (let pos = 0; pos < totalScroll; pos += 200) {
      await page.evaluate(({ id, pos }) => {
        const el = document.getElementById(id);
        if (el) el.scrollTop = pos;
      }, { id: scrollContainerId.id, pos });
      await page.waitForTimeout(100);

      const rpFound = await page.evaluate(() => {
        const labels = document.querySelectorAll('label');
        for (const l of labels) {
          if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) {
            return l.textContent.trim();
          }
        }
        return null;
      });

      if (rpFound) {
        console.log('Found RP field at scroll pos ' + pos + ': ' + rpFound);

        // Collect ALL RP fields
        const allRp = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('label'))
            .filter(l => l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0)
            .map(l => l.textContent.trim());
        });
        console.log('All RP fields:', allRp.join(' | '));
        await page.screenshot({ path: '/tmp/zfa-found.png' });

        // Fill each field
        for (const fieldText of allRp) {
          const fieldName = fieldText.toLowerCase();
          console.log('\nFilling: ' + fieldText);

          // Scroll to this specific field
          await page.evaluate((text) => {
            const labels = document.querySelectorAll('label');
            for (const l of labels) {
              if (l.textContent.trim() === text) l.scrollIntoView({ block: 'center' });
            }
          }, fieldText);
          await page.waitForTimeout(300);

          // Get the input position (below the label)
          const inputPos = await page.evaluate((text) => {
            const labels = document.querySelectorAll('label');
            for (const l of labels) {
              if (l.textContent.trim() === text) {
                const r = l.getBoundingClientRect();
                return { x: r.x, y: r.y + r.height + 15, width: r.width };
              }
            }
            return null;
          }, fieldText);

          if (!inputPos) continue;

          if (fieldName.includes('omschrijving')) {
            // Click + button (far right of input)
            await page.mouse.click(inputPos.x + 420, inputPos.y);
            await page.waitForTimeout(1500);
            await page.keyboard.type('Description');
            await page.waitForTimeout(1500);
            await page.screenshot({ path: '/tmp/zfa-desc-picker.png' });
            try {
              // Click first Description result
              const items = await page.$$('text=Description');
              for (const item of items) {
                const r = await item.boundingBox();
                if (r && r.x < 500 && r.y > 80) {
                  await item.click({ force: true });
                  console.log('  ✅');
                  break;
                }
              }
            } catch(e) { console.log('  ❌'); }
            await page.mouse.click(700, 300);
            await page.waitForTimeout(500);

          } else if (fieldName.includes('lead id')) {
            await page.mouse.click(inputPos.x + 420, inputPos.y);
            await page.waitForTimeout(1500);
            await page.keyboard.type('ID');
            await page.waitForTimeout(1500);
            try {
              const items = await page.$$('text=/^ID /');
              if (items[0]) { await items[0].click({ force: true }); console.log('  ✅'); }
            } catch(e) { console.log('  ❌'); }
            await page.mouse.click(700, 300);
            await page.waitForTimeout(500);

          } else if (fieldName.includes('link')) {
            await page.mouse.click(inputPos.x + 10, inputPos.y);
            await page.waitForTimeout(300);
            await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=', { delay: 3 });
            // Add ID
            await page.mouse.click(inputPos.x + 420, inputPos.y);
            await page.waitForTimeout(1500);
            await page.keyboard.type('ID');
            await page.waitForTimeout(1500);
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
  }

  // PUBLISH using the working method
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
    try {
      const inp = await dialog.$('input');
      if (inp) await inp.fill('v-rp-fields');
    } catch(e) {}
    const dBtns = await dialog.$$('button');
    for (const btn of dBtns) {
      if ((await btn.textContent()).trim() === 'Publish') {
        await btn.click();
        console.log('PUBLISHED!');
        break;
      }
    }
    await page.waitForTimeout(5000);
  } else {
    console.log('No dialog');
  }

  await page.screenshot({ path: '/tmp/zfa-final.png' });
  const status = await page.evaluate(() => document.body.innerText.includes('Draft') ? 'DRAFT' : 'PUBLISHED');
  console.log('Status:', status);

  await ctx.close();
})().catch(console.error);
