const { chromium } = require('playwright');
const fs = require('fs');

const PROFILE_DIR = __dirname + '/../data/hubspot-browser';
const ACCOUNT_ID = '147970649';
const CODE = process.argv[2] || '';

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Login
  await page.goto('https://app-eu1.hubspot.com/contacts/' + ACCOUNT_ID);
  await page.waitForTimeout(5000);

  if (page.url().includes('login')) {
    console.log('Logging in...');
    try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
    try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}

    const emailInput = await page.$('#username');
    if (emailInput) {
      await emailInput.fill('daimy@sonty.nl');
      try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
      await page.waitForTimeout(3000);
      await page.click('text=Sign in with password');
      await page.waitForTimeout(2000);
      await page.fill('#password', 'Ta4ZERam3$ka$g');
      try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
      await page.waitForTimeout(5000);
    }

    if (page.url().includes('confirm') && CODE) {
      await page.fill('input[placeholder*="code"], input[type="text"]', CODE);
      await page.click('button:has-text("Continue"), button[type="submit"]');
      await page.waitForTimeout(8000);
    }
  }

  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('FAILED - need code');
    await ctx.close();
    return;
  }
  console.log('LOGGED IN');

  // 1. Take screenshot of Isa Geer deal
  console.log('\n=== Screenshot Isa Geer ===');
  await page.goto('https://app-eu1.hubspot.com/contacts/' + ACCOUNT_ID + '/record/0-3/496073833660');
  await page.waitForTimeout(8000);
  try { await page.click('[aria-label="Close"]', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("×")', { timeout: 1000 }); } catch(e) {}
  try { await page.click('button:has-text("Sluiten")', { timeout: 1000 }); } catch(e) {}
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/hs-deal-v2.png' });
  console.log('Screenshot saved');

  // Send to Telegram
  const fileData = fs.readFileSync('/tmp/hs-deal-v2.png');
  const boundary = '----FB' + Math.random().toString(36).substr(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n1700128390\r\n--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nHubSpot Deal - Isa Geer (met telefoon + bedrag)\r\n--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="hs.png"\r\nContent-Type: image/png\r\n\r\n`),
    fileData,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendPhoto', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  console.log('Photo sent:', (await res.json()).ok ? 'OK' : 'FAILED');

  // 2. Go to layout editor
  console.log('\n=== Layout Editor ===');
  await page.goto('https://app-eu1.hubspot.com/sales-products-settings/' + ACCOUNT_ID + '/object/0-3/record-customization');
  await page.waitForTimeout(5000);
  await page.click('a:has-text("Standaardweergave")');
  await page.waitForTimeout(8000);
  console.log('Layout URL:', page.url());
  await page.screenshot({ path: '/tmp/hs-layout-v2.png' });

  // Close tutorial popup
  for (let i = 0; i < 5; i++) {
    try { await page.click('button:has-text("Volgende")', { timeout: 1000 }); await page.waitForTimeout(500); } catch(e) { break; }
  }
  try { await page.click('button:has-text("Klaar")', { timeout: 1000 }); } catch(e) {}
  try { await page.click('button:has-text("Sluiten")', { timeout: 1000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Click on "Over: Deal" card to configure its properties
  console.log('\nConfiguring sidebar...');
  try {
    // Find the pencil/edit icon on "Over: Deal"
    const overDealSection = await page.$('text=Over: Deal');
    if (overDealSection) {
      const rect = await overDealSection.boundingBox();
      if (rect) {
        // Click the edit icon (pencil) to the right of "Over: Deal"
        await page.mouse.click(rect.x + rect.width + 30, rect.y + rect.height / 2);
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/hs-sidebar-edit.png' });
        console.log('Sidebar edit opened');

        // Get what's in the edit panel
        const panelText = await page.evaluate(() => document.body.innerText);
        const lines = panelText.split('\n').filter(l =>
          l.includes('eigenschap') || l.includes('property') || l.includes('Toevoegen') ||
          l.includes('Verwijderen') || l.includes('Sonty') || l.includes('sonty')
        );
        console.log('Sidebar options:', lines.join(' | '));
      }
    }
  } catch(e) {
    console.log('Sidebar config failed:', e.message.substring(0, 60));
  }

  await page.screenshot({ path: '/tmp/hs-final-v2.png' });

  // Send layout screenshot too
  const layoutData = fs.readFileSync('/tmp/hs-layout-v2.png');
  const boundary2 = '----FB' + Math.random().toString(36).substr(2);
  const body2 = Buffer.concat([
    Buffer.from(`--${boundary2}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n1700128390\r\n--${boundary2}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nHubSpot Layout Editor\r\n--${boundary2}\r\nContent-Disposition: form-data; name="photo"; filename="layout.png"\r\nContent-Type: image/png\r\n\r\n`),
    layoutData,
    Buffer.from(`\r\n--${boundary2}--\r\n`),
  ]);
  await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendPhoto', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary2}` },
    body: body2,
  });

  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
