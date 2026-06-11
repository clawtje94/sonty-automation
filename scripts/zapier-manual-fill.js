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

  // Click step 3 → Configure
  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Find the "Search fields" input in the right panel
  const searchInputs = await page.$$('input[placeholder="Search fields"]');
  let searchBox = null;
  for (const inp of searchInputs) {
    const rect = await inp.boundingBox();
    if (rect && rect.left > 450) {
      searchBox = inp;
      console.log('Found Search fields box at', Math.round(rect.x), Math.round(rect.y));
      break;
    }
  }

  if (!searchBox) {
    console.log('Search fields box not found');
    await page.screenshot({ path: '/tmp/zap-manual-nosearch.png' });
    await ctx.close();
    return;
  }

  // Helper: fill a field by searching for it, then clicking + and selecting data
  async function fillField(fieldLabel, dataPath) {
    console.log('\n--- Filling: ' + fieldLabel + ' ---');

    // Search for the field
    await searchBox.click({ clickCount: 3 });
    await searchBox.fill(fieldLabel);
    await page.waitForTimeout(2000);

    // Find the editable Slate field
    const editors = await page.$$('[data-slate-editor="true"]');
    let targetEditor = null;
    for (const ed of editors) {
      const rect = await ed.boundingBox();
      if (rect && rect.left > 450 && rect.width > 100) {
        targetEditor = ed;
        break;
      }
    }

    if (!targetEditor) {
      console.log('No editor found for ' + fieldLabel);
      await page.screenshot({ path: '/tmp/zap-manual-nofield-' + fieldLabel.replace(/ /g, '_') + '.png' });
      return false;
    }

    // Click into the editor
    await targetEditor.click();
    await page.waitForTimeout(300);

    // Type the static part first (for link)
    if (dataPath.startsWith('STATIC:')) {
      const parts = dataPath.split('|');
      const staticPart = parts[0].replace('STATIC:', '');
      const dynamicPart = parts[1];

      // Type the static URL prefix
      await page.keyboard.type(staticPart, { delay: 10 });
      await page.waitForTimeout(300);

      // Now insert dynamic data
      // In Zapier, typing {{ opens the data picker inline
      // But we can also click the + button
      const plusBtns = await page.$$('button');
      for (const btn of plusBtns) {
        const rect = await btn.boundingBox();
        const targetRect = await targetEditor.boundingBox();
        if (rect && targetRect &&
            Math.abs(rect.y - targetRect.y) < 30 &&
            rect.x > targetRect.x + targetRect.width - 60) {
          await btn.click();
          await page.waitForTimeout(1500);
          console.log('Clicked + for data picker');

          // Type search in data picker
          const pickerInputs = await page.$$('input');
          for (const pi of pickerInputs) {
            const piRect = await pi.boundingBox();
            if (piRect && piRect.x < 450 && piRect.y > 50) {
              await pi.fill(dynamicPart);
              await page.waitForTimeout(1000);
              break;
            }
          }

          // Click the matching result
          try {
            // Find the ID option under step 1 (Reuzenpanda)
            const options = await page.$$('[class*="option"], [role="option"], [class*="item"]');
            for (const opt of options) {
              const text = await opt.textContent();
              if (text.includes('ID') && !text.includes('Backlog') && !text.includes('Subject') && !text.includes('Company')) {
                const optRect = await opt.boundingBox();
                if (optRect && optRect.x < 400) {
                  await opt.click();
                  await page.waitForTimeout(500);
                  console.log('Selected: ' + text.trim().substring(0, 50));
                  break;
                }
              }
            }
          } catch(e) {}
          break;
        }
      }
    } else {
      // Just insert dynamic data via +
      const plusBtns = await page.$$('button');
      for (const btn of plusBtns) {
        const rect = await btn.boundingBox();
        const targetRect = await targetEditor.boundingBox();
        if (rect && targetRect &&
            Math.abs(rect.y - targetRect.y) < 30 &&
            rect.x > targetRect.x + targetRect.width - 60) {
          await btn.click();
          await page.waitForTimeout(1500);

          // Search in data picker
          const pickerInputs = await page.$$('input');
          for (const pi of pickerInputs) {
            const piRect = await pi.boundingBox();
            if (piRect && piRect.x < 450 && piRect.y > 50) {
              await pi.fill(dataPath);
              await page.waitForTimeout(1500);
              break;
            }
          }

          await page.screenshot({ path: '/tmp/zap-picker-' + fieldLabel.replace(/ /g, '_') + '.png' });

          // Click the first matching result
          try {
            const results = await page.$$('[class*="option"], [role="option"], [class*="item"]');
            for (const r of results) {
              const text = await r.textContent();
              if (text.toLowerCase().includes(dataPath.toLowerCase().substring(0, 5))) {
                const rRect = await r.boundingBox();
                if (rRect && rRect.x < 450) {
                  await r.click();
                  await page.waitForTimeout(500);
                  console.log('Selected: ' + text.trim().substring(0, 60));
                  break;
                }
              }
            }
          } catch(e) {}
          break;
        }
      }
    }

    await page.screenshot({ path: '/tmp/zap-filled-' + fieldLabel.replace(/ /g, '_') + '.png' });
    return true;
  }

  // Fill the 3 fields
  await fillField('Reuzenpanda omschrijving', 'Description');
  await fillField('Reuzenpanda Lead ID', 'ID');
  await fillField('Reuzenpanda offerte link', 'STATIC:https://hub.reuzenpanda.nl/app/deals/pipeline?item=|ID');

  // Clear search and scroll up
  await searchBox.click({ clickCount: 3 });
  await searchBox.fill('');
  await page.waitForTimeout(500);

  // Continue + Publish
  try {
    await page.click('button:has-text("Continue")', { timeout: 3000 });
    await page.waitForTimeout(2000);
  } catch(e) {}

  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.trim() === 'Publish') { b.click(); return; } }
  });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: '/tmp/zap-manual-final.png' });
  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
