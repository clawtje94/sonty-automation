const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'zapier-session.json');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 Zapier Login v2');

  await page.goto('https://zapier.com/app/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Dismiss cookie banner
  const cookieBtn = page.locator('button').filter({ hasText: /accept all/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
    console.log('  Cookie banner dismissed');
  }

  // Email — Zapier shows "Welcome back" if email is remembered
  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('daimy@sonty.nl');
    await page.waitForTimeout(500);
    console.log('  Email ingevuld');

    // Klik Continue/Submit na email
    const emailSubmit = page.locator('button[type="submit"], button').filter({ hasText: /continue|log in|inloggen/i }).first();
    if (await emailSubmit.isVisible().catch(() => false)) {
      await emailSubmit.click();
      await page.waitForTimeout(3000);
    }
  }

  // Password
  const passInput = page.locator('input[name="password"], input[type="password"]').first();
  await passInput.waitFor({ state: 'visible', timeout: 10000 });
  await passInput.fill('D^mR&F%82WtBrVK&fnm8');
  await page.waitForTimeout(500);
  console.log('  Wachtwoord ingevuld');

  // Klik Continue/Login
  const loginBtn = page.locator('button[type="submit"], button').filter({ hasText: /continue|log in|inloggen/i }).first();
  await loginBtn.click();
  await page.waitForTimeout(8000);
  console.log('  Login geklikt');

  const url = page.url();
  console.log('  URL:', url);
  await page.screenshot({ path: path.join(__dirname, 'wf-debug-ZAPIER-login2.png') });

  // Check voor 2FA
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
  if (pageText.toLowerCase().includes('verification') || pageText.toLowerCase().includes('code') ||
      pageText.toLowerCase().includes('2fa') || pageText.toLowerCase().includes('two-factor')) {
    console.log('  ⚠️ 2FA/verificatie vereist!');
    console.log('  Tekst:', pageText.substring(0, 300));
  }

  // Check of we ingelogd zijn
  if (url.includes('/app/zaps') || url.includes('/app/dashboard') || url.includes('/app/home')) {
    console.log('  ✅ Ingelogd op dashboard!');
  } else if (url.includes('/app/login')) {
    console.log('  ❌ Nog op login pagina');
    console.log('  Pagina:', pageText.substring(0, 500));
  } else {
    console.log('  ℹ️ Onbekende pagina:', url);
    console.log('  Pagina:', pageText.substring(0, 500));
  }

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState));
  console.log('  Sessie opgeslagen');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
