const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login + code ALL AT ONCE
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(4000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(3000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(2000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);

  if (page.url().includes('confirm')) {
    await page.fill('input[placeholder*="code"], input[type="text"]', '521586');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(8000);
  }

  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('FAILED');
    await browser.close();
    return;
  }
  console.log('OK - logged in');

  // STEP 1: Go to record customization → Standaardweergave
  await page.goto('https://app-eu1.hubspot.com/sales-products-settings/147970649/object/0-3/record-customization');
  await page.waitForTimeout(5000);
  await page.click('a:has-text("Standaardweergave")');
  await page.waitForTimeout(8000);
  console.log('Layout editor:', page.url());
  await page.screenshot({ path: '/tmp/hs-le-1.png' });

  // Get what's on the page
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 2000));

  await page.screenshot({ path: '/tmp/hs-le-2.png', fullPage: true });

  // Try to find the sidebar section where we can add/remove properties
  // In HubSpot layout editor, there are tabs like "Linker zijbalk", "Midden", etc.
  const tabs = await page.$$('[role="tab"], [class*="tab"], button');
  let tabTexts = [];
  for (const tab of tabs) {
    const t = await tab.textContent();
    const visible = await tab.isVisible();
    if (visible && t.trim().length > 1 && t.trim().length < 40) tabTexts.push(t.trim());
  }
  console.log('\nTabs:', tabTexts.join(' | '));

  // Click on "Linker zijbalk" or sidebar tab
  for (const tabName of ['Linker zijbalk', 'Left sidebar', 'Zijbalk', 'Sidebar', 'Eigenschappen', 'Properties']) {
    try {
      await page.click('text=' + tabName, { timeout: 2000 });
      await page.waitForTimeout(2000);
      console.log('Clicked tab: ' + tabName);
      await page.screenshot({ path: '/tmp/hs-le-sidebar.png' });
      break;
    } catch(e) {}
  }

  // Look for "Eigenschap toevoegen" or "Add property" or similar
  try {
    await page.click('text=Eigenschap toevoegen', { timeout: 3000 });
    await page.waitForTimeout(2000);
    console.log('Add property dialog opened');
    await page.screenshot({ path: '/tmp/hs-le-add-prop.png' });
  } catch(e) {
    try {
      await page.click('text=Add property', { timeout: 2000 });
      await page.waitForTimeout(2000);
    } catch(e2) {
      console.log('Add property not found');
    }
  }

  await browser.close();
  console.log('Done');
})().catch(console.error);
