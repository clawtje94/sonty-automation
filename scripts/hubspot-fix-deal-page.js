const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
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

  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('Login failed:', page.url());
    await page.screenshot({ path: '/tmp/hs-fail.png' });
    await browser.close();
    return;
  }
  console.log('LOGGED IN');

  // Open Isa Geer deal page
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/496073833660');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/hs-isa-full.png', fullPage: true });
  console.log('Deal page loaded');

  // Close any popups/banners
  try { await page.click('button:has-text("×"), [aria-label="Close"]', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Sluiten")', { timeout: 2000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Take a clean screenshot
  await page.screenshot({ path: '/tmp/hs-isa-clean.png' });

  // Now go to the customize page
  console.log('\n=== Going to sidebar customization ===');
  await page.goto('https://app-eu1.hubspot.com/sales-products-settings/147970649/object/0-3/record-customization');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/hs-customize-page.png' });
  console.log('Customize URL:', page.url());

  // Get page content
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log(pageText.substring(0, 800));

  // List all clickable elements
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="tab"], [role="button"]'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim().substring(0, 50), href: el.href || '', tag: el.tagName }))
      .filter(l => l.text.length > 1 && l.text.length < 50);
  });
  console.log('\nClickable elements:');
  elements.forEach(e => console.log('  [' + e.tag + '] ' + e.text + (e.href ? ' → ' + e.href.substring(0, 60) : '')));

  // Try clicking on "Standaard weergave" or the default view to edit it
  try {
    await page.click('text=Standaard weergave', { timeout: 3000 });
    await page.waitForTimeout(3000);
    console.log('\nClicked Standaard weergave');
    await page.screenshot({ path: '/tmp/hs-default-view.png' });
  } catch(e) {
    // Try "Default view"
    try { await page.click('text=Default view', { timeout: 2000 }); } catch(e2) {}
  }

  // Look for edit/customize options for the sidebar
  try {
    await page.click('text=Bewerken', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/hs-edit-view.png' });
    console.log('Edit mode opened');
    console.log('URL:', page.url());

    // Get edit page content
    const editText = await page.evaluate(() => document.body.innerText);
    console.log(editText.substring(0, 500));
  } catch(e) {
    console.log('No edit button found');
  }

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
