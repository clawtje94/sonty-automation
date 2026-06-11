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

  // Click the expand/fullscreen icon (↗) on the panel
  // It's near the X close button in the top-right of the panel
  try {
    const expandBtn = await page.$('[aria-label="Expand"], [aria-label="Fullscreen"], [class*="expand"], [class*="Expand"]');
    if (expandBtn) {
      await expandBtn.click();
      await page.waitForTimeout(2000);
      console.log('Expanded panel');
    } else {
      // Try clicking by coordinates near the X button
      // From screenshots: X is at ~1100,63. Expand icon should be left of X at ~1075,63
      await page.mouse.click(1075, 63);
      await page.waitForTimeout(2000);
      console.log('Clicked expand area');
    }
  } catch(e) {}

  await page.screenshot({ path: '/tmp/zap-expanded.png' });

  // Now scroll the panel to find Reuzenpanda fields - they start with "R" alphabetically
  // The fields are in HubSpot deal property order
  let found = false;
  for (let i = 0; i < 60; i++) {
    // Check if Reuzenpanda label is visible
    const rpLabel = await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) {
          return l.textContent.trim();
        }
      }
      return null;
    });

    if (rpLabel) {
      console.log('Found: ' + rpLabel);
      found = true;
      await page.screenshot({ path: '/tmp/zap-found-rp.png' });
      break;
    }

    // Scroll the panel down
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.height > 300 && (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
            d.scrollHeight > d.clientHeight + 20) {
          d.scrollTop += 120;
        }
      });
    });
    await page.waitForTimeout(100);
  }

  if (found) {
    // Now fill the fields
    // Get positions of all Reuzenpanda labels and their editors
    const rpFields = await page.evaluate(() => {
      const results = [];
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) {
          const r = l.getBoundingClientRect();
          results.push({ text: l.textContent.trim(), y: r.y, x: r.x });
        }
      }
      return results;
    });

    console.log('Reuzenpanda fields:', rpFields.map(f => f.text).join(' | '));

    for (const field of rpFields) {
      console.log('\nFilling: ' + field.text);

      // The editor is below the label, and the + button is to the right
      // Click the + button for this field
      const plusY = field.y + 35; // Editor is ~35px below label
      const plusX = field.x > 800 ? field.x + 380 : 1075; // + button at far right

      // First click the editor to focus it
      await page.mouse.click(field.x + 100, plusY);
      await page.waitForTimeout(300);

      if (field.text.includes('omschrijving')) {
        // Click + and select Description
        await page.mouse.click(plusX, plusY);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: '/tmp/zap-plus-omschr.png' });

        // Type in picker search
        await page.keyboard.type('Description');
        await page.waitForTimeout(1500);

        // Click first Description result
        const descItem = await page.$('text=Description >> nth=0');
        if (descItem) {
          await descItem.click({ force: true });
          console.log('  Selected Description ✅');
          await page.waitForTimeout(500);
        }
      } else if (field.text.includes('Lead ID')) {
        await page.mouse.click(plusX, plusY);
        await page.waitForTimeout(1500);
        await page.keyboard.type('ID');
        await page.waitForTimeout(1500);

        // Click ID under step 1
        const idItems = await page.$$('text=/^ID /');
        for (const item of idItems) {
          const rect = await item.boundingBox();
          if (rect && rect.y > 100) {
            await item.click({ force: true });
            console.log('  Selected ID ✅');
            break;
          }
        }
        await page.waitForTimeout(500);
      } else if (field.text.includes('link')) {
        // Type URL prefix first
        await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=', { delay: 5 });

        // Then click + for ID
        await page.mouse.click(plusX, plusY);
        await page.waitForTimeout(1500);
        await page.keyboard.type('ID');
        await page.waitForTimeout(1500);

        const idItems = await page.$$('text=/^ID /');
        for (const item of idItems) {
          const rect = await item.boundingBox();
          if (rect && rect.y > 100) {
            await item.click({ force: true });
            console.log('  Selected ID for link ✅');
            break;
          }
        }
        await page.waitForTimeout(500);
      }
    }
  } else {
    console.log('Reuzenpanda fields NOT found after scrolling');
    // Take screenshot of where we ended up
    await page.screenshot({ path: '/tmp/zap-scroll-end.png' });

    // List all visible labels at this scroll position
    const visLabels = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label'))
        .filter(l => l.offsetHeight > 0)
        .map(l => l.textContent.trim())
        .filter(t => t.length > 3 && t.length < 100);
    });
    console.log('Visible labels:', visLabels.join(' | '));
  }

  // Publish
  console.log('\nPublishing...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.trim() === 'Publish') { b.click(); return; } }
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap-final.png' });

  await ctx.close();
  console.log('Done');
})().catch(console.error);
