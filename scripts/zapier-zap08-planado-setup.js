const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-08 Planado Setup');

  await page.goto('https://zapier.com/editor/353424667/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click on Step 2 card (Action - Select event)
  console.log('Clicking Step 2 card...');
  await page.mouse.click(660, 465);
  await page.waitForTimeout(5000);

  await ss(page, 'Z08PS-01-step2');

  // Check if side panel opened with app search
  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Panel:', panelText.substring(0, 600));

  // Look for search input in the side panel
  let searchInput = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const ph = (inp.placeholder || '').toLowerCase();
      if (ph.includes('search') && !ph.includes('item')) {
        const rect = inp.getBoundingClientRect();
        if (rect.x > 800 && rect.width > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), ph: inp.placeholder };
      }
    }
    return null;
  });

  if (!searchInput) {
    // Try clicking on "Select the event" text area or Action label
    console.log('No search input, try double-clicking step 2 card...');
    await page.mouse.dblclick(660, 465);
    await page.waitForTimeout(5000);

    searchInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const ph = (inp.placeholder || '').toLowerCase();
        if (ph.includes('search') && !ph.includes('item')) {
          const rect = inp.getBoundingClientRect();
          if (rect.width > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), ph: inp.placeholder };
        }
      }
      return null;
    });
  }

  await ss(page, 'Z08PS-02-panel');

  if (searchInput) {
    console.log('Search input found:', searchInput.ph);
    await page.mouse.click(searchInput.x, searchInput.y);
    await page.keyboard.type('Planado');
    await page.waitForTimeout(3000);

    // Click Planado in results
    const planadoResult = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const text = el.textContent?.trim() || '';
        if (text === 'Planado') {
          const rect = el.getBoundingClientRect();
          if (rect.y > 150 && rect.width > 30 && rect.height < 50) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (planadoResult) {
      await page.mouse.click(planadoResult.x, planadoResult.y);
      console.log('  ✅ Planado geselecteerd');
      await page.waitForTimeout(5000);
    }

    await ss(page, 'Z08PS-03-planado');

    // Select "Create Job" event
    const eventDropdown = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const text = btn.textContent?.trim() || '';
        if (text.includes('Choose an event') || text.includes('Choose event')) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (eventDropdown) {
      await page.mouse.click(eventDropdown.x, eventDropdown.y);
      await page.waitForTimeout(3000);

      // Search for Create Job
      const eventSearch = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const ph = (inp.placeholder || '').toLowerCase();
          if (ph.includes('search')) {
            const rect = inp.getBoundingClientRect();
            if (rect.y > 200 && rect.width > 100) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (eventSearch) {
        await page.mouse.click(eventSearch.x, eventSearch.y);
        await page.keyboard.type('Create Job');
        await page.waitForTimeout(2000);
      }

      const createJobOpt = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Create Job') {
            const rect = el.getBoundingClientRect();
            if (rect.y > 250 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (createJobOpt) {
        await page.mouse.click(createJobOpt.x, createJobOpt.y);
        console.log('  ✅ Create Job event geselecteerd');
        await page.waitForTimeout(3000);
      }
    } else {
      // Maybe Create Job is auto-selected or shown differently
      console.log('No event dropdown, checking state...');
    }

    await ss(page, 'Z08PS-04-event');

    // Click Continue (Setup) — account should be already connected from ZAP-03
    const continueBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        if (btn.textContent?.trim() === 'Continue' && !btn.disabled) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 850) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (continueBtn) {
      await page.mouse.click(continueBtn.x, continueBtn.y);
      console.log('  Continue (Setup → Account)');
      await page.waitForTimeout(5000);

      // Check if we need to select account
      const accountState = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      if (accountState.includes('Select an account')) {
        // Need to select account — it should show the connected one
        console.log('Account selecteren...');
        const selectBtn = await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.offsetParent === null) continue;
            const text = btn.textContent?.trim() || '';
            if (text === 'Select') {
              const rect = btn.getBoundingClientRect();
              if (rect.x > 1100) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
          return null;
        });

        if (selectBtn) {
          await page.mouse.click(selectBtn.x, selectBtn.y);
          await page.waitForTimeout(3000);

          // Click Planado account
          const account = await page.evaluate(() => {
            const allEls = document.querySelectorAll('*');
            for (const el of allEls) {
              const text = el.textContent?.trim() || '';
              if ((text.includes('Planado') || text.includes('sonty')) && !text.includes('Change') && !text.includes('secure')) {
                const rect = el.getBoundingClientRect();
                if (rect.y > 400 && rect.y < 600 && rect.width > 100 && rect.height > 20 && rect.height < 60) {
                  return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: text.substring(0, 60) };
                }
              }
            }
            return null;
          });

          if (account) {
            await page.mouse.click(account.x, account.y);
            console.log(`  Account: ${account.text}`);
            await page.waitForTimeout(5000);
          }
        }
      }

      // Click Continue again (Account → Configure)
      const continue2 = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.offsetParent === null) continue;
          if (btn.textContent?.trim() === 'Continue' && !btn.disabled) {
            const rect = btn.getBoundingClientRect();
            if (rect.x > 850) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (continue2) {
        await page.mouse.click(continue2.x, continue2.y);
        console.log('  Continue (Account → Configure)');
        await page.waitForTimeout(5000);
      }
    }
  } else {
    console.log('❌ Geen search input gevonden voor app selectie');
    // Show what's on the page
    const allInputs = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('input').forEach(inp => {
        if (inp.offsetParent === null) return;
        const rect = inp.getBoundingClientRect();
        result.push({ ph: inp.placeholder, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) });
      });
      return result;
    });
    console.log('All inputs:', JSON.stringify(allInputs));
  }

  await ss(page, 'Z08PS-05-state');

  // Check final state
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal state:', finalText.substring(0, 800));

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
