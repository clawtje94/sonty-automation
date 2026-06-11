const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile5', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

  const cap = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap > 0) { console.log('CAPTCHA'); await ctx.close(); return; }

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
  console.log('Logged in');

  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);

  // Toggle via JS click
  const toggled = await page.evaluate(() => {
    const el = document.querySelector('[class*="ZapToggle"]');
    if (el) { el.click(); return 'clicked'; }
    return 'not found';
  });
  console.log('Toggle:', toggled);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap-toggled.png' });

  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').filter(l =>
    l.includes('ON') || l.includes('OFF') || l.includes('Draft') ||
    l.includes('Active') || l.includes('Published') || l.includes('turned on')
  );
  console.log('Status:', lines.map(l => l.trim()).join(' | '));

  await ctx.close();
  console.log('Done');
})().catch(console.error);
