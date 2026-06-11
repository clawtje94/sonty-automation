const { chromium } = require('playwright');

(async () => {
  // Fresh profile each time
  const fs = require('fs');
  const dir = '/tmp/zapier-chrome-profile2';
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });

  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
  await page.waitForTimeout(500);

  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  const b1 = await page.$$('button');
  for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(4000);

  const cap = await page.$('iframe[src*="recaptcha"]');
  if (cap) {
    console.log('CAPTCHA detected. Aborting.');
    await page.screenshot({ path: '/tmp/zap-captcha-final.png' });
    await ctx.close();
    return;
  }

  const pw = await page.$('input[type="password"]');
  if (pw) {
    await pw.fill('D^mR&F%82WtBrVK&fnm8');
    const b2 = await page.$$('button');
    for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(12000);
  }

  console.log('URL:', page.url());
  if (page.url().includes('login')) {
    console.log('Login failed');
    await page.screenshot({ path: '/tmp/zap-login-fail2.png' });
    await ctx.close();
    return;
  }
  console.log('Logged in!\n');

  // Go to ZAP-01 step 2
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);

  await page.click('text=Create or Update Contact');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/zap01-s2-config-new.png' });

  // Scroll through all fields
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.left > 450 && r.height > 200 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
          d.scrollTop += 200;
        }
      });
    });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: '/tmp/zap01-s2-bottom.png' });

  // Get full text from right panel
  const panelText = await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const d of divs) {
      const r = d.getBoundingClientRect();
      if (r.left > 450 && r.width > 200 && r.height > 500) {
        return d.innerText;
      }
    }
    return '';
  });

  // Extract field names
  const lines = panelText.split('\n').filter(l => l.trim().length > 3);
  console.log('=== Step 2 fields (HubSpot Contact) ===');
  for (const l of lines) {
    if (l.includes('Contact') || l.includes('First') || l.includes('Last') ||
        l.includes('Phone') || l.includes('Email') || l.includes('Name') ||
        l.includes('Address') || l.includes('City') || l.includes('Postal') ||
        l.includes('Country') || l.includes('Lead') || l.includes('Source') ||
        l.includes('Product') || l.includes('sonty') || l.includes('Enter text')) {
      console.log('  ' + l.trim().substring(0, 100));
    }
  }

  // Also get the full field list
  console.log('\n=== All field labels ===');
  const labels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('label'))
      .filter(l => l.getBoundingClientRect().left > 450)
      .map(l => l.textContent.trim())
      .filter(t => t.length > 2);
  });
  labels.forEach(l => console.log('  ' + l));

  await ctx.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
