const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login to Zapier
  await page.goto('https://zapier.com/sign-in');
  await page.waitForTimeout(3000);

  const emailInput = await page.$('input[name="email"], input[type="email"]');
  if (emailInput) {
    await emailInput.fill('daimy@sonty.nl');
    // Look for continue/next button
    const continueBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Next")');
    if (continueBtn) await continueBtn.click();
    await page.waitForTimeout(3000);

    const pwInput = await page.$('input[name="password"], input[type="password"]');
    if (pwInput) {
      await pwInput.fill('D^mR&F%82WtBrVK&fnm8');
      const loginBtn = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');
      if (loginBtn) await loginBtn.click();
    }
  }

  await page.waitForTimeout(8000);
  console.log('URL:', page.url());
  await page.screenshot({ path: '/tmp/zapier-01-after-login.png' });

  if (page.url().includes('sign-in') || page.url().includes('login')) {
    console.log('Login may have failed, checking...');
    await page.screenshot({ path: '/tmp/zapier-01b-login.png' });
  }

  // Go to zaps overview
  await page.goto('https://zapier.com/app/zaps');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zapier-02-zaps.png' });

  // Try to get all zap info from the page
  const zapInfo = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr, [data-testid*="zap"], [class*="ZapRow"], [class*="zap-row"]');
    const results = [];
    rows.forEach(row => {
      const text = row.textContent;
      if (text && text.length > 10 && text.length < 500) {
        results.push(text.replace(/\s+/g, ' ').trim().substring(0, 200));
      }
    });
    return results;
  });

  console.log('\nZap rows found:', zapInfo.length);
  zapInfo.forEach((z, i) => console.log(`  ${i}: ${z}`));

  // Also check specific zap IDs
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
    await page.waitForTimeout(3000);
    const status = await page.evaluate(() => {
      // Look for status indicators
      const toggles = document.querySelectorAll('[data-testid*="toggle"], [class*="toggle"], [role="switch"]');
      for (const t of toggles) {
        return t.getAttribute('aria-checked') || t.getAttribute('data-state') || t.textContent;
      }
      return 'unknown';
    });
    const title = await page.title();
    console.log(`\n${name} (${id}): title="${title.substring(0, 60)}" status=${status}`);
    await page.screenshot({ path: `/tmp/zapier-${name}.png` });
  }

  await browser.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
