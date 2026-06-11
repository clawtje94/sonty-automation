const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile6', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Login
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

  const cap = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap > 0) { console.log('CAPTCHA - aborting'); await ctx.close(); return; }

  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  const b1 = await page.$$('button');
  for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(4000);

  const cap2 = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap2 > 0) { console.log('CAPTCHA after email'); await ctx.close(); return; }

  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  const b2 = await page.$$('button');
  for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(12000);

  if (page.url().includes('login')) { console.log('Login failed'); await ctx.close(); return; }
  console.log('Logged in!\n');

  // Go to ZAP-01 draft
  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  // Click step 3: Create Deal
  console.log('=== Step 3: Create Deal ===');
  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(2000);

  // Scroll down to find the custom Sonty fields
  console.log('Scrolling to find Reuzenpanda fields...');
  let foundField = false;
  for (let i = 0; i < 40; i++) {
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

    // Check for our custom field labels
    const found = await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        const text = l.textContent.trim().toLowerCase();
        if (text.includes('reuzenpanda') || text.includes('reuzen')) {
          return l.textContent.trim();
        }
      }
      return null;
    });

    if (found) {
      console.log('Found field: "' + found + '"');
      foundField = true;
      await page.screenshot({ path: '/tmp/zap01-rp-field.png' });
      break;
    }
  }

  if (!foundField) {
    // Try using the search field at the top of the config panel
    console.log('Field not found by scrolling, trying search...');
    const searchInput = await page.$('input[placeholder*="Search fields"]');
    if (searchInput) {
      await searchInput.fill('reuzenpanda');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/zap01-search-rp.png' });
      console.log('Searched for reuzenpanda');

      // Check what appeared
      const labels = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('label'))
          .filter(l => l.getBoundingClientRect().left > 450)
          .map(l => l.textContent.trim())
          .filter(t => t.length > 2);
      });
      console.log('Labels after search:', labels.join(' | '));
    }
  }

  await page.screenshot({ path: '/tmp/zap01-fields-state.png' });
  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
