const { chromium } = require('playwright');

(async () => {
  const dir = '/tmp/zapier-debug-' + Date.now();
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  let b = await page.$$('button');
  for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
  await page.waitForTimeout(4000);
  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  b = await page.$$('button');
  for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
  await page.waitForTimeout(12000);
  if (page.url().includes('login')) { console.log('Login failed'); await ctx.close(); return; }

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  // Find EXACTLY what the Publish element is
  const publishInfo = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const results = [];
    for (const el of all) {
      if (el.textContent.trim() === 'Publish' && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.y < 100 && r.height > 0) { // Top bar only
          results.push({
            tag: el.tagName,
            class: el.className?.toString().substring(0, 80),
            id: el.id,
            role: el.getAttribute('role'),
            disabled: el.disabled,
            ariaDisabled: el.getAttribute('aria-disabled'),
            tabIndex: el.tabIndex,
            href: el.href,
            type: el.type,
            parentTag: el.parentElement?.tagName,
            parentClass: el.parentElement?.className?.toString().substring(0, 60),
            x: Math.round(r.x), y: Math.round(r.y),
            w: Math.round(r.width), h: Math.round(r.height),
          });
        }
      }
    }
    return results;
  });

  console.log('Publish elements found:', publishInfo.length);
  publishInfo.forEach(p => console.log(JSON.stringify(p, null, 2)));

  // Now try clicking the exact element found
  if (publishInfo.length > 0) {
    const p = publishInfo[0];
    console.log('\nClicking at', p.x + p.w/2, p.y + p.h/2);

    // Try pointer events
    await page.mouse.move(p.x + p.w/2, p.y + p.h/2);
    await page.waitForTimeout(500);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap-debug-click1.png' });

    // Check if dialog appeared
    const hasDialog = await page.evaluate(() =>
      document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"]') !== null
    );
    console.log('Dialog after click:', hasDialog);

    if (hasDialog) {
      // Confirm publish
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"]');
        const btns = dialog.querySelectorAll('button');
        btns.forEach(b => { if (b.textContent.trim() === 'Publish') b.click(); });
      });
      await page.waitForTimeout(5000);
      console.log('Published!');
    } else {
      // Maybe the parent element needs to be clicked
      console.log('No dialog, trying parent click...');
      await page.evaluate((info) => {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          if (el.textContent.trim() === 'Publish' && el.children.length === 0) {
            const r = el.getBoundingClientRect();
            if (Math.round(r.x) === info.x) {
              // Click the parent
              el.parentElement.click();
              el.parentElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
              el.parentElement.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
              return;
            }
          }
        }
      }, publishInfo[0]);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/zap-debug-click2.png' });

      const hasDialog2 = await page.evaluate(() =>
        document.querySelector('[role="dialog"], [class*="Modal"]') !== null
      );
      if (hasDialog2) {
        await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"], [class*="Modal"]');
          d.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Publish') b.click(); });
        });
        await page.waitForTimeout(5000);
        console.log('Published via parent!');
      }
    }
  }

  await page.screenshot({ path: '/tmp/zap-debug-final.png' });
  const status = await page.evaluate(() => document.body.innerText.includes('Draft') ? 'DRAFT' : 'PUBLISHED');
  console.log('Final:', status);

  await ctx.close();
})().catch(console.error);
