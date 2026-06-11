const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');
const PLANADO_API_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 Planado koppelen + ZAP-03 actie toevoegen');

  // Open ZAP-03 editor
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  await ss(page, 'PLD-01-loaded');

  // Click the "+" button to add a step, or click "Action" step 2
  const addStep = await page.evaluate(() => {
    // Look for "+" button between steps or "Add step" text
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Select the event for your Zap to run') {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (addStep) {
    await page.mouse.click(addStep.x, addStep.y);
    await page.waitForTimeout(5000);
    await ss(page, 'PLD-02-action-clicked');
  } else {
    // Maybe there's just a + button
    const plusBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const text = btn.textContent?.trim() || '';
        const label = btn.getAttribute('aria-label') || '';
        if (label.includes('Add step') || label.includes('add step') || text === '+') {
          const rect = btn.getBoundingClientRect();
          if (rect.y > 300 && rect.y < 500) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (plusBtn) {
      await page.mouse.click(plusBtn.x, plusBtn.y);
      await page.waitForTimeout(5000);
      await ss(page, 'PLD-02-plus-clicked');
    }
  }

  // The app picker should appear - search for Planado
  const searchInput = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
    }
    return null;
  });

  if (searchInput) {
    await page.mouse.click(searchInput.x, searchInput.y);
    await page.keyboard.type('Planado');
    await page.waitForTimeout(3000);
    await ss(page, 'PLD-03-search');

    // Click Planado in results
    const planado = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Planado') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 30 && rect.height > 10 && rect.height < 80) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    if (planado) {
      await page.mouse.click(planado.x, planado.y);
      console.log('Planado geselecteerd');
      await page.waitForTimeout(5000);
      await ss(page, 'PLD-04-planado');
    }
  }

  // Select "Create Job" event
  const eventDropdown = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Choose an event') {
        const rect = el.getBoundingClientRect();
        if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (eventDropdown) {
    await page.mouse.click(eventDropdown.x, eventDropdown.y);
    await page.waitForTimeout(2000);

    // Search for "Create Job"
    const eventSearch = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const placeholder = inp.getAttribute('placeholder') || '';
        if (placeholder.includes('Search')) {
          const rect = inp.getBoundingClientRect();
          if (rect.y > 300) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (eventSearch) {
      await page.mouse.click(eventSearch.x, eventSearch.y);
      await page.keyboard.type('Create Job');
      await page.waitForTimeout(2000);
    }

    const createJob = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const text = el.textContent?.trim() || '';
        if (text.startsWith('Create Job')) {
          const rect = el.getBoundingClientRect();
          if (rect.y > 300 && rect.width > 100 && rect.height > 15 && rect.height < 80) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: text.substring(0, 50) };
          }
        }
      }
      return null;
    });

    if (createJob) {
      await page.mouse.click(createJob.x, createJob.y);
      console.log(`Create Job geselecteerd: ${createJob.text}`);
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'PLD-05-event');

  // Now we need to connect the Planado account with API key
  // Look for "Sign in" or "Connect" button
  const connectBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text.includes('Sign in') || text.includes('Connect') || text.includes('Inloggen') || text.includes('Verbinden') || text.includes('Choose an account')) {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800 && rect.width > 60) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
        }
      }
    }
    return null;
  });

  if (connectBtn) {
    console.log(`Connect button: "${connectBtn.text}"`);
    await page.mouse.click(connectBtn.x, connectBtn.y);
    await page.waitForTimeout(5000);
    await ss(page, 'PLD-06-connect');

    // Look for API key input in popup/modal
    const apiInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const placeholder = inp.getAttribute('placeholder') || '';
        const label = inp.getAttribute('aria-label') || '';
        const name = inp.name || '';
        if (placeholder.includes('API') || placeholder.includes('api') || placeholder.includes('key') ||
            placeholder.includes('token') || label.includes('API') || name.includes('api') || name.includes('key')) {
          const rect = inp.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), placeholder, name };
        }
      }
      // Fallback: any input in a popup
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        if (rect.y > 200 && rect.width > 150 && inp.type !== 'hidden') {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), placeholder: inp.placeholder, name: inp.name };
        }
      }
      return null;
    });

    if (apiInput) {
      console.log(`API input: placeholder="${apiInput.placeholder}" name="${apiInput.name}"`);
      await page.mouse.click(apiInput.x, apiInput.y);
      await page.keyboard.type(PLANADO_API_KEY);
      await page.waitForTimeout(1000);
      await ss(page, 'PLD-07-api-filled');

      // Look for "Yes, Continue" or submit button
      const submitBtn = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.offsetParent === null) continue;
          const text = btn.textContent?.trim() || '';
          if (text.includes('Continue') || text.includes('Yes') || text === 'Submit' || text === 'Save' || text === 'Connect') {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 60) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
          }
        }
        return null;
      });

      if (submitBtn) {
        console.log(`Submit: "${submitBtn.text}"`);
        await page.mouse.click(submitBtn.x, submitBtn.y);
        await page.waitForTimeout(10000);
        await ss(page, 'PLD-08-connected');
      }
    } else {
      // Maybe a popup window opened - check for new pages
      const pages = context.pages();
      console.log(`Open pages: ${pages.length}`);
      if (pages.length > 1) {
        const popup = pages[pages.length - 1];
        await popup.waitForTimeout(3000);
        const popupText = await popup.evaluate(() => document.body.innerText.substring(0, 1000));
        console.log('Popup:', popupText.substring(0, 500));
        await popup.screenshot({ path: path.join(__dirname, 'wf-debug-PLD-06-popup.png') });

        // Fill API key in popup
        const popupInput = popup.locator('input').first();
        if (await popupInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await popupInput.fill(PLANADO_API_KEY);
          await page.waitForTimeout(1000);

          const popupSubmit = popup.locator('button[type="submit"], button:has-text("Yes"), button:has-text("Continue")').first();
          if (await popupSubmit.isVisible({ timeout: 3000 }).catch(() => false)) {
            await popupSubmit.click();
            await page.waitForTimeout(10000);
          }
        }
      }
    }
  }

  // Click Continue after account connection
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
      if (!disabled) {
        await btn.click({ force: true });
        console.log(`Continue ${i + 1}`);
        await page.waitForTimeout(5000);
      } else break;
    } else break;
  }

  await ss(page, 'PLD-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
