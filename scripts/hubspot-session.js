const { chromium } = require('playwright');
const fs = require('fs');

// Persistent HubSpot session — login once, do everything, then close
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}

  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
    await page.click('button[type="submit"]', { timeout: 3000 });
  }
  await page.waitForTimeout(4000);

  await page.click('text=Sign in with password');
  await page.waitForTimeout(3000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) {
    await page.click('button[type="submit"]', { timeout: 3000 });
  }
  await page.waitForTimeout(5000);

  // Enter verification code
  if (page.url().includes('confirm')) {
    console.log('Entering code 771818...');
    await page.fill('input[placeholder*="code"], input[type="text"]', '771818');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(10000);
  }

  console.log('URL:', page.url());
  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('Login failed');
    await page.screenshot({ path: '/tmp/hs-fail.png' });
    await browser.close();
    return;
  }
  console.log('LOGGED IN!\n');

  // ═══════════════════════════════════════
  // TASK 1: Edit Private App — Add automation scope
  // ═══════════════════════════════════════
  console.log('=== TASK 1: Private App Scopes ===');
  await page.goto('https://app-eu1.hubspot.com/private-apps/147970649/33327041');
  await page.waitForTimeout(5000);

  // Click "App bewerken"
  try {
    await page.click('text=App bewerken', { timeout: 5000 });
    await page.waitForTimeout(5000);
    console.log('Edit mode');
    await page.screenshot({ path: '/tmp/hs-t1-edit.png' });

    // Get page text to understand layout
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').filter(l => l.trim().length > 2).slice(0, 80);
    console.log('Page content (first 80 lines):');
    lines.forEach(l => console.log('  ' + l.trim().substring(0, 100)));
  } catch(e) {
    console.log('Edit failed:', e.message.substring(0, 60));
  }

  await page.screenshot({ path: '/tmp/hs-t1-final.png' });

  // ═══════════════════════════════════════
  // TASK 2: Create Workflow WF-01 (if automation scope works after update)
  // ═══════════════════════════════════════
  console.log('\n=== TASK 2: Check Workflows page ===');
  await page.goto('https://app-eu1.hubspot.com/workflows/147970649');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/hs-t2-workflows.png' });
  console.log('Workflows URL:', page.url());

  // ═══════════════════════════════════════
  // TASK 3: Check existing deals and pipeline
  // ═══════════════════════════════════════
  console.log('\n=== TASK 3: Deals overview ===');
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/objects/0-3/views/all/list');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/hs-t3-deals.png' });

  // ═══════════════════════════════════════
  // TASK 4: Check Line Kongeskov deal
  // ═══════════════════════════════════════
  console.log('\n=== TASK 4: Test deal ===');
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/495510995164');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/hs-t4-deal.png' });

  // Keep browser for more tasks if needed
  // Save state info
  fs.writeFileSync('/tmp/hs-session-active.txt', 'active');

  await browser.close();
  console.log('\nAll tasks done');
})().catch(console.error);
