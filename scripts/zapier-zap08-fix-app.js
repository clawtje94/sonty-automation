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
  console.log('🎬 ZAP-08 Fix app → Planado');

  await page.goto('https://zapier.com/editor/353424667/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click Step 2
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Select the event' || el.textContent?.trim() === 'Select the event for your Zap to run') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2) {
    await page.mouse.click(step2.x, step2.y);
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z08FX-01-loaded');

  // Click "Change" to change the app
  const changeLink = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Change') {
        const rect = el.getBoundingClientRect();
        if (rect.x > 900) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (changeLink) {
    console.log('Clicking Change...');
    await page.mouse.click(changeLink.x, changeLink.y);
    await page.waitForTimeout(3000);

    // Now search for Planado
    const searchInput = await page.evaluate(() => {
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

    if (searchInput) {
      await page.mouse.click(searchInput.x, searchInput.y);
      await page.keyboard.type('Planado');
      await page.waitForTimeout(3000);

      const planadoResult = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const text = el.textContent?.trim() || '';
          if (text === 'Planado') {
            const rect = el.getBoundingClientRect();
            if (rect.y > 200 && rect.width > 30 && rect.height < 50) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (planadoResult) {
        await page.mouse.click(planadoResult.x, planadoResult.y);
        console.log('  ✅ Planado geselecteerd');
        await page.waitForTimeout(5000);
      }
    } else {
      // Maybe the app picker shows differently - look for Planado in "Your top apps" or similar list
      const planadoInList = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Planado') {
            const rect = el.getBoundingClientRect();
            if (rect.x > 800 && rect.y > 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (planadoInList) {
        await page.mouse.click(planadoInList.x, planadoInList.y);
        console.log('  ✅ Planado uit lijst geselecteerd');
        await page.waitForTimeout(5000);
      }
    }

    await ss(page, 'Z08FX-02-planado');
  }

  // Now select "Create Job" event
  const eventDropdown = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text.includes('Choose an event')) {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (eventDropdown) {
    await page.mouse.click(eventDropdown.x, eventDropdown.y);
    await page.waitForTimeout(3000);

    // Look for "Create Job" option
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
    } else {
      // Search in event dropdown
      const eventSearch = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const ph = (inp.placeholder || '').toLowerCase();
          if (ph.includes('search')) {
            const rect = inp.getBoundingClientRect();
            if (rect.y > 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (eventSearch) {
        await page.mouse.click(eventSearch.x, eventSearch.y);
        await page.keyboard.type('Create');
        await page.waitForTimeout(2000);

        const createOpt2 = await page.evaluate(() => {
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

        if (createOpt2) {
          await page.mouse.click(createOpt2.x, createOpt2.y);
          console.log('  ✅ Create Job geselecteerd (na search)');
          await page.waitForTimeout(3000);
        }
      }
    }
  }

  await ss(page, 'Z08FX-03-event');

  // Click Continue to go to Account
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
    console.log('  Continue (→ Account)');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z08FX-04-account');

  // Check if account is already selected or needs selection
  const accState = await page.evaluate(() => document.body.innerText.substring(0, 3000));

  if (accState.includes('Select an account') || accState.includes('Sign in')) {
    // Need to select account
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

      // Click first account in dropdown
      const account = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const text = el.textContent?.trim() || '';
          if (text.includes('sonty') || text.includes('Planado')) {
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
        console.log(`  ✅ Account: ${account.text}`);
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
    console.log('  Continue (→ Configure)');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z08FX-05-configure');

  // Check final state
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 600));

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
