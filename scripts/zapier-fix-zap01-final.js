const { chromium } = require('playwright');

async function login(page) {
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
  await page.waitForTimeout(500);

  // Step 1: Email
  const emailInput = await page.$('input[type="email"]');
  if (!emailInput) { console.log('No email input found'); return false; }
  await emailInput.fill('daimy@sonty.nl');

  // Find and click the continue/submit button
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = (await btn.textContent()).trim();
    if (text === 'Continue' || text === 'Next' || text === 'Log in') {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(4000);

  // Step 2: Password
  const pwInput = await page.$('input[type="password"]');
  if (!pwInput) { console.log('No password input'); return false; }
  await pwInput.fill('D^mR&F%82WtBrVK&fnm8');

  const buttons2 = await page.$$('button');
  for (const btn of buttons2) {
    const text = (await btn.textContent()).trim();
    if (text === 'Continue' || text === 'Log in' || text === 'Sign in') {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(10000);

  return !page.url().includes('login');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const loggedIn = await login(page);
  if (!loggedIn) {
    console.log('Login failed at URL:', page.url());
    await page.screenshot({ path: '/tmp/zap-final-login-fail.png' });
    await browser.close();
    return;
  }
  console.log('Logged in!\n');

  // Go to ZAP-01
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(6000);

  // Click step 1 trigger
  await page.click('text=Lead Created');
  await page.waitForTimeout(3000);

  // Click Test tab
  try {
    await page.click('text=Test');
    await page.waitForTimeout(2000);
  } catch(e) {}

  // Click "Lead C" to select test data
  try {
    await page.click('text=Lead C');
    await page.waitForTimeout(4000);
  } catch(e) { console.log('Could not click Lead C'); }

  // Take full page screenshot of the test results
  await page.screenshot({ path: '/tmp/zap01-test-result.png', fullPage: true });

  // Get ALL text from the page to find Reuzenpanda field data
  const allText = await page.evaluate(() => document.body.innerText);

  // Extract Reuzenpanda-related data
  const lines = allText.split('\n');
  console.log('=== All text containing field data ===');
  for (const line of lines) {
    const l = line.trim();
    if (l.length > 3 && l.length < 200) {
      // Look for field-like patterns
      if (l.includes(':') || l.includes('Parsed') || l.includes('Free') ||
          l.includes('Item') || l.includes('Board') || l.includes('Column') ||
          l.includes('email') || l.includes('Email') || l.includes('phone') ||
          l.includes('Phone') || l.includes('name') || l.includes('Name') ||
          l.includes('address') || l.includes('Address') || l.includes('price') ||
          l.includes('Price') || l.includes('product') || l.includes('Product') ||
          l.includes('Subject') || l.includes('Status') || l.includes('achternaam') ||
          l.includes('voornaam') || l.includes('telefoon') || l.includes('stad') ||
          l.includes('postcode') || l.includes('straat') || l.includes('prijs') ||
          l.includes('@') || l.includes('lead') || l.includes('Lead') ||
          l.includes('Field') || l.includes('field') || l.includes('Value') ||
          l.includes('Person') || l.includes('person')) {
        console.log('  ' + l.substring(0, 150));
      }
    }
  }

  await browser.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
