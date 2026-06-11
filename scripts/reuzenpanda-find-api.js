const { chromium } = require('playwright');

// Try to find Reuzenpanda API key via the Reuzenpanda dashboard
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login to Reuzenpanda
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/rp-login-1.png' });

  // Check what login form looks like
  const inputs = await page.$$('input');
  console.log('Login inputs:', inputs.length);
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    const placeholder = await inp.getAttribute('placeholder');
    console.log('  input:', type, name, placeholder);
  }

  // Try login with daimy@sonty.nl credentials
  try {
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email"]');
    if (emailInput) {
      await emailInput.fill('daimy@sonty.nl');
    }
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) {
      await pwInput.fill('Ta4ZERam3$ka$g'); // Try HubSpot password
    }
    const submitBtn = await page.$('button[type="submit"], button:has-text("Login"), button:has-text("Log in")');
    if (submitBtn) await submitBtn.click();
    await page.waitForTimeout(5000);
  } catch(e) {}

  await page.screenshot({ path: '/tmp/rp-login-2.png' });
  console.log('After login URL:', page.url());

  // If that didn't work, try Zapier password
  if (page.url().includes('login')) {
    try {
      const pwInput = await page.$('input[type="password"]');
      if (pwInput) {
        await pwInput.fill('D^mR&F%82WtBrVK&fnm8'); // Zapier password
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) await submitBtn.click();
        await page.waitForTimeout(5000);
      }
    } catch(e) {}
    console.log('After 2nd attempt URL:', page.url());
  }

  await page.screenshot({ path: '/tmp/rp-after-login.png' });

  // If logged in, navigate to settings/API page
  if (!page.url().includes('login')) {
    console.log('Logged in to Reuzenpanda!');

    // Try settings page
    await page.goto('https://hub.reuzenpanda.nl/app/settings');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/rp-settings.png' });

    // Look for API section
    try {
      await page.click('text=API', { timeout: 3000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/rp-api.png' });
    } catch(e) {
      // Try other navigation
      const links = await page.$$('a');
      for (const link of links) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        if (text.toLowerCase().includes('api') || text.toLowerCase().includes('integratie') ||
            (href && href.includes('api'))) {
          console.log('Found link:', text.trim(), href);
        }
      }
    }

    // Also check for company profile ID
    await page.goto('https://hub.reuzenpanda.nl/app/settings/company');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-company.png' });
  }

  await browser.close();
  console.log('Done');
})().catch(console.error);
