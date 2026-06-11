const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '.hubspot-session.json');
const USED_CODES = ['444656', '824829', '824249']; // Already used codes

function getLatestCode() {
  try {
    const output = execSync('node scripts/read-telegram-webhook.js 2>/dev/null', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8'
    });
    const lines = output.trim().split('\n');
    for (let i = lines.length - 2; i >= Math.max(0, lines.length - 5); i--) {
      const match = lines[i].match(/\] (\d{6})$/);
      if (match && !USED_CODES.includes(match[1])) {
        return match[1];
      }
    }
  } catch(e) {}
  return null;
}

function sendTelegram(text) {
  try {
    execSync(`curl -s "https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage" -d chat_id=1700128390 -d "text=${text}"`, {
      encoding: 'utf-8'
    });
  } catch(e) {}
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://app.hubspot.com/login');
  await page.waitForTimeout(3000);

  const acceptBtn = await page.$('button:has-text("Alles Accepteren")');
  if (acceptBtn) await acceptBtn.click();
  await page.waitForTimeout(500);

  await page.fill('#username', 'daimy@sonty.nl');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Sign in with password
  const pwLink = await page.$('button:has-text("Sign in with password")') ||
                 await page.$('a:has-text("Sign in with password")');
  if (pwLink) await pwLink.click();
  await page.waitForTimeout(3000);

  await page.fill('input[type="password"]', 'Ta4ZERam3$ka$g');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  if (page.url().includes('confirm-to-login')) {
    console.log('2FA page reached. Asking Daimy for code NOW...');
    sendTelegram('Daimy! NET NU is er een NIEUWE code verstuurd naar je email. Check je email en stuur de 6 cijfers door aub! Ik wacht met het scherm open.');

    // Wait for code with longer timeout
    let code = null;
    for (let i = 0; i < 60; i++) { // 10 minutes
      code = getLatestCode();
      if (code) break;
      console.log(`Waiting for code... (${i * 10}s)`);
      await new Promise(r => setTimeout(r, 10000));
    }

    if (!code) {
      console.log('TIMEOUT - no code received');
      await browser.close();
      return;
    }

    console.log('Got code:', code);
    USED_CODES.push(code);

    await page.fill('input[type="text"]', code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(8000);

    console.log('After 2FA URL:', page.url());
    await page.screenshot({ path: '/tmp/hubspot-after-2fa.png', fullPage: true });
  }

  if (page.url().includes('login')) {
    console.log('Login failed');
    await browser.close();
    return;
  }

  console.log('LOGGED IN!');
  await context.storageState({ path: STORAGE_FILE });

  // Close popups (try multiple times)
  for (let attempt = 0; attempt < 5; attempt++) {
    const closeBtns = await page.$$('button[aria-label="Close"], button[aria-label="Sluiten"], [data-test-id="close-button"], .modal-close');
    for (const btn of closeBtns) {
      try { await btn.click(); } catch(e) {}
    }
    // Also try clicking any overlay dismiss
    try {
      const overlay = await page.$('.overlay-backdrop, .modal-backdrop');
      if (overlay) await overlay.click();
    } catch(e) {}
    await page.waitForTimeout(500);
  }

  // Go to meetings
  console.log('\n=== MEETINGS PAGE ===');
  await page.goto('https://app-eu1.hubspot.com/meetings/147970649');
  await page.waitForTimeout(6000);

  // Dismiss popups again
  for (let i = 0; i < 3; i++) {
    const popups = await page.$$('button[aria-label="Close"], button[aria-label="Sluiten"]');
    for (const p of popups) { try { await p.click(); } catch(e) {} }
    await page.waitForTimeout(500);
  }
  // Click away from modal
  await page.mouse.click(10, 10);
  await page.waitForTimeout(500);
  // Press Escape to close any modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/tmp/hubspot-meetings-final.png', fullPage: true });
  console.log('Final URL:', page.url());

  // List visible elements
  const h1s = await page.$$eval('h1, h2, h3', els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('Headings:', h1s.join(' | '));

  const buttons = await page.$$eval('button', els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('Buttons:', buttons.join(' | '));

  // Try the actual scheduling page path
  console.log('\n=== TRYING SCHEDULING PAGES ===');
  await page.goto('https://app-eu1.hubspot.com/scheduling-pages/147970649');
  await page.waitForTimeout(5000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/hubspot-scheduling.png', fullPage: true });
  console.log('Scheduling URL:', page.url());
  const schedH = await page.$$eval('h1, h2, h3', els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('Scheduling headings:', schedH.join(' | '));

  // Try sales meetings
  console.log('\n=== TRYING SALES MEETINGS ===');
  await page.goto('https://app-eu1.hubspot.com/sales/147970649/meetings');
  await page.waitForTimeout(5000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/hubspot-sales-meetings.png', fullPage: true });
  console.log('Sales meetings URL:', page.url());
  const salesH = await page.$$eval('h1, h2, h3', els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('Sales meetings headings:', salesH.join(' | '));

  const salesBtns = await page.$$eval('button, a[class*="button"], a[class*="btn"]', els =>
    els.map(e => ({ text: e.textContent?.trim()?.substring(0, 60), href: e.href || '' })).filter(e => e.text)
  );
  console.log('Sales meeting elements:', JSON.stringify(salesBtns.slice(0, 20)));

  await context.storageState({ path: STORAGE_FILE });
  await browser.close();
  console.log('\nDone!');
})().catch(err => console.error('Error:', err.message));
