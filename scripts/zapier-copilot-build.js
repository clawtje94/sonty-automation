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

  // The Copilot should still have the pending request
  // Click "Build" to execute
  try {
    await page.click('text=Build >> nth=-1', { timeout: 5000 });
    console.log('Clicked Build');
    await page.waitForTimeout(20000); // Wait for Copilot to make changes
    await page.screenshot({ path: '/tmp/zap01-copilot-building.png' });
  } catch(e) {
    console.log('Build button not found, re-sending request...');

    // Re-send the Copilot request
    const textareas = await page.$$('textarea');
    for (const ta of textareas) {
      const rect = await ta.boundingBox();
      if (rect && rect.y > 600) {
        await ta.click();
        await ta.fill('In step 3 "Create Deal", set "Reuzenpanda omschrijving" to Description from step 1, set "Reuzenpanda offerte link" to "https://hub.reuzenpanda.nl/app/deals/pipeline?item=" + ID from step 1, and set "Reuzenpanda Lead ID" to ID from step 1');
        await page.waitForTimeout(500);

        // Click Build (the checkmark icon)
        try {
          // Look for the Build/Send button near the textarea
          const sendBtns = await page.$$('button');
          for (const btn of sendBtns) {
            const btnRect = await btn.boundingBox();
            const text = (await btn.textContent()).trim();
            if (btnRect && btnRect.y > 700 && (text === 'Build' || text === '▷ Build' || text.includes('Build'))) {
              await btn.click();
              console.log('Clicked Build button');
              break;
            }
          }
        } catch(e2) {
          // Try pressing Enter
          await page.keyboard.press('Enter');
        }

        await page.waitForTimeout(20000);
        await page.screenshot({ path: '/tmp/zap01-copilot-retry.png' });
        break;
      }
    }
  }

  // Check what Copilot did
  await page.screenshot({ path: '/tmp/zap01-after-copilot.png' });

  // Check if fields were filled by clicking step 3 Configure
  await page.click('text=Create Deal');
  await page.waitForTimeout(2000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Scroll down to see the Reuzenpanda fields
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
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: '/tmp/zap01-check-fields.png' });

  // Get all field values to verify
  const fieldValues = await page.evaluate(() => {
    const results = [];
    const labels = document.querySelectorAll('label');
    labels.forEach(l => {
      const text = l.textContent.trim();
      if (text.toLowerCase().includes('reuzenpanda') || text.toLowerCase().includes('reuzen')) {
        // Find the next input/editor
        const parent = l.closest('div');
        const editor = parent?.querySelector('[data-slate-editor], [contenteditable], input');
        const value = editor?.textContent || editor?.value || 'empty';
        results.push({ label: text, value: value.substring(0, 100) });
      }
    });
    return results;
  });

  console.log('\nReuzenpanda field values:');
  fieldValues.forEach(f => console.log('  ' + f.label + ': ' + f.value));

  // Publish
  console.log('\nPublishing...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.trim() === 'Publish') { b.click(); return; }
    }
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap01-final-state.png' });

  await ctx.close();
  console.log('Done');
})().catch(console.error);
