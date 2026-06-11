const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);

  await page.fill('input[type="password"]', 'TQGb@eD%5nGRSN9@4Gss');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  console.log('URL:', page.url());
  await page.screenshot({ path: '/tmp/rp-logged-in.png' });

  if (page.url().includes('login')) {
    console.log('Login failed');
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 200));
    await browser.close();
    return;
  }

  console.log('LOGGED IN!\n');

  // Navigate to settings to find API key
  const settingsUrls = [
    'https://hub.reuzenpanda.nl/app/settings',
    'https://hub.reuzenpanda.nl/app/settings/api',
    'https://hub.reuzenpanda.nl/app/settings/integrations',
    'https://hub.reuzenpanda.nl/app/automation',
    'https://hub.reuzenpanda.nl/app/settings/company',
  ];

  for (const url of settingsUrls) {
    await page.goto(url);
    await page.waitForTimeout(3000);
    const curUrl = page.url();
    const text = await page.evaluate(() => document.body.innerText);
    const hasApi = text.toLowerCase().includes('api') || text.toLowerCase().includes('key') || text.toLowerCase().includes('token');
    console.log(url.split('/').pop() + ': ' + (hasApi ? '⚡ API-related!' : 'no api content'));
    if (hasApi) {
      await page.screenshot({ path: '/tmp/rp-' + url.split('/').pop() + '.png' });
      // Extract API key if visible
      const apiLines = text.split('\n').filter(l =>
        l.toLowerCase().includes('api') || l.toLowerCase().includes('key') ||
        l.toLowerCase().includes('token') || l.toLowerCase().includes('secret')
      );
      apiLines.forEach(l => console.log('  ' + l.trim().substring(0, 100)));
    }
  }

  // List all nav items to find the right settings page
  await page.goto('https://hub.reuzenpanda.nl/app/settings');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-settings-nav.png' });

  const navItems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="menuitem"], [role="tab"]'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim().substring(0, 50), href: el.href || '' }))
      .filter(l => l.text.length > 1 && l.text.length < 50);
  });
  console.log('\nAll settings nav items:');
  navItems.forEach(n => console.log('  ' + n.text + (n.href ? ' → ' + n.href : '')));

  // Also check the quotation page to find PDF URL pattern
  console.log('\n=== Checking deals/quotation page ===');
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-deals.png' });

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
