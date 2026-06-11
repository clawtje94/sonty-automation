const { chromium } = require('playwright');

// ZAP-01 verbeteren: Description meesturen naar deal, naam parsen
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile5', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Check if still logged in
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    console.log('Need to login...');
    try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

    const cap = await page.locator('iframe[src*="recaptcha"]').count();
    if (cap > 0) { console.log('CAPTCHA - aborting'); await ctx.close(); return; }

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

    await page.goto('https://zapier.com/editor/353405789');
    await page.waitForTimeout(8000);
  }

  console.log('On ZAP-01 editor');
  await page.screenshot({ path: '/tmp/zap01-improve-1.png' });

  // Click "Edit Zap" if we're on the published view
  try {
    await page.click('text=Edit Zap', { timeout: 3000 });
    await page.waitForTimeout(3000);
    console.log('Switched to edit mode');
  } catch(e) {
    console.log('Already in edit mode or no Edit Zap button');
  }

  // Click Step 3: Create Deal
  console.log('\n=== Step 3: Add Description to Deal ===');
  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Scroll down in the config panel to find sonty_reuzenpanda_description field
  let foundDesc = false;
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.left > 450 && r.height > 200 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
          d.scrollTop += 150;
        }
      });
    });
    await page.waitForTimeout(150);

    // Check for description field
    const descLabel = await page.$('text=Reuzenpanda omschrijving');
    if (descLabel) {
      console.log('  Found "Reuzenpanda omschrijving" field!');
      foundDesc = true;
      await page.screenshot({ path: '/tmp/zap01-desc-found.png' });
      break;
    }

    // Also check for custom properties
    const customLabel = await page.$('text=reuzenpanda');
    if (customLabel) {
      console.log('  Found reuzenpanda-related field');
      foundDesc = true;
      await page.screenshot({ path: '/tmp/zap01-custom-found.png' });
      break;
    }
  }

  if (!foundDesc) {
    console.log('  Description field not found in visible fields');
    await page.screenshot({ path: '/tmp/zap01-no-desc.png' });

    // Get all visible labels
    const labels = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label'))
        .filter(l => l.getBoundingClientRect().left > 450 && l.getBoundingClientRect().width > 50)
        .map(l => l.textContent.trim())
        .filter(t => t.length > 2);
    });
    console.log('  Visible labels:', labels.join(' | '));
  }

  // Take final screenshot
  await page.screenshot({ path: '/tmp/zap01-improve-final.png' });

  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
