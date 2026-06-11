const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login + code in one shot
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(4000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(3000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(2000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);

  if (page.url().includes('confirm')) {
    await page.fill('input[placeholder*="code"], input[type="text"]', '545531');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(8000);
  }

  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('FAILED');
    await browser.close();
    return;
  }
  console.log('LOGGED IN');

  // Open Isa Geer deal
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/496073833660');
  await page.waitForTimeout(8000);

  // Close popups
  try { await page.click('[aria-label="Close"]', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("×")', { timeout: 1000 }); } catch(e) {}
  try { await page.click('button:has-text("Sluiten")', { timeout: 1000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/hs-deal-final.png' });
  console.log('Screenshot saved');

  // Send to Telegram as photo
  const fileData = fs.readFileSync('/tmp/hs-deal-final.png');
  const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
  const parts = [
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
    '1700128390\r\n',
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="caption"\r\n\r\n' +
    'HubSpot deal pagina - Isa Geer\r\n',
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="photo"; filename="hubspot-deal.png"\r\n' +
    'Content-Type: image/png\r\n\r\n',
  ];

  const body = Buffer.concat([
    Buffer.from(parts.join('')),
    fileData,
    Buffer.from('\r\n--' + boundary + '--\r\n'),
  ]);

  const res = await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendPhoto', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body,
  });
  const result = await res.json();
  console.log('Telegram photo:', result.ok ? 'SENT' : 'FAILED - ' + JSON.stringify(result).substring(0, 100));

  // Also scroll down in sidebar to show Sonty section and take another screenshot
  await page.evaluate(() => {
    const sidebar = document.querySelector('[class*="sidebar"], [data-test-id*="sidebar"]');
    if (sidebar) sidebar.scrollTop = 500;
    // Also try scrolling the left column
    document.querySelectorAll('div').forEach(d => {
      const r = d.getBoundingClientRect();
      const s = window.getComputedStyle(d);
      if (r.x < 300 && r.height > 400 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
        d.scrollTop = 500;
      }
    });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/hs-deal-scrolled.png' });

  // Send scrolled version too
  const fileData2 = fs.readFileSync('/tmp/hs-deal-scrolled.png');
  const boundary2 = '----FormBoundary' + Math.random().toString(36).substr(2);
  const body2 = Buffer.concat([
    Buffer.from('--' + boundary2 + '\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n1700128390\r\n' +
      '--' + boundary2 + '\r\nContent-Disposition: form-data; name="caption"\r\n\r\nSonty Offerte sectie (scroll down)\r\n' +
      '--' + boundary2 + '\r\nContent-Disposition: form-data; name="photo"; filename="hubspot-scrolled.png"\r\nContent-Type: image/png\r\n\r\n'),
    fileData2,
    Buffer.from('\r\n--' + boundary2 + '--\r\n'),
  ]);

  const res2 = await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendPhoto', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary2 },
    body: body2,
  });
  const result2 = await res2.json();
  console.log('Scrolled photo:', result2.ok ? 'SENT' : 'FAILED');

  await browser.close();
  console.log('Done');
})().catch(console.error);
