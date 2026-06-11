const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://app.trengo.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[name="email"], input[type="email"]', 'daimy@sonty.nl');
  await page.fill('input[name="password"], input[type="password"]', 'CZ%bWD64XVs6Kf');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  if (page.url().includes('login')) { console.log('Login failed'); await browser.close(); return; }
  console.log('Logged in!');

  // Go to users page
  await page.goto('https://app.trengo.com/admin/users');
  await page.waitForTimeout(4000);

  // Click "Send verification email" button
  const sendBtn = await page.$('button:has-text("Send verification email")');
  if (sendBtn) {
    console.log('Clicking "Send verification email"...');
    await sendBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/trengo-verification-sent.png', fullPage: true });
    console.log('Verification email sent to daimy@sonty.nl!');
  } else {
    console.log('Button not found');
  }

  await browser.close();
})().catch(err => console.error('Error:', err.message));
