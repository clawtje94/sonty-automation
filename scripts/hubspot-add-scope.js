const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login to HubSpot (EU region)
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/hs-01.png' });

  // Accept cookies
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 3000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}

  // Log all inputs and buttons for debugging
  const inputs = await page.$$('input');
  console.log('Inputs:', inputs.length);
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    const id = await inp.getAttribute('id');
    console.log('  input:', type, name, id);
  }

  // Fill email
  try {
    await page.fill('#username', 'daimy@sonty.nl', { timeout: 3000 });
  } catch(e) {
    try {
      await page.fill('input[type="email"]', 'daimy@sonty.nl', { timeout: 3000 });
    } catch(e2) {
      const firstInput = inputs[0];
      if (firstInput) await firstInput.fill('daimy@sonty.nl');
    }
  }
  console.log('Email filled');

  // Click next
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
    try { await page.click('button[type="submit"]', { timeout: 3000 }); } catch(e2) {
      const btns = await page.$$('button');
      for (const btn of btns) {
        const text = (await btn.textContent()).trim().toLowerCase();
        if (text.includes('next') || text.includes('log') || text.includes('continue')) {
          await btn.click(); break;
        }
      }
    }
  }

  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/hs-02.png' });
  console.log('After email URL:', page.url());

  // Click "Sign in with password"
  try {
    await page.click('text=Sign in with password', { timeout: 5000 });
    await page.waitForTimeout(3000);
    console.log('Clicked Sign in with password');
    await page.screenshot({ path: '/tmp/hs-02b.png' });
  } catch(e) {
    console.log('No "Sign in with password" button');
  }

  // Fill password
  try {
    await page.fill('#password', 'Ta4ZERam3$ka$g', { timeout: 5000 });
    console.log('Password filled');

    try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
      await page.click('button[type="submit"]', { timeout: 3000 });
    }

    await page.waitForTimeout(10000);
    await page.screenshot({ path: '/tmp/hs-03.png' });
    console.log('After login URL:', page.url());
  } catch(e) {
    console.log('Password step issue:', e.message.substring(0, 80));
    await page.screenshot({ path: '/tmp/hs-03-fail.png' });
  }

  // Check if logged in
  if (!page.url().includes('login')) {
    console.log('Logged in to HubSpot!');

    // Go to Private Apps
    await page.goto('https://app-eu1.hubspot.com/private-apps/147970649/33327041');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/hs-private-app.png' });
    console.log('Private app page:', page.url());

    // Look for Scopes tab
    try {
      await page.click('text=Scopes', { timeout: 5000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/hs-scopes.png' });
      console.log('Scopes tab opened');
    } catch(e) {
      console.log('Scopes tab not found');
    }
  } else {
    console.log('Not logged in');
  }

  await browser.close();
  console.log('Done');
})().catch(console.error);
