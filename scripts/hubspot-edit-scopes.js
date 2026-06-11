const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login flow
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}

  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
    await page.click('button[type="submit"]', { timeout: 3000 });
  }
  await page.waitForTimeout(4000);

  // Check if we need password or already logged in
  if (page.url().includes('login')) {
    try {
      await page.click('text=Sign in with password', { timeout: 3000 });
      await page.waitForTimeout(2000);
      await page.fill('#password', 'Ta4ZERam3$ka$g');
      try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
        await page.click('button[type="submit"]', { timeout: 3000 });
      }
      await page.waitForTimeout(5000);
    } catch(e) {}

    // Check for verification code
    if (page.url().includes('confirm')) {
      console.log('Needs verification code again');
      await page.screenshot({ path: '/tmp/hs-needs-code.png' });
      await browser.close();
      return;
    }
  }

  if (page.url().includes('login')) {
    console.log('Login failed');
    await browser.close();
    return;
  }
  console.log('Logged in!');

  // Go directly to private app edit page
  await page.goto('https://app-eu1.hubspot.com/private-apps/147970649/33327041');
  await page.waitForTimeout(5000);

  // Click "App bewerken" (Edit app)
  try {
    await page.click('text=App bewerken', { timeout: 5000 });
    await page.waitForTimeout(5000);
    console.log('Clicked App bewerken');
    await page.screenshot({ path: '/tmp/hs-edit-app.png' });
  } catch(e) {
    console.log('App bewerken not found, trying English...');
    try {
      await page.click('text=Edit app', { timeout: 3000 });
      await page.waitForTimeout(5000);
    } catch(e2) {
      console.log('Edit button not found');
      await page.screenshot({ path: '/tmp/hs-no-edit.png' });
    }
  }

  // Now look for Scopes section
  // In the edit view, there should be scopes/permissions section
  await page.screenshot({ path: '/tmp/hs-edit-view.png' });

  // Look for "Scopes" or "Bereiken" tab/section
  try {
    const scopeLink = await page.$('text=Scopes, text=Bereiken, text=scopes');
    if (scopeLink) {
      await scopeLink.click();
      await page.waitForTimeout(3000);
      console.log('Found scopes section');
    }
  } catch(e) {}

  // Search for automation in scopes
  const searchInput = await page.$('input[placeholder*="Search"], input[placeholder*="Zoek"], input[type="search"]');
  if (searchInput) {
    await searchInput.fill('automation');
    await page.waitForTimeout(2000);
    console.log('Searched for automation');
    await page.screenshot({ path: '/tmp/hs-search-automation.png' });

    // Look for checkbox to enable
    const checkboxes = await page.$$('input[type="checkbox"]');
    console.log('Found', checkboxes.length, 'checkboxes');

    // Click any unchecked automation-related checkbox
    for (const cb of checkboxes) {
      const isChecked = await cb.isChecked();
      if (!isChecked) {
        const label = await cb.evaluate(el => {
          const parent = el.closest('label, div, tr');
          return parent ? parent.textContent.substring(0, 60) : '';
        });
        if (label.toLowerCase().includes('automat')) {
          await cb.click({ force: true });
          console.log('Checked:', label.trim());
        }
      }
    }
  }

  // Scroll to see more of the page
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/hs-edit-bottom.png' });

  // Get all text to understand the page structure
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').filter(l => {
    const t = l.trim().toLowerCase();
    return t.includes('scope') || t.includes('automat') || t.includes('bereik') ||
           t.includes('workflow') || t.includes('save') || t.includes('opslaan') ||
           t.includes('update') || t.includes('owner');
  });
  console.log('\nRelevant text:');
  lines.forEach(l => console.log('  ' + l.trim().substring(0, 100)));

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
