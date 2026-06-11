const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(3000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(5000);
  if (page.url().includes('confirm')) {
    await page.fill('input[placeholder*="code"], input[type="text"]', '609380');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(10000);
  }
  if (page.url().includes('login')) { console.log('Login failed'); await browser.close(); return; }
  console.log('Logged in');

  // Go to deal record customization
  await page.goto('https://app-eu1.hubspot.com/sales-products-settings/147970649/object/0-3/record-customization');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/hs-customize-1.png' });
  console.log('Customize URL:', page.url());

  // Get page content
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 1000));

  // Look for sidebar/layout options
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim().substring(0, 50), href: el.href || '' }))
      .filter(l => l.text.length > 1);
  });
  console.log('\nAll links/buttons:');
  links.forEach(l => console.log('  ' + l.text + (l.href ? ' → ' + l.href.substring(0, 80) : '')));

  await page.screenshot({ path: '/tmp/hs-customize-2.png' });

  // Try clicking on "Standaard weergave" or "Default view" or any layout option
  try {
    await page.click('text=Standaard', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/hs-customize-3.png' });
  } catch(e) {}

  // Try clicking "Bewerken" or "Edit" to edit the layout
  try {
    await page.click('text=Bewerken', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/hs-customize-edit.png' });
    console.log('\nEdit mode URL:', page.url());
  } catch(e) {
    try {
      await page.click('text=Edit', { timeout: 2000 });
      await page.waitForTimeout(3000);
    } catch(e2) {}
  }

  await browser.close();
  console.log('Done');
})().catch(console.error);
