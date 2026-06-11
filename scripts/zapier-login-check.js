const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(4000);

  // Accept cookies first
  const cookieBtn = await page.$('button:has-text("Accept all cookies")');
  if (cookieBtn) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
    console.log('Cookies accepted');
  }

  // Fill email
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  if (emailInput) {
    await emailInput.fill('daimy@sonty.nl');
    // Click continue/submit for email step
    const continueBtn = await page.$('button:has-text("Continue"), button[type="submit"]');
    if (continueBtn) await continueBtn.click();
    await page.waitForTimeout(3000);
  }

  // Fill password
  const pwInput = await page.$('input[type="password"]');
  if (pwInput) {
    await pwInput.fill('D^mR&F%82WtBrVK&fnm8');
    console.log('Password filled');

    // Click Continue button
    const continueBtn = await page.$('button:has-text("Continue"), button[type="submit"]');
    if (continueBtn) {
      await continueBtn.click();
      console.log('Clicked Continue');
    }
  }

  await page.waitForTimeout(10000);
  console.log('URL after login:', page.url());
  await page.screenshot({ path: '/tmp/zap-after-login.png' });

  if (page.url().includes('app/') && !page.url().includes('login')) {
    console.log('✅ Logged in!');

    // Go to zaps
    await page.goto('https://zapier.com/app/zaps');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/zap-zaps-page.png' });

    // Get all zap info
    const bodyText = await page.evaluate(() => document.body.innerText);
    const lines = bodyText.split('\n').filter(l => l.trim().length > 5);

    // Find zap-related lines
    const zapLines = lines.filter(l =>
      l.includes('Reuzenpanda') || l.includes('HubSpot') || l.includes('Planado') ||
      l.includes('Trengo') || l.includes('Gripp') || l.includes('Sonty') ||
      l.includes('ZAP') || l.includes('Draft') || l.includes('ON') || l.includes('OFF')
    );
    console.log('\nZap-related content:');
    zapLines.forEach(l => console.log('  ' + l.substring(0, 120)));

    // Take screenshot of each known zap
    const zapIds = {
      'ZAP-01': 353405789,
      'ZAP-02': 353406808,
      'ZAP-03': 353373774,
      'ZAP-05': 353424308,
      'ZAP-06': 353424608,
      'ZAP-08': 353424667,
    };

    for (const [name, id] of Object.entries(zapIds)) {
      await page.goto(`https://zapier.com/editor/${id}`);
      await page.waitForTimeout(4000);

      const title = await page.title();
      const url = page.url();

      // Check toggle state
      const toggleState = await page.evaluate(() => {
        const toggles = document.querySelectorAll('[role="switch"], [data-testid*="toggle"]');
        for (const t of toggles) {
          return t.getAttribute('aria-checked') || t.getAttribute('data-state') || 'unknown';
        }
        return 'no toggle found';
      });

      console.log(`\n${name}: ${title.substring(0, 50)} | toggle: ${toggleState}`);
      await page.screenshot({ path: `/tmp/zap-${name}.png` });
    }
  } else {
    console.log('❌ Login failed or redirected elsewhere');
  }

  await browser.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
