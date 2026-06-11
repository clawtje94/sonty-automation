const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '.zapier-session.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Going to Zapier login...');
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(3000);

  // Accept cookies
  try {
    const cookieBtn = await page.$('button:has-text("Accept all cookies")');
    if (cookieBtn) { await cookieBtn.click(); await page.waitForTimeout(500); }
  } catch(e) {}

  // Fill email
  console.log('Filling email...');
  const emailInput = await page.$('input[name="email"], input[type="email"]');
  if (emailInput) {
    await emailInput.click();
    await emailInput.fill('daimy@sonty.nl');
    await page.waitForTimeout(500);
  }
  
  // Click Continue button
  const continueBtn = await page.$('button:has-text("Continue")');
  if (continueBtn) {
    await continueBtn.click();
    console.log('Clicked Continue');
  }
  await page.waitForTimeout(4000);
  
  await page.screenshot({ path: '/tmp/zapier-after-email.png', fullPage: true });
  console.log('URL after email:', page.url());

  // Check for password field
  const pwField = await page.$('input[type="password"]');
  if (pwField) {
    console.log('Found password field');
    await pwField.fill('D^mR&F%82WtBrVK&fnm8');
    await page.waitForTimeout(500);
    
    // Click login/continue button
    const loginBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Log in")');
    if (loginBtn) {
      await loginBtn.click();
      console.log('Clicked login');
    }
    await page.waitForTimeout(6000);
  } else {
    console.log('No password field found, checking page...');
    const bodyText = await page.textContent('body').catch(() => '');
    console.log('Page text:', bodyText.substring(0, 300));
  }

  console.log('Final URL:', page.url());
  await page.screenshot({ path: '/tmp/zapier-loggedin.png', fullPage: true });

  if (!page.url().includes('login')) {
    console.log('LOGIN SUCCESS!');
    await context.storageState({ path: STORAGE_FILE });
    
    // Now navigate to zaps
    await page.goto('https://zapier.com/app/assets/zaps');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: '/tmp/zapier-zaps-loggedin.png', fullPage: true });
    console.log('Zaps URL:', page.url());
  } else {
    console.log('Login failed');
  }

  await browser.close();
})().catch(err => console.error('Error:', err.message));
