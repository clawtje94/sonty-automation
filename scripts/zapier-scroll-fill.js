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

  // First scroll up to find the Search fields box
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach(d => {
      const r = d.getBoundingClientRect();
      const s = window.getComputedStyle(d);
      if (r.left > 450 && r.height > 200 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
        d.scrollTop = 0; // Scroll to top
      }
    });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/zap-scroll-top.png' });

  // Now find Search fields
  const searchBox = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Search fields"]');
    for (const inp of inputs) {
      const r = inp.getBoundingClientRect();
      if (r.left > 450 && r.width > 100) {
        return { x: r.x, y: r.y, found: true };
      }
    }
    return { found: false };
  });

  if (searchBox.found) {
    console.log('Search box at', searchBox.x, searchBox.y);

    // Click the search box and search for "reuzenpanda"
    await page.mouse.click(searchBox.x + 50, searchBox.y + 10);
    await page.waitForTimeout(300);
    await page.keyboard.type('reuzenpanda');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/zap-search-rp.png' });

    // Get all visible labels after filtering
    const labels = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label'))
        .filter(l => l.getBoundingClientRect().left > 450 && l.offsetHeight > 0)
        .map(l => ({
          text: l.textContent.trim(),
          y: l.getBoundingClientRect().y
        }));
    });
    console.log('Visible labels:', labels.map(l => l.text).join(' | '));

    // Find each Reuzenpanda field and the Slate editor next to it
    // Then click the + button to insert data

    // Helper to find and click + button near a label
    async function clickPlusNearLabel(labelText) {
      const pos = await page.evaluate((text) => {
        const labels = document.querySelectorAll('label');
        for (const l of labels) {
          if (l.textContent.trim().includes(text)) {
            const r = l.getBoundingClientRect();
            return { y: r.y + r.height + 20, x: r.x }; // Position below label where the input is
          }
        }
        return null;
      }, labelText);

      if (!pos) return false;

      // The + button is at the far right of the field row
      // Click the + button (usually at x ~ 1070, same y as the field)
      await page.mouse.click(1075, pos.y + 10);
      await page.waitForTimeout(1500);
      return true;
    }

    // Fill "Reuzenpanda omschrijving" with Description from step 1
    console.log('\n--- Reuzenpanda omschrijving ---');
    if (await clickPlusNearLabel('omschrijving')) {
      await page.screenshot({ path: '/tmp/zap-plus-desc.png' });

      // In the data picker, search for "Description"
      const pickerSearch = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          const r = inp.getBoundingClientRect();
          if (r.x < 450 && r.y > 50 && r.width > 100) {
            return { x: r.x, y: r.y, found: true };
          }
        }
        return { found: false };
      });

      if (pickerSearch.found) {
        await page.mouse.click(pickerSearch.x + 50, pickerSearch.y + 10);
        await page.keyboard.type('Description');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: '/tmp/zap-picker-desc.png' });

        // Click "Description" in results
        try {
          await page.click('text=Description >> nth=0', { timeout: 3000 });
          console.log('Selected Description');
          await page.waitForTimeout(1000);
        } catch(e) {
          // Try clicking the first result
          const items = await page.$$('text=Description');
          for (const item of items) {
            const rect = await item.boundingBox();
            if (rect && rect.x < 450) {
              await item.click({ force: true });
              console.log('Force-clicked Description');
              break;
            }
          }
        }
      }

      // Close the picker by clicking elsewhere
      await page.mouse.click(700, 400);
      await page.waitForTimeout(500);
    }

    // Fill "Reuzenpanda Lead ID" with ID from step 1
    console.log('\n--- Reuzenpanda Lead ID ---');
    if (await clickPlusNearLabel('Lead ID')) {
      await page.screenshot({ path: '/tmp/zap-plus-id.png' });

      const pickerSearch2 = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          const r = inp.getBoundingClientRect();
          if (r.x < 450 && r.y > 50 && r.width > 100) {
            return { x: r.x, y: r.y, found: true };
          }
        }
        return { found: false };
      });

      if (pickerSearch2.found) {
        await page.mouse.click(pickerSearch2.x + 50, pickerSearch2.y + 10);
        await page.keyboard.type('ID');
        await page.waitForTimeout(1500);

        // Click first "ID" under step 1
        try {
          const idItems = await page.$$('text=/^ID$/');
          for (const item of idItems) {
            const rect = await item.boundingBox();
            if (rect && rect.x < 400 && rect.y > 100) {
              await item.click();
              console.log('Selected ID');
              break;
            }
          }
        } catch(e) {
          console.log('ID selection failed');
        }
      }
      await page.mouse.click(700, 400);
      await page.waitForTimeout(500);
    }

    // Fill "Reuzenpanda offerte link" - type URL then insert ID
    console.log('\n--- Reuzenpanda offerte link ---');
    // Find the field editor for "offerte link"
    const linkFieldPos = await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.textContent.trim().includes('offerte link')) {
          // Find the Slate editor after this label
          const parent = l.closest('[class]');
          const editor = parent?.querySelector('[data-slate-editor]') ||
                         parent?.nextElementSibling?.querySelector('[data-slate-editor]');
          if (editor) {
            const r = editor.getBoundingClientRect();
            return { x: r.x + 10, y: r.y + 10, found: true };
          }
          // Return label position + offset
          const r = l.getBoundingClientRect();
          return { x: r.x + 10, y: r.y + r.height + 15, found: true };
        }
      }
      return { found: false };
    });

    if (linkFieldPos.found) {
      await page.mouse.click(linkFieldPos.x, linkFieldPos.y);
      await page.waitForTimeout(300);
      await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=', { delay: 5 });
      await page.waitForTimeout(300);

      // Now click + to add the ID
      await page.mouse.click(1075, linkFieldPos.y);
      await page.waitForTimeout(1500);

      const pickerSearch3 = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          const r = inp.getBoundingClientRect();
          if (r.x < 450 && r.y > 50 && r.width > 100) {
            return { x: r.x, y: r.y, found: true };
          }
        }
        return { found: false };
      });

      if (pickerSearch3.found) {
        await page.mouse.click(pickerSearch3.x + 50, pickerSearch3.y + 10);
        await page.keyboard.type('ID');
        await page.waitForTimeout(1500);

        try {
          const idItems = await page.$$('text=/^ID$/');
          for (const item of idItems) {
            const rect = await item.boundingBox();
            if (rect && rect.x < 400 && rect.y > 100) {
              await item.click();
              console.log('Selected ID for link');
              break;
            }
          }
        } catch(e) {}
      }
      await page.mouse.click(700, 400);
      await page.waitForTimeout(500);
    }

    // Clear search
    await page.mouse.click(searchBox.x + 50, searchBox.y + 10);
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
  }

  // Publish
  console.log('\nPublishing...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.trim() === 'Publish') { b.click(); return; } }
  });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: '/tmp/zap-final-result.png' });
  await ctx.close();
  console.log('Done');
})().catch(console.error);
