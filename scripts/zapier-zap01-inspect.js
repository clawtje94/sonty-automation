const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login - exactly like the working version
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(4000);

  // Accept cookies
  try {
    await page.click('button:has-text("Accept all cookies")', { timeout: 3000 });
    await page.waitForTimeout(500);
  } catch (e) { /* no cookie banner */ }

  // Email step
  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(3000);

  // Password step
  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(10000);

  console.log('URL:', page.url());
  if (page.url().includes('login')) {
    console.log('Login failed');
    await page.screenshot({ path: '/tmp/zap01-login-fail.png' });
    await browser.close();
    return;
  }
  console.log('Logged in!\n');

  // Go to ZAP-01
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/zap01-editor.png' });

  // Click step 1
  console.log('=== Clicking Step 1 ===');
  try {
    await page.click('text=Lead Created', { timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap01-s1.png' });
  } catch (e) {
    console.log('Step 1 click failed, trying alternative...');
    // Try clicking the first step card
    const cards = await page.$$('[class*="step"], [class*="Step"], [data-testid*="step"]');
    console.log('Found', cards.length, 'step cards');
    if (cards.length > 0) {
      await cards[0].click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/zap01-s1-alt.png' });
    }
  }

  // Click step 2
  console.log('=== Clicking Step 2 ===');
  try {
    await page.click('text=Create or Update Contact', { timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap01-s2.png' });
  } catch (e) { console.log('Step 2 click failed'); }

  // Scroll down for step 3 and 4
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);

  console.log('=== Clicking Step 3 ===');
  try {
    await page.click('text=Create Deal', { timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap01-s3.png' });
  } catch (e) { console.log('Step 3 click failed'); }

  console.log('=== Clicking Step 4 ===');
  try {
    await page.click('text=Create Associations', { timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap01-s4.png' });
  } catch (e) { console.log('Step 4 click failed'); }

  // Also check if there are any errors/warnings on the steps
  const errorElements = await page.$$('[class*="error"], [class*="warning"], [class*="Error"], [class*="Warning"]');
  console.log('\nError/warning elements found:', errorElements.length);

  await browser.close();
  console.log('Done');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
