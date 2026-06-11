const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const STORAGE_FILE = path.join(__dirname, '.hubspot-session.json');

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans.trim()); }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

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
  if (pwLink) {
    await pwLink.click();
    await page.waitForTimeout(3000);
    const pwField = await page.$('input[type="password"]');
    if (pwField) {
      await pwField.fill('Ta4ZERam3$ka$g');
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) await loginBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  const url = page.url();
  console.log('URL after password:', url);

  if (url.includes('confirm-to-login') || url.includes('verify')) {
    console.log('\n*** 2FA VERIFICATION NEEDED ***');
    console.log('HubSpot heeft een code gestuurd naar daimy@sonty.nl');
    console.log('Wacht op code via Telegram...\n');

    // Poll telegram for a new code
    let code = null;
    const startTime = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    while (!code && (Date.now() - startTime) < timeout) {
      console.log('Checking Telegram...');
      try {
        const { execSync } = require('child_process');
        const output = execSync('node scripts/read-telegram-webhook.js 2>/dev/null', {
          cwd: path.join(__dirname, '..'),
          encoding: 'utf-8'
        });
        const lines = output.trim().split('\n');
        const lastMsg = lines[lines.length - 2]; // second to last (last is count)
        // Extract 6-digit codes from recent messages
        for (let i = lines.length - 2; i >= Math.max(0, lines.length - 5); i--) {
          const match = lines[i].match(/\] (\d{6})$/);
          if (match) {
            const potentialCode = match[1];
            // Check if this is a NEW code (not 444656 or 824829 which we already used)
            if (potentialCode !== '444656' && potentialCode !== '824829') {
              code = potentialCode;
              break;
            }
          }
        }
      } catch(e) {}

      if (!code) {
        await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds
      }
    }

    if (!code) {
      console.log('Timeout waiting for code');
      await browser.close();
      return;
    }

    console.log('Got code:', code);
    const codeField = await page.$('input[type="text"]') ||
                      await page.$('input[name="code"]') ||
                      await page.$('input[inputmode="numeric"]');
    if (codeField) {
      await codeField.fill(code);
      const continueBtn = await page.$('button[type="submit"]') ||
                          await page.$('button:has-text("Continue")');
      if (continueBtn) await continueBtn.click();
      await page.waitForTimeout(8000);
    }

    const currentUrl = page.url();
    console.log('After 2FA URL:', currentUrl);

    if (currentUrl.includes('login')) {
      console.log('2FA failed');
      await page.screenshot({ path: '/tmp/hubspot-2fa-failed.png', fullPage: true });
      await browser.close();
      return;
    }
  }

  console.log('LOGIN SUCCESS!');
  await context.storageState({ path: STORAGE_FILE });
  console.log('Session saved!');

  // Close popups
  for (let i = 0; i < 3; i++) {
    const closeButtons = await page.$$('button[aria-label="Close"], button[aria-label="Sluiten"]');
    for (const btn of closeButtons) {
      try { await btn.click(); } catch(e) {}
    }
    await page.waitForTimeout(500);
  }

  // Navigate to meetings
  console.log('\n=== NAVIGATING TO MEETINGS ===');
  await page.goto('https://app-eu1.hubspot.com/meetings/147970649');
  await page.waitForTimeout(5000);

  // Close any new popups
  const modals = await page.$$('[class*="modal"] button[aria-label="Close"], [class*="modal"] button[aria-label="Sluiten"], [class*="dialog"] button, button[data-test-id="dialog-close-button"]');
  for (const m of modals) { try { await m.click(); } catch(e) {} }
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/hubspot-meetings-clean.png', fullPage: true });
  console.log('Meetings URL:', page.url());

  // Dump page info
  const title = await page.title();
  console.log('Page title:', title);

  const allButtons = await page.$$eval('button', btns =>
    btns.map(b => b.textContent?.trim()).filter(Boolean).slice(0, 30)
  );
  console.log('Buttons:', allButtons.join(' | '));

  const allLinks = await page.$$eval('a', links =>
    links.map(l => ({ text: l.textContent?.trim()?.substring(0, 40), href: l.href }))
         .filter(l => l.text && l.href.includes('hubspot'))
         .slice(0, 20)
  );
  console.log('Links:', JSON.stringify(allLinks));

  // Try different paths
  const paths = [
    'https://app-eu1.hubspot.com/meetings/147970649/link/new',
    'https://app-eu1.hubspot.com/settings/147970649/meetings',
    'https://app-eu1.hubspot.com/scheduling-pages/147970649',
  ];

  for (let i = 0; i < paths.length; i++) {
    console.log(`\n--- Trying: ${paths[i]}`);
    await page.goto(paths[i]);
    await page.waitForTimeout(4000);
    console.log('URL:', page.url());
    await page.screenshot({ path: `/tmp/hubspot-path-${i}.png`, fullPage: true });
  }

  // Save session
  await context.storageState({ path: STORAGE_FILE });
  await browser.close();
})().catch(err => console.error('Error:', err.message));
