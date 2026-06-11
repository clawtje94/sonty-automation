const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/hs-persist', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Try to go directly to the deal page (might still be logged in)
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/496073833660');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    console.log('Need login - taking screenshot of login page instead');
    // Can't login without code, but let me try
    await page.fill('#username', 'daimy@sonty.nl');
    try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
    await page.waitForTimeout(3000);
    await page.click('text=Sign in with password');
    await page.waitForTimeout(2000);
    await page.fill('#password', 'Ta4ZERam3$ka$g');
    try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
    await page.waitForTimeout(5000);

    if (page.url().includes('confirm')) {
      console.log('NEED_CODE');
      await ctx.close();
      return;
    }

    await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/496073833660');
    await page.waitForTimeout(8000);
  }

  // Close popups
  try { await page.click('[aria-label="Close"]', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("×")', { timeout: 1000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Scroll the left sidebar to show the Sonty section
  await page.evaluate(() => {
    const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
    if (sidebar) sidebar.scrollTop = 300;
  });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/tmp/hs-deal-screenshot.png' });
  console.log('Screenshot saved');

  // Send to Telegram as photo
  const FormData = (await import('node:buffer')).Buffer;
  const photoPath = '/tmp/hs-deal-screenshot.png';

  if (fs.existsSync(photoPath)) {
    const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
    const fileData = fs.readFileSync(photoPath);

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n1700128390\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="hubspot-deal.png"\r\nContent-Type: image/png\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendPhoto', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const result = await res.json();
    console.log('Telegram photo sent:', result.ok ? 'OK' : 'FAILED');
  }

  await ctx.close();
})().catch(console.error);
