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
  console.log('🎬 ZAP-08 Select Planado + Configure');

  await page.goto('https://zapier.com/editor/353424667/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click Step 2 card
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Select the event' || text.includes('Select the event')) {
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

  // Click "Change" button (at x≈1201, y≈257 based on screenshot)
  console.log('Clicking Change...');
  await page.mouse.click(1201, 257);
  await page.waitForTimeout(3000);

  await ss(page, 'Z08SP-01-modal');

  // The modal opened with search. Planado was already typed from last run.
  // Click "Planado" result in the modal (at x≈544, y≈86)
  // But first check if the search still shows "Planado"
  const planadoInModal = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Planado') {
        const rect = el.getBoundingClientRect();
        // In the modal area (not in the side panel)
        if (rect.x < 960 && rect.y > 60 && rect.y < 200 && rect.width > 30) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (planadoInModal) {
    console.log('Clicking Planado in modal...');
    await page.mouse.click(planadoInModal.x, planadoInModal.y);
    await page.waitForTimeout(5000);
  } else {
    // Search for Planado in the modal search input
    const modalSearch = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        // Modal search input (not in side panel, so x < 960)
        if (rect.x < 960 && rect.width > 150 && rect.y < 100) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (modalSearch) {
      await page.mouse.click(modalSearch.x, modalSearch.y);
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Planado');
      await page.waitForTimeout(3000);

      const planadoResult = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Planado') {
            const rect = el.getBoundingClientRect();
            if (rect.x < 960 && rect.y > 60 && rect.width > 30) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
        }
        return null;
      });

      if (planadoResult) {
        await page.mouse.click(planadoResult.x, planadoResult.y);
        console.log('  ✅ Planado geselecteerd');
        await page.waitForTimeout(5000);
      }
    }
  }

  await ss(page, 'Z08SP-02-app-selected');

  // Now select "Create Job" event from the dropdown
  const eventDropdown = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, [role="combobox"]');
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
    console.log('Opening event dropdown...');
    await page.mouse.click(eventDropdown.x, eventDropdown.y);
    await page.waitForTimeout(3000);

    // Search for "Create Job"
    const eventSearch = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const ph = (inp.placeholder || '').toLowerCase();
        if (ph.includes('search')) {
          const rect = inp.getBoundingClientRect();
          if (rect.y > 200 && rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (eventSearch) {
      await page.mouse.click(eventSearch.x, eventSearch.y);
      await page.keyboard.type('Create');
      await page.waitForTimeout(2000);
    }

    const createJobOpt = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Create Job') {
          const rect = el.getBoundingClientRect();
          if (rect.y > 250 && rect.width > 30 && rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (createJobOpt) {
      await page.mouse.click(createJobOpt.x, createJobOpt.y);
      console.log('  ✅ Create Job event');
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'Z08SP-03-event');

  // Click Continue (Setup → Account)
  let continueBtn = await page.evaluate(() => {
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

  await ss(page, 'Z08SP-04-account');

  // Check if account needs selection
  const accText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  if (accText.includes('Select an account') || accText.includes('Sign in')) {
    // Select the Planado account
    const selectBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        if (btn.textContent?.trim() === 'Select') {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 1100) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (selectBtn) {
      await page.mouse.click(selectBtn.x, selectBtn.y);
      await page.waitForTimeout(3000);

      // Click the Planado account
      const account = await page.evaluate(() => {
        const allEls = document.querySelectorAll('[role="option"], [class*="option"], li');
        for (const el of allEls) {
          if (el.offsetParent === null) continue;
          const text = el.textContent?.trim() || '';
          if (text.includes('sonty') || text.includes('Planado') || text.includes('planado')) {
            const rect = el.getBoundingClientRect();
            if (rect.y > 350 && rect.height > 10) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: text.substring(0, 60) };
          }
        }
        // Fallback: any visible element in the dropdown area
        const allEls2 = document.querySelectorAll('*');
        for (const el of allEls2) {
          if (el.children.length > 0) continue;
          const text = el.textContent?.trim() || '';
          if (text.includes('sonty') && text.length < 80) {
            const rect = el.getBoundingClientRect();
            if (rect.y > 350 && rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
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

    // Click Continue again
    continueBtn = await page.evaluate(() => {
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
      console.log('  Continue (→ Configure)');
      await page.waitForTimeout(5000);
    }
  }

  await ss(page, 'Z08SP-05-state');

  // Check what state we're in now
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 600));

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
