const { chromium } = require('playwright');

(async () => {
  const dir = '/tmp/zapier-final-' + Date.now();
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Login
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

  const cap = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap > 0) { console.log('CAPTCHA'); await ctx.close(); return; }

  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  const b1 = await page.$$('button');
  for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(4000);

  const cap2 = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap2 > 0) { console.log('CAPTCHA after email'); await ctx.close(); return; }

  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  const b2 = await page.$$('button');
  for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(12000);

  if (page.url().includes('login')) { console.log('Login failed'); await ctx.close(); return; }
  console.log('Logged in');

  // Go to ZAP-01
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);
  console.log('URL:', page.url());

  // Check if there's a draft
  const hasDraft = await page.evaluate(() => document.body.innerText.includes('Draft') || document.body.innerText.includes('Has Draft'));
  console.log('Has draft:', hasDraft);

  if (!hasDraft) {
    // Need to create a new draft by editing step 3
    console.log('No draft — editing step 3 to add fields...');

    // Click step 3
    await page.click('text=Create Deal');
    await page.waitForTimeout(3000);

    // Click the pencil/edit icon
    try {
      const editBtns = await page.$$('[aria-label="Edit"], [class*="edit"]');
      for (const btn of editBtns) {
        const rect = await btn.boundingBox();
        if (rect && rect.y > 400 && rect.y < 600) { // Near step 3
          await btn.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
    } catch(e) {}

    // Click Configure
    try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
    await page.waitForTimeout(2000);

    // Scroll to find Reuzenpanda fields
    let found = false;
    for (let i = 0; i < 60; i++) {
      const rpField = await page.evaluate(() => {
        const labels = document.querySelectorAll('label');
        for (const l of labels) {
          if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) {
            return l.textContent.trim();
          }
        }
        return null;
      });
      if (rpField) { found = true; console.log('Found:', rpField); break; }
      await page.evaluate(() => {
        document.querySelectorAll('div').forEach(d => {
          const r = d.getBoundingClientRect();
          const s = window.getComputedStyle(d);
          if (r.height > 300 && (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 20) {
            d.scrollTop += 80;
          }
        });
      });
      await page.waitForTimeout(80);
    }

    if (found) {
      // Find ALL Reuzenpanda fields
      await page.screenshot({ path: '/tmp/zf-found.png' });

      // Get positions of the Reuzenpanda fields and their + buttons
      const rpFields = await page.evaluate(() => {
        const results = [];
        const labels = document.querySelectorAll('label');
        for (const l of labels) {
          if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) {
            const r = l.getBoundingClientRect();
            // Find the + button - it's the button after the input field
            let sibling = l.parentElement;
            const btns = sibling?.querySelectorAll('button') || [];
            let plusBtn = null;
            for (const b of btns) {
              const br = b.getBoundingClientRect();
              if (br.x > r.x + 200) { plusBtn = { x: br.x + br.width/2, y: br.y + br.height/2 }; break; }
            }
            results.push({ text: l.textContent.trim(), y: r.y, x: r.x, plusBtn });
          }
        }
        return results;
      });

      console.log('RP fields:', rpFields.map(f => f.text).join(' | '));

      for (const field of rpFields) {
        console.log('\nFilling:', field.text);

        // Scroll to make it visible
        await page.evaluate((labelText) => {
          const labels = document.querySelectorAll('label');
          for (const l of labels) {
            if (l.textContent.trim() === labelText) {
              l.scrollIntoView({ block: 'center' });
            }
          }
        }, field.text);
        await page.waitForTimeout(300);

        // Get fresh position
        const pos = await page.evaluate((labelText) => {
          const labels = document.querySelectorAll('label');
          for (const l of labels) {
            if (l.textContent.trim() === labelText) {
              const r = l.getBoundingClientRect();
              return { y: r.y + 35, x: r.x + 10 }; // Input is 35px below label
            }
          }
          return null;
        }, field.text);

        if (!pos) continue;

        const fieldName = field.text.toLowerCase();

        if (fieldName.includes('omschrijving')) {
          // Click the + button to the far right
          await page.mouse.click(pos.x + 450, pos.y);
          await page.waitForTimeout(1500);
          // Type Description in the picker search
          await page.keyboard.type('Description');
          await page.waitForTimeout(1500);
          // Click the first match
          try {
            await page.click('text=Description >> nth=0', { timeout: 2000, force: true });
            console.log('  ✅ Description selected');
          } catch(e) {
            console.log('  ❌ Description select failed');
          }
          await page.waitForTimeout(500);
          await page.mouse.click(700, 300); // Close picker

        } else if (fieldName.includes('lead id')) {
          await page.mouse.click(pos.x + 450, pos.y);
          await page.waitForTimeout(1500);
          await page.keyboard.type('ID');
          await page.waitForTimeout(1500);
          try {
            // Find "ID" under step 1 (Reuzenpanda)
            const items = await page.$$('text=/^ID /');
            if (items.length > 0) {
              await items[0].click({ force: true });
              console.log('  ✅ ID selected');
            }
          } catch(e) { console.log('  ❌ ID select failed'); }
          await page.waitForTimeout(500);
          await page.mouse.click(700, 300);

        } else if (fieldName.includes('link')) {
          // Click into the field editor
          await page.mouse.click(pos.x + 50, pos.y);
          await page.waitForTimeout(300);
          // Type the URL prefix
          await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=', { delay: 3 });
          await page.waitForTimeout(300);
          // Click + to add ID
          await page.mouse.click(pos.x + 450, pos.y);
          await page.waitForTimeout(1500);
          await page.keyboard.type('ID');
          await page.waitForTimeout(1500);
          try {
            const items = await page.$$('text=/^ID /');
            if (items.length > 0) {
              await items[0].click({ force: true });
              console.log('  ✅ Link + ID selected');
            }
          } catch(e) { console.log('  ❌ Link ID select failed'); }
          await page.waitForTimeout(500);
          await page.mouse.click(700, 300);
        }
      }
    }
  }

  // Now publish — try EVERY possible method
  console.log('\n=== Publishing ===');
  await page.screenshot({ path: '/tmp/zf-pre-publish.png' });

  // Method 1: Playwright locator with force
  try {
    await page.locator('button:has-text("Publish")').last().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(3000);
    console.log('M1: clicked');
  } catch(e) { console.log('M1: failed'); }

  // Check for dialog
  let dialog = await page.$('[role="dialog"]');
  if (dialog) {
    console.log('Dialog appeared!');
    try {
      const inp = await dialog.$('input');
      if (inp) await inp.fill('v-rp-data');
    } catch(e) {}
    try {
      const btns = await dialog.$$('button');
      for (const btn of btns) {
        if ((await btn.textContent()).trim() === 'Publish') {
          await btn.click();
          console.log('Dialog Publish clicked!');
          break;
        }
      }
    } catch(e) {}
    await page.waitForTimeout(5000);
  } else {
    // Method 2: Mouse events at Publish button position
    // From screenshots: Publish is at approximately x=1320, y=32 (top right)
    console.log('M2: mouse events at (1320, 32)');
    await page.mouse.move(1320, 32);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(3000);

    dialog = await page.$('[role="dialog"]');
    if (dialog) {
      console.log('Dialog appeared via M2!');
      try {
        const btns = await dialog.$$('button');
        for (const btn of btns) {
          if ((await btn.textContent()).trim() === 'Publish') {
            await btn.click();
            console.log('Published!');
            break;
          }
        }
      } catch(e) {}
      await page.waitForTimeout(5000);
    } else {
      // Method 3: Full event simulation with pointer events
      console.log('M3: pointer events');
      await page.evaluate(() => {
        const els = document.querySelectorAll('*');
        for (const el of els) {
          if (el.textContent.trim() === 'Publish' && el.offsetHeight > 0 && el.offsetHeight < 50) {
            const r = el.getBoundingClientRect();
            if (r.y < 80) { // Top bar
              const parent = el.closest('button, a, [role="button"]') || el;
              for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
                parent.dispatchEvent(new PointerEvent(type, {
                  bubbles: true, cancelable: true, view: window,
                  clientX: r.x + r.width/2, clientY: r.y + r.height/2,
                  pointerId: 1, pointerType: 'mouse',
                }));
              }
              return 'dispatched on ' + parent.tagName;
            }
          }
        }
        return 'not found';
      });
      await page.waitForTimeout(5000);

      dialog = await page.$('[role="dialog"]');
      if (dialog) {
        console.log('Dialog via M3!');
        await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]');
          if (d) d.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Publish') b.click(); });
        });
        await page.waitForTimeout(5000);
      }
    }
  }

  await page.screenshot({ path: '/tmp/zf-final.png' });
  const status = await page.evaluate(() => document.body.innerText.includes('Draft') ? 'DRAFT' : 'PUBLISHED');
  console.log('Final status:', status);

  await ctx.close();
  console.log('Done');
})().catch(console.error);
