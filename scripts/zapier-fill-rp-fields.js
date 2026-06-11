const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile6', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Should still be logged in from persistent context
  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    console.log('Session expired, need to login');
    try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    const b1 = await page.$$('button');
    for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(4000);
    await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
    const b2 = await page.$$('button');
    for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(12000);
    if (page.url().includes('login')) { console.log('Login failed'); await ctx.close(); return; }
    await page.goto('https://zapier.com/editor/353405789/draft');
    await page.waitForTimeout(8000);
  }

  console.log('On editor');

  // Click step 3
  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Use the search field to find our fields one by one
  async function fillFieldViaSearch(searchTerm, dataLabel) {
    console.log('\n--- Filling: ' + searchTerm + ' ---');

    // Search for the field
    const searchInput = await page.$('input[placeholder*="Search fields"]');
    if (!searchInput) { console.log('No search input'); return false; }

    await searchInput.click();
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(1500);

    // Find the "Enter text or insert data..." input for this field
    // It should be the first editable field visible after search
    const editableFields = await page.$$('[data-slate-editor="true"], [contenteditable="true"]');
    console.log('Found', editableFields.length, 'editable fields');

    for (const field of editableFields) {
      const rect = await field.boundingBox();
      if (rect && rect.left > 450 && rect.width > 100) {
        const text = await field.textContent();
        if (text.includes('Enter text') || text.trim() === '') {
          console.log('Found empty field at y=' + Math.round(rect.y));

          // Click the + button next to this field to open data picker
          // The + is usually to the right of the field
          const plusBtn = await page.$('button[aria-label="Insert data"] >> nth=-1');
          if (!plusBtn) {
            // Try clicking the + icon near the field
            await page.mouse.click(rect.x + rect.width + 20, rect.y + rect.height / 2);
            await page.waitForTimeout(1000);
          }

          // Click inside the field and type/insert data
          await field.click();
          await page.waitForTimeout(500);

          if (dataLabel === 'DESCRIPTION') {
            // Need to insert "1. Description" from data picker
            // Click the + button to the right of the field
            const plusButtons = await page.$$('button');
            for (const btn of plusButtons) {
              const btnRect = await btn.boundingBox();
              if (btnRect && Math.abs(btnRect.y - rect.y) < 30 && btnRect.x > rect.x + rect.width - 50) {
                await btn.click();
                await page.waitForTimeout(1500);
                console.log('Clicked + button');

                // Search for Description in the data picker
                const pickerSearch = await page.$('input[placeholder*="Search"]');
                if (pickerSearch) {
                  // There might be multiple search inputs - find the one in the data picker
                  const searchInputs = await page.$$('input[placeholder*="Search"], input[type="search"]');
                  for (const si of searchInputs) {
                    const siRect = await si.boundingBox();
                    if (siRect && siRect.x < 450) { // Data picker is on the left
                      await si.fill('Description');
                      await page.waitForTimeout(1000);
                      break;
                    }
                  }
                }

                // Click "Description" in the results
                try {
                  await page.click('text=Description >> nth=0', { timeout: 3000 });
                  await page.waitForTimeout(1000);
                  console.log('Selected Description');
                } catch(e) {
                  console.log('Description not found in picker');
                }
                break;
              }
            }
          } else if (dataLabel === 'LINK') {
            // Type the URL prefix first, then insert ID
            await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=');
            await page.waitForTimeout(500);

            // Now insert the Reuzenpanda ID via + button
            const plusButtons = await page.$$('button');
            for (const btn of plusButtons) {
              const btnRect = await btn.boundingBox();
              if (btnRect && Math.abs(btnRect.y - rect.y) < 30 && btnRect.x > rect.x + rect.width - 50) {
                await btn.click();
                await page.waitForTimeout(1500);
                // Search for ID
                const searchInputs = await page.$$('input[placeholder*="Search"], input[type="search"]');
                for (const si of searchInputs) {
                  const siRect = await si.boundingBox();
                  if (siRect && siRect.x < 450) {
                    await si.fill('ID');
                    await page.waitForTimeout(1000);
                    break;
                  }
                }
                // Click the first "ID" under Reuzenpanda (step 1)
                try {
                  const idOptions = await page.$$('text=ID');
                  for (const opt of idOptions) {
                    const optRect = await opt.boundingBox();
                    if (optRect && optRect.x < 400) {
                      await opt.click();
                      await page.waitForTimeout(500);
                      console.log('Selected ID for link');
                      break;
                    }
                  }
                } catch(e) {}
                break;
              }
            }
          } else if (dataLabel === 'ID') {
            // Just insert the Reuzenpanda ID
            const plusButtons = await page.$$('button');
            for (const btn of plusButtons) {
              const btnRect = await btn.boundingBox();
              if (btnRect && Math.abs(btnRect.y - rect.y) < 30 && btnRect.x > rect.x + rect.width - 50) {
                await btn.click();
                await page.waitForTimeout(1500);
                const searchInputs = await page.$$('input[placeholder*="Search"], input[type="search"]');
                for (const si of searchInputs) {
                  const siRect = await si.boundingBox();
                  if (siRect && siRect.x < 450) {
                    await si.fill('ID');
                    await page.waitForTimeout(1000);
                    break;
                  }
                }
                try {
                  const idOptions = await page.$$('text=ID');
                  for (const opt of idOptions) {
                    const optRect = await opt.boundingBox();
                    if (optRect && optRect.x < 400) {
                      await opt.click();
                      await page.waitForTimeout(500);
                      console.log('Selected ID');
                      break;
                    }
                  }
                } catch(e) {}
                break;
              }
            }
          }
          return true;
        }
      }
    }
    return false;
  }

  // Fill the three fields
  await fillFieldViaSearch('Reuzenpanda omschrijving', 'DESCRIPTION');
  await page.screenshot({ path: '/tmp/zap01-fill-desc.png' });

  await fillFieldViaSearch('Reuzenpanda offerte link', 'LINK');
  await page.screenshot({ path: '/tmp/zap01-fill-link.png' });

  await fillFieldViaSearch('Reuzenpanda Lead ID', 'ID');
  await page.screenshot({ path: '/tmp/zap01-fill-id.png' });

  // Click Continue
  try {
    await page.click('button:has-text("Continue")', { timeout: 3000 });
    await page.waitForTimeout(2000);
    console.log('\nClicked Continue');
  } catch(e) {}

  // Click Publish
  try {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent.trim() === 'Publish') { b.click(); return; }
      }
    });
    await page.waitForTimeout(5000);
    console.log('Published!');
  } catch(e) {}

  await page.screenshot({ path: '/tmp/zap01-published-final.png' });
  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
