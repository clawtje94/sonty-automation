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
  console.log('🎬 Planado Sign in v4');

  let popupPage = null;
  context.on('page', (p) => { popupPage = p; });

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

  // Check current status - maybe already connecting from last attempt
  const statusText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  if (statusText.includes('Sign in') || statusText.includes('Connecting Account')) {
    // Need to reconnect - click "Change" to reset, then Sign in again
    const changeBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        if (btn.textContent?.trim() === 'Change') {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 1100) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (changeBtn && statusText.includes('Connecting Account')) {
      await page.mouse.click(changeBtn.x, changeBtn.y);
      await page.waitForTimeout(3000);
    }

    // Click Sign in
    const signIn = page.locator('button:has-text("Sign in")').first();
    if (await signIn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Clicking Sign in...');
      await signIn.click();
      await page.waitForTimeout(8000);
    } else {
      // Try "Add a new account" or "Connect a new account"
      const addAccount = page.locator('button:has-text("new account"), a:has-text("new account")').first();
      if (await addAccount.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addAccount.click();
        await page.waitForTimeout(8000);
      }
    }
  }

  if (!popupPage) {
    console.log('No popup detected');
    await ss(page, 'PLSIGN4-no-popup');
    await browser.close();
    return;
  }

  await popupPage.waitForLoadState('networkidle').catch(() => {});
  await popupPage.waitForTimeout(3000);
  console.log('Popup:', popupPage.url());
  await popupPage.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN4-popup.png') });

  // Get viewport size
  const vpSize = popupPage.viewportSize();
  console.log('Viewport:', JSON.stringify(vpSize));

  // Check what's actually in the DOM - look for divs with contenteditable or specific form elements
  const formElements = await popupPage.evaluate(() => {
    const result = [];
    // Look for any elements that look like form fields
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 20 || rect.height > 60 || rect.y < 200) continue;
      const tag = el.tagName.toLowerCase();
      const ce = el.contentEditable;
      const role = el.getAttribute('role') || '';
      if (tag === 'input' || tag === 'textarea' || ce === 'true' || role === 'textbox') {
        result.push({
          tag, type: el.type || '', role, contentEditable: ce,
          x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2),
          w: Math.round(rect.width), h: Math.round(rect.height),
          placeholder: el.placeholder || '', value: (el.value || '').substring(0, 30)
        });
      }
    }
    return result;
  }).catch(() => []);
  console.log('Form elements:', JSON.stringify(formElements, null, 2));

  // Based on the screenshot, the fields are at approximately:
  // Subdomain: y ≈ 310, Email: y ≈ 395, Password: y ≈ 480
  // The form is centered, so x ≈ 490 (center of field)

  // Try triple-click to select all in first field (if it has wrong data), then type
  // Subdomain field
  console.log('\nFilling fields by clicking...');
  await popupPage.mouse.click(490, 310);
  await popupPage.waitForTimeout(500);
  await popupPage.keyboard.press('Meta+a'); // Select all
  await popupPage.keyboard.type('sonty');
  console.log('Subdomain: sonty');

  await popupPage.waitForTimeout(300);

  // Email field
  await popupPage.mouse.click(490, 395);
  await popupPage.waitForTimeout(500);
  await popupPage.keyboard.press('Meta+a');
  await popupPage.keyboard.type('daimy@sonty.nl');
  console.log('Email: daimy@sonty.nl');

  await popupPage.waitForTimeout(300);

  // Password field
  await popupPage.mouse.click(490, 480);
  await popupPage.waitForTimeout(500);
  await popupPage.keyboard.press('Meta+a');
  await popupPage.keyboard.type('^XU6C&SuS*FFnb');
  console.log('Password filled');

  await popupPage.waitForTimeout(1000);
  await popupPage.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN4-filled.png') });

  // Click "Yes, Continue to Planado" button
  await popupPage.mouse.click(451, 520);
  console.log('Submit clicked (coords)');

  // Also try the button text
  const yesBtn = popupPage.locator('text=Yes, Continue to Planado').first();
  if (await yesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await yesBtn.click({ force: true });
    console.log('Submit clicked (locator)');
  }

  await popupPage.waitForTimeout(10000).catch(() => {});
  await page.waitForTimeout(5000);

  await ss(page, 'PLSIGN4-after');
  const finalPanel = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nResult:', finalPanel.substring(finalPanel.indexOf('Account'), finalPanel.indexOf('Account') + 300));

  // Continue if connected
  const isConnected = finalPanel.includes('Used in') || (finalPanel.includes('Continue') && !finalPanel.includes('Sign in'));
  if (isConnected) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click({ force: true });
      console.log('Continue clicked');
      await page.waitForTimeout(5000);
    }
  }

  await ss(page, 'PLSIGN4-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
