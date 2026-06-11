const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const verifyCode = process.argv[2]; // Pass 6-digit code as argument
const STORAGE_FILE = path.join(__dirname, '.hubspot-session.json');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Try to reuse saved session
  let context;
  if (fs.existsSync(STORAGE_FILE) && !verifyCode) {
    console.log('Reusing saved session...');
    context = await browser.newContext({ storageState: STORAGE_FILE });
  } else {
    context = await browser.newContext();
  }

  const page = await context.newPage();

  // Check if session is still valid
  if (fs.existsSync(STORAGE_FILE) && !verifyCode) {
    console.log('Testing saved session...');
    await page.goto('https://app-eu1.hubspot.com/contacts/147970649');
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    console.log('Session test URL:', currentUrl);

    if (!currentUrl.includes('login')) {
      console.log('SESSION VALID! Proceeding to meetings...');
      await setupMeetings(page, context);
      await browser.close();
      return;
    }
    console.log('Session expired, logging in fresh...');
  }

  // Fresh login
  console.log('Loading HubSpot login page...');
  await page.goto('https://app.hubspot.com/login');
  await page.waitForTimeout(3000);

  const acceptBtn = await page.$('button:has-text("Alles Accepteren")');
  if (acceptBtn) { await acceptBtn.click(); await page.waitForTimeout(1000); }

  const emailField = await page.$('#username');
  if (emailField) {
    await emailField.fill('daimy@sonty.nl');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await page.waitForTimeout(3000);
  }

  const pwLink = await page.$('button:has-text("Sign in with password")') ||
                 await page.$('a:has-text("Sign in with password")');
  if (!pwLink) {
    console.log('No Sign in with password button found');
    await page.screenshot({ path: '/tmp/hubspot-no-pw-btn.png', fullPage: true });
    await browser.close();
    return;
  }

  await pwLink.click();
  console.log('Clicked Sign in with password');
  await page.waitForTimeout(3000);

  const pwField = await page.$('input[type="password"]');
  if (!pwField) {
    console.log('No password field found');
    await browser.close();
    return;
  }

  await pwField.fill('Ta4ZERam3$ka$g');
  const loginBtn = await page.$('button[type="submit"]');
  if (loginBtn) await loginBtn.click();
  await page.waitForTimeout(5000);

  const url = page.url();
  console.log('URL after password:', url);

  // Handle 2FA
  if (url.includes('confirm-to-login') || url.includes('verify')) {
    console.log('2FA verification page detected');

    if (!verifyCode) {
      console.log('ERROR: No verification code. Run: node hubspot-login.js <6-digit-code>');
      await page.screenshot({ path: '/tmp/hubspot-2fa.png', fullPage: true });
      await browser.close();
      return;
    }

    console.log('Entering verification code:', verifyCode);
    const codeField = await page.$('input[data-test-id="verification-code"]') ||
                      await page.$('input[name="code"]') ||
                      await page.$('input[type="text"]') ||
                      await page.$('input[type="number"]') ||
                      await page.$('input[inputmode="numeric"]');

    if (codeField) {
      await codeField.fill(verifyCode);
      const verifyBtn = await page.$('button[type="submit"]');
      if (verifyBtn) await verifyBtn.click();
      await page.waitForTimeout(8000);
    } else {
      const digitInputs = await page.$$('input[type="text"], input[type="number"], input[inputmode="numeric"]');
      if (digitInputs.length >= 6) {
        for (let i = 0; i < 6; i++) {
          await digitInputs[i].fill(verifyCode[i]);
          await page.waitForTimeout(100);
        }
        const verifyBtn = await page.$('button[type="submit"]');
        if (verifyBtn) await verifyBtn.click();
        await page.waitForTimeout(8000);
      }
    }
  }

  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  if (currentUrl.includes('login')) {
    console.log('Login failed');
    await page.screenshot({ path: '/tmp/hubspot-login-failed.png', fullPage: true });
    await browser.close();
    return;
  }

  console.log('LOGIN SUCCESS! Saving session...');
  await context.storageState({ path: STORAGE_FILE });
  console.log('Session saved to', STORAGE_FILE);

  await setupMeetings(page, context);
  await browser.close();
})().catch(err => console.error('Error:', err.message));

async function setupMeetings(page, context) {
  console.log('\n=== MEETINGS SETUP ===');

  // Close any popups
  async function closePopups() {
    const selectors = [
      'button[aria-label="Close"]', 'button[aria-label="Sluiten"]',
      '.uiCloseButton', '[data-test-id="close-button"]',
      'button:has-text("×")', '.modal-close'
    ];
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) { try { await btn.click(); await page.waitForTimeout(300); } catch(e) {} }
    }
  }

  // Try the meetings scheduling page
  const urls = [
    'https://app-eu1.hubspot.com/meetings/147970649',
    'https://app-eu1.hubspot.com/meetings/147970649/link/new',
    'https://app-eu1.hubspot.com/settings/147970649/meetings',
  ];

  for (let i = 0; i < urls.length; i++) {
    console.log(`\nTrying: ${urls[i]}`);
    await page.goto(urls[i]);
    await page.waitForTimeout(4000);
    await closePopups();
    await page.waitForTimeout(1000);

    const pageUrl = page.url();
    console.log('Landed on:', pageUrl);
    await page.screenshot({ path: `/tmp/hubspot-meetings-${i}.png`, fullPage: true });

    // Check page content
    const bodyText = await page.textContent('body').catch(() => '');
    const keywords = ['meeting', 'vergadering', 'scheduling', 'planningslink', 'Planningslink'];
    const found = keywords.filter(k => bodyText.toLowerCase().includes(k.toLowerCase()));
    if (found.length) console.log('Found keywords:', found.join(', '));

    // List all buttons
    const buttons = await page.$$eval('button, a[href*="meeting"], a[href*="scheduling"]', els =>
      els.map(e => ({ tag: e.tagName, text: e.textContent?.trim()?.substring(0, 50), href: e.href || '' }))
          .filter(e => e.text)
    );
    console.log('Relevant elements:', JSON.stringify(buttons.slice(0, 15)));
  }

  // Save session again
  await context.storageState({ path: STORAGE_FILE });
}
