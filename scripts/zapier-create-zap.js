const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login to Zapier
  console.log('Logging in to Zapier...');
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/zapier-login.png', fullPage: true });

  // Fill login
  const emailField = await page.$('input[name="email"], input[type="email"], #email');
  if (emailField) {
    await emailField.fill('daimy@sonty.nl');
    // Look for continue/next button
    const continueBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Next")');
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(3000);
    }
    
    // Password
    const pwField = await page.$('input[type="password"], input[name="password"]');
    if (pwField) {
      await pwField.fill('D^mR&F%82WtBrVK&fnm8');
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) await loginBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  console.log('After login URL:', page.url());
  await page.screenshot({ path: '/tmp/zapier-after-login.png', fullPage: true });

  if (page.url().includes('login') || page.url().includes('signin')) {
    console.log('Login might have failed');
    const bodyText = await page.textContent('body').catch(() => '');
    console.log('Page text (first 500):', bodyText.substring(0, 500));
    await browser.close();
    return;
  }

  console.log('Logged in!');
  
  // Navigate to zaps page
  await page.goto('https://zapier.com/app/zaps');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/zapier-zaps.png', fullPage: true });
  console.log('Zaps page URL:', page.url());

  // List existing zaps
  const zapElements = await page.$$eval('[data-testid*="zap"], [class*="ZapRow"], tr[class*="zap"]', els =>
    els.map(e => e.textContent?.trim()?.substring(0, 100))
  );
  console.log('Zaps found:', zapElements.length);
  zapElements.slice(0, 10).forEach(z => console.log('  ', z));

  await browser.close();
  console.log('Done');
})().catch(err => console.error('Error:', err.message));
