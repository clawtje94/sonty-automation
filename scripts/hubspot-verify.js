const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Go to HubSpot login
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}

  // Fill email
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
    await page.click('button[type="submit"]', { timeout: 3000 });
  }
  await page.waitForTimeout(4000);

  // Click "Sign in with password"
  await page.click('text=Sign in with password');
  await page.waitForTimeout(3000);

  // Fill password
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
    await page.click('button[type="submit"]', { timeout: 3000 });
  }
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/hs-verify-1.png' });

  // Enter verification code
  console.log('Entering code 952441...');
  try {
    await page.fill('input[placeholder*="code"], input[name*="code"], input[type="text"]', '952441', { timeout: 5000 });
    console.log('Code filled');

    // Click Continue
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: '/tmp/hs-verify-2.png' });
    console.log('After verify URL:', page.url());
  } catch(e) {
    console.log('Code entry failed:', e.message.substring(0, 80));
    await page.screenshot({ path: '/tmp/hs-verify-fail.png' });
  }

  if (!page.url().includes('login') && !page.url().includes('confirm')) {
    console.log('LOGGED IN TO HUBSPOT!');

    // Go to Private Apps settings
    await page.goto('https://app-eu1.hubspot.com/private-apps/147970649/33327041');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/hs-private-app.png' });
    console.log('Private app page:', page.url());

    // Click on Scopes tab
    try {
      await page.click('text=Scopes', { timeout: 5000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/hs-scopes-tab.png' });
      console.log('Scopes tab opened');

      // Search for "automation"
      const searchInput = await page.$('input[placeholder*="Search"], input[type="search"]');
      if (searchInput) {
        await searchInput.fill('automation');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/hs-scopes-search.png' });
        console.log('Searched for automation');
      }

      // Look for automation checkbox/toggle
      const autoCheckbox = await page.$('text=automation');
      if (autoCheckbox) {
        await autoCheckbox.click();
        await page.waitForTimeout(1000);
        console.log('Clicked automation scope');
      }

      // Also search for owners
      if (searchInput) {
        await searchInput.fill('owners');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/hs-scopes-owners.png' });
      }

      // Save/Update
      const saveBtn = await page.$('button:has-text("Save"), button:has-text("Update"), button:has-text("Commit")');
      if (saveBtn) {
        await saveBtn.click();
        await page.waitForTimeout(5000);
        console.log('Saved scopes!');
        await page.screenshot({ path: '/tmp/hs-scopes-saved.png' });
      }
    } catch(e) {
      console.log('Scopes navigation failed:', e.message.substring(0, 80));
    }
  } else {
    console.log('Login/verify failed. URL:', page.url());
  }

  await browser.close();
  console.log('Done');
})().catch(console.error);
