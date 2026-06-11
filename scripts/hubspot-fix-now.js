const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login + code in one go
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
    await page.fill('input[placeholder*="code"], input[type="text"]', '447571');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(10000);
  }

  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('FAILED:', page.url());
    await browser.close();
    return;
  }
  console.log('LOGGED IN');

  // Go directly to Isa Geer and click Aanpassen
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/496073833660');
  await page.waitForTimeout(8000);

  // Click Aanpassen link on the deal page
  try {
    await page.click('a:has-text("Aanpassen")');
    await page.waitForTimeout(8000);
    console.log('Aanpassen URL:', page.url());
    await page.screenshot({ path: '/tmp/hs-layout.png' });
  } catch(e) {
    console.log('Aanpassen not found on deal page');
    // Try settings route
    await page.goto('https://app-eu1.hubspot.com/sales-products-settings/147970649/object/0-3/record-customization');
    await page.waitForTimeout(5000);
    try {
      await page.click('a:has-text("Standaardweergave")');
      await page.waitForTimeout(8000);
      console.log('Via settings URL:', page.url());
      await page.screenshot({ path: '/tmp/hs-layout.png' });
    } catch(e2) {}
  }

  // Now we should be in the layout editor
  const editorText = await page.evaluate(() => document.body.innerText);
  console.log('\n' + editorText.substring(0, 1500));

  // Take full page screenshot
  await page.screenshot({ path: '/tmp/hs-layout-full.png', fullPage: true });

  // List all draggable/interactive elements in the editor
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, [draggable], [role="tab"], [class*="card"], [class*="section"]'))
      .filter(el => el.offsetHeight > 0 && el.offsetHeight < 100)
      .map(el => ({ text: el.textContent.trim().substring(0, 60), tag: el.tagName, y: el.getBoundingClientRect().y }))
      .filter(l => l.text.length > 1)
      .sort((a, b) => a.y - b.y);
  });
  console.log('\nEditor elements (sorted by Y):');
  elements.slice(0, 40).forEach(e => console.log('  y=' + Math.round(e.y) + ' [' + e.tag + '] ' + e.text));

  // DON'T close browser yet — keep session for more operations
  await browser.close();
  console.log('\nDone');
})().catch(console.error);
