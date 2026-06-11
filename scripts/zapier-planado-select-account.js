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
  console.log('🎬 Planado account selecteren');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open Step 2
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Create Job') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2) {
    await page.mouse.dblclick(step2.x, step2.y);
    await page.waitForTimeout(5000);
  }

  await ss(page, 'PLACC-01');

  // Check current state
  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Panel:', panelText.substring(0, 800));

  // Click "Select an account" dropdown or "Select" button
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
    console.log('Clicking Select...');
    await page.mouse.click(selectBtn.x, selectBtn.y);
    await page.waitForTimeout(3000);
    await ss(page, 'PLACC-02-dropdown');

    // Click the Planado account in the dropdown
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
      console.log(`Account: "${account.text}"`);
      await page.mouse.click(account.x, account.y);
      await page.waitForTimeout(5000);
    } else {
      // Show dropdown options
      const options = await page.evaluate(() => {
        const result = [];
        const allEls = document.querySelectorAll('[role="option"], [role="listbox"] *, li, [class*="option"]');
        for (const el of allEls) {
          if (el.offsetParent === null) continue;
          const text = el.textContent?.trim() || '';
          const rect = el.getBoundingClientRect();
          if (text.length > 3 && text.length < 100 && rect.y > 380) {
            result.push({ text, y: Math.round(rect.y) });
          }
        }
        return result;
      });
      console.log('Options:', JSON.stringify(options));

      // Also try clicking "Select an account" text itself
      const selectAccount = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Select an account') {
            const rect = el.getBoundingClientRect();
            if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (selectAccount) {
        await page.mouse.click(selectAccount.x, selectAccount.y);
        await page.waitForTimeout(3000);
        await ss(page, 'PLACC-03-dropdown2');

        const options2 = await page.evaluate(() => {
          const result = [];
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.children.length > 0) continue;
            const rect = el.getBoundingClientRect();
            if (rect.y > 420 && rect.y < 600 && rect.x > 800 && rect.width > 50) {
              const text = el.textContent?.trim() || '';
              if (text.length > 3 && text.length < 80) {
                result.push({ text, x: Math.round(rect.x), y: Math.round(rect.y) });
              }
            }
          }
          return result;
        });
        console.log('Options2:', JSON.stringify(options2));
      }
    }
  } else {
    // Maybe already connected - check for Continue
    console.log('Select button niet gevonden, check of al verbonden...');
  }

  await ss(page, 'PLACC-04');

  // Try Continue
  const btn = page.locator('button').filter({ hasText: /^Continue$/ });
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
    if (!disabled) {
      await btn.click({ force: true });
      console.log('Continue');
      await page.waitForTimeout(5000);
      await ss(page, 'PLACC-05-configure');

      // Check what configure fields are available
      const configText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('\nConfigure:', configText.substring(0, 1000));
    }
  }

  await ss(page, 'PLACC-final');
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
