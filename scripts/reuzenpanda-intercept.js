const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Intercept ALL API requests
  const apiCalls = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || url.includes('quotation') || url.includes('document') || url.includes('pdf')) {
      apiCalls.push({ method: req.method(), url: url.substring(0, 150) });
    }
  });

  // Login + select Sonty
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'TQGb@eD%5nGRSN9@4Gss');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);
  await page.click('text=Sonty B.V.');
  await page.waitForTimeout(5000);

  console.log('API calls during login:', apiCalls.length);
  apiCalls.forEach(a => console.log('  ' + a.method + ' ' + a.url));
  apiCalls.length = 0; // Reset

  // Go to deals and open a deal
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(5000);

  console.log('\nAPI calls during pipeline load:', apiCalls.length);
  apiCalls.forEach(a => console.log('  ' + a.method + ' ' + a.url));
  apiCalls.length = 0;

  // Click on Chantal's deal
  await page.click('text=Chantal Van Driel');
  await page.waitForTimeout(3000);

  console.log('\nAPI calls when opening deal:', apiCalls.length);
  apiCalls.forEach(a => console.log('  ' + a.method + ' ' + a.url));
  apiCalls.length = 0;

  // Now click the ⋮ menu next to the offerte
  // Find elements near "Offerte #" text
  const offertePos = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent.includes('#20262305') && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.height > 5 && r.height < 30) {
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        }
      }
    }
    return null;
  });

  if (offertePos) {
    console.log('\nOfferte text at:', JSON.stringify(offertePos));

    // The ⋮ should be to the right of the offerte text
    // Click it
    await page.mouse.click(offertePos.x + offertePos.w + 20, offertePos.y + offertePos.h / 2);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/rp-dots-clicked.png' });

    console.log('\nAPI calls after ⋮ click:', apiCalls.length);
    apiCalls.forEach(a => console.log('  ' + a.method + ' ' + a.url));

    // Check for dropdown menu
    const menuText = await page.evaluate(() => {
      const menus = document.querySelectorAll('[class*="menu"], [class*="Menu"], [class*="dropdown"], [class*="Dropdown"], [class*="popup"], [class*="Popup"], [role="menu"], [role="listbox"]');
      let text = '';
      menus.forEach(m => { if (m.offsetHeight > 0) text += m.innerText + '\n'; });
      return text;
    });
    console.log('Menu text:', menuText || '(empty)');
  }

  // Also try clicking directly on the Offerte text
  console.log('\n=== Clicking Offerte text ===');
  apiCalls.length = 0;
  if (offertePos) {
    await page.mouse.click(offertePos.x + 5, offertePos.y + 5);
    await page.waitForTimeout(3000);
    console.log('URL after click:', page.url());
    await page.screenshot({ path: '/tmp/rp-offerte-text-clicked.png' });

    console.log('API calls after offerte click:', apiCalls.length);
    apiCalls.forEach(a => console.log('  ' + a.method + ' ' + a.url));
  }

  // Check all cookies for auth token
  const cookies = await page.context().cookies();
  const authCookies = cookies.filter(c =>
    c.name.toLowerCase().includes('auth') || c.name.toLowerCase().includes('token') ||
    c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('jwt')
  );
  console.log('\nAuth cookies:');
  authCookies.forEach(c => console.log('  ' + c.name + ' = ' + c.value.substring(0, 50) + '...'));

  // Check localStorage for tokens
  const localStorage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('key')) {
        items[key] = window.localStorage.getItem(key).substring(0, 100);
      }
    }
    return items;
  });
  console.log('\nLocalStorage tokens:');
  Object.entries(localStorage).forEach(([k, v]) => console.log('  ' + k + ' = ' + v));

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
