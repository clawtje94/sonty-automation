const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(4000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 3000 }); } catch(e) {}
  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(10000);
  if (page.url().includes('login')) { console.log('Login failed'); await browser.close(); return; }
  console.log('Logged in\n');

  // Go to ZAP-01 and click step 1
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(6000);
  await page.click('text=Lead Created');
  await page.waitForTimeout(3000);

  // Click Test tab
  await page.click('text=Test');
  await page.waitForTimeout(2000);

  // Click on "Lead C" to load its data
  try {
    await page.click('text=Lead C');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap01-leadC-1.png' });

    // Scroll down in the test results to see all fields
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => {
        document.querySelectorAll('div').forEach(d => {
          const r = d.getBoundingClientRect();
          const s = window.getComputedStyle(d);
          if (r.right > 450 && r.left < 700 && r.height > 200 &&
              (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
            d.scrollTop += 300;
          }
        });
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `/tmp/zap01-leadC-${i+2}.png` });
    }

    // Try to get text from the right panel
    const panelText = await page.evaluate(() => {
      // Look for the panel on the right side
      const divs = document.querySelectorAll('div');
      for (const d of divs) {
        const r = d.getBoundingClientRect();
        if (r.left > 450 && r.width > 200 && r.height > 400) {
          const text = d.innerText;
          if (text.includes('Parsed') || text.includes('Email') || text.includes('Item')) {
            return text;
          }
        }
      }
      return '';
    });

    if (panelText) {
      console.log('=== Reuzenpanda test data fields ===');
      const lines = panelText.split('\n').filter(l => l.trim());
      lines.forEach(l => console.log('  ' + l.substring(0, 120)));
    }
  } catch(e) {
    console.log('Could not load test data:', e.message);
  }

  // Also check the existing working zap: Reuzenpanda → Google Sheets
  console.log('\n=== Checking Reuzenpanda → Google Sheets zap ===');
  // From the zaps list, find this zap
  await page.goto('https://zapier.com/app/zaps');
  await page.waitForTimeout(5000);

  // Click on the Google Sheets zap
  try {
    await page.click('text=Reuzenpanda Offerte');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/zap-gsheets-1.png' });

    // Click step 1 to see the trigger data
    const steps = await page.$$('text=Lead Created, text=New Lead, text=Reuzenpanda');
    if (steps.length > 0) {
      await steps[0].click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: '/tmp/zap-gsheets-2.png' });
  } catch(e) {
    console.log('Google Sheets zap inspection failed:', e.message);
  }

  await browser.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
