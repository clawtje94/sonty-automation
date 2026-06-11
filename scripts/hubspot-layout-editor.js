const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login with saved session — try going directly
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(3000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(5000);
  if (page.url().includes('confirm')) {
    await page.fill('input[placeholder*="code"], input[type="text"]', '470871');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(10000);
  }

  // Go to layout editor for deals
  console.log('Going to layout editor...');
  await page.goto('https://app-eu1.hubspot.com/layout-editor/147970649/CRM_RECORD/deals');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/hs-layout-1.png' });
  console.log('Layout editor URL:', page.url());

  // If that didn't work, try the link from the settings page
  if (page.url().includes('login') || page.url().includes('404')) {
    // Try the Standaardweergave link
    await page.goto('https://app-eu1.hubspot.com/sales-products-settings/147970649/object/0-3/record-customization');
    await page.waitForTimeout(5000);
    try {
      await page.click('text=Standaardweergave');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/tmp/hs-layout-2.png' });
      console.log('Via settings, URL:', page.url());
    } catch(e) {}
  }

  // Get the page content
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 1000));

  // List all interactive elements
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="tab"], [draggable]'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim().substring(0, 50), tag: el.tagName, href: el.href || '' }))
      .filter(l => l.text.length > 1);
  });
  console.log('\nElements:');
  elements.slice(0, 30).forEach(e => console.log('  [' + e.tag + '] ' + e.text));

  // Take screenshots of different sections
  await page.screenshot({ path: '/tmp/hs-layout-full.png', fullPage: true });

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
