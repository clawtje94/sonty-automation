const { chromium } = require('playwright');

(async () => {
  // Try headless first, if CAPTCHA then switch to visible browser
  let browser = await chromium.launch({ headless: true });
  let page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);

  const hasCaptcha = await page.locator('iframe[src*="recaptcha"]').count();
  if (hasCaptcha > 0) {
    console.log('CAPTCHA in headless mode — switching to visible browser...');
    await browser.close();

    // Launch visible browser so user can solve CAPTCHA
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto('https://zapier.com/app/login');
    await page.waitForTimeout(3000);

    try { await page.click('button:has-text("Accept all cookies")', { timeout: 3000 }); } catch(e) {}

    console.log('Browser is open op je scherm. Los de CAPTCHA op als die er is.');
    console.log('Wachten tot CAPTCHA opgelost is (max 2 min)...');

    // Wait for either: password field appears OR URL changes (login success)
    try {
      await page.waitForFunction(() => {
        return document.querySelector('input[type="password"]') !== null ||
               !window.location.href.includes('login');
      }, { timeout: 120000 });
    } catch(e) {
      console.log('Timeout. Check je scherm.');
      await page.screenshot({ path: '/tmp/zap-visible-timeout.png' });
      await browser.close();
      return;
    }
  } else {
    console.log('Geen CAPTCHA! Doorgaan met login...');
  }

  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

  // Fill email if needed
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.fill('daimy@sonty.nl');
    const btns = await page.$$('button');
    for (const btn of btns) {
      if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; }
    }
    await page.waitForTimeout(4000);
  }

  // Fill password if needed
  const pwInput = await page.$('input[type="password"]');
  if (pwInput) {
    await pwInput.fill('D^mR&F%82WtBrVK&fnm8');
    const btns = await page.$$('button');
    for (const btn of btns) {
      if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; }
    }
    await page.waitForTimeout(12000);
  }

  if (page.url().includes('login')) {
    console.log('Login failed. URL:', page.url());
    await page.screenshot({ path: '/tmp/zap-retry-fail.png' });
    await browser.close();
    return;
  }

  console.log('Ingelogd! URL:', page.url());

  // ═══════════════════════════════════════
  // FIX ZAP-01 — Step by step
  // ═══════════════════════════════════════
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);
  console.log('\n=== ZAP-01 Editor geladen ===');

  // ── STEP 2: Fix Contact mapping (add Phone) ──
  console.log('\n── Step 2: Contact Phone toevoegen ──');
  await page.click('text=Create or Update Contact');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Scroll down in the config panel to find Phone Number field
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.left > 450 && r.height > 200 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
          d.scrollTop += 150;
        }
      });
    });
    await page.waitForTimeout(150);

    // Check if we can see Phone Number
    const phoneLabel = await page.$('text=Phone Number');
    if (phoneLabel) {
      console.log('  Found Phone Number field!');
      await page.screenshot({ path: '/tmp/zap01-phone-found.png' });
      break;
    }
  }
  await page.screenshot({ path: '/tmp/zap01-s2-phone-area.png' });

  // ── STEP 3: Fix Deal Name ──
  console.log('\n── Step 3: Deal Name fixen ──');
  // First scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/zap01-s3-config.png' });

  // Get all text in the right panel to see current config
  const s3Text = await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const d of divs) {
      const r = d.getBoundingClientRect();
      if (r.left > 450 && r.width > 200 && r.height > 400) {
        return d.innerText;
      }
    }
    return '';
  });
  console.log('Step 3 config text:');
  const s3lines = s3Text.split('\n').filter(l => l.trim().length > 2);
  s3lines.forEach(l => console.log('  ' + l.trim().substring(0, 100)));

  // ── TEST RUN ──
  console.log('\n── Test Run ──');
  // Click "Test run" button at the top
  try {
    await page.click('text=Test run', { timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap01-testrun-1.png' });

    // Wait for test to complete
    await page.waitForTimeout(15000);
    await page.screenshot({ path: '/tmp/zap01-testrun-2.png' });

    // Get test results
    const resultText = await page.evaluate(() => document.body.innerText);
    const resultLines = resultText.split('\n').filter(l =>
      l.includes('success') || l.includes('error') || l.includes('Error') ||
      l.includes('Success') || l.includes('created') || l.includes('Created') ||
      l.includes('failed') || l.includes('Failed') || l.includes('skip')
    );
    console.log('Test results:');
    resultLines.forEach(l => console.log('  ' + l.trim().substring(0, 120)));
  } catch(e) {
    console.log('Test run failed:', e.message.substring(0, 100));
  }

  await page.screenshot({ path: '/tmp/zap01-final-state.png' });

  // Keep browser open for a moment to capture final state
  await page.waitForTimeout(3000);
  await browser.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
