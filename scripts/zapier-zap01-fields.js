const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(4000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(10000);

  if (page.url().includes('login')) { console.log('Login failed'); await browser.close(); return; }
  console.log('Logged in\n');

  // Go to ZAP-01
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(6000);

  // Click step 1 to see Reuzenpanda trigger config
  await page.click('text=Lead Created');
  await page.waitForTimeout(3000);

  // Click on "Test" tab to see available test data/fields
  try {
    await page.click('text=Test', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/zap01-test-data.png' });

    // Get all the test data fields
    const testData = await page.evaluate(() => {
      const body = document.body.innerText;
      // Find the section with field data
      const lines = body.split('\n').filter(l => l.trim());
      const dataLines = [];
      let inData = false;
      for (const l of lines) {
        if (l.includes('Parsed Free Fields') || l.includes('Item') || l.includes('Board') ||
            l.includes('Email') || l.includes('Phone') || l.includes('Name') ||
            l.includes('Address') || l.includes('Price') || l.includes('Status') ||
            l.includes('Column') || l.includes('Field') || l.includes('Value') ||
            l.includes('Subject') || l.includes('person') || l.includes('contact')) {
          dataLines.push(l.trim().substring(0, 120));
        }
      }
      return dataLines;
    });

    console.log('=== Test data fields from Reuzenpanda ===');
    testData.forEach(l => console.log('  ' + l));
  } catch(e) {
    console.log('Test tab click failed:', e.message);
  }

  // Also click Configure tab and scroll through all fields
  try {
    await page.click('text=Configure', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/zap01-configure.png' });
  } catch(e) {}

  // Now click step 2 and look at field mapping options
  console.log('\n=== Step 2: Contact field mapping ===');
  await page.click('text=Create or Update Contact');
  await page.waitForTimeout(3000);

  // Click Configure tab
  try {
    await page.click('text=Configure', { timeout: 3000 });
    await page.waitForTimeout(2000);
  } catch(e) {}

  // Scroll through the step 2 config to see all available mappings
  // Take multiple screenshots as we scroll
  for (let i = 0; i < 4; i++) {
    await page.screenshot({ path: `/tmp/zap01-s2-scroll${i}.png` });
    // Scroll the sidebar panel
    await page.evaluate(() => {
      const panels = document.querySelectorAll('[class*="sidebar"], [class*="panel"], [class*="Sidebar"], [role="complementary"]');
      for (const p of panels) {
        p.scrollTop += 400;
      }
      // Also try scrolling any overflow containers in the right panel area
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        if (r.left > 600 && r.height > 200) {
          const s = window.getComputedStyle(d);
          if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
            d.scrollTop += 400;
          }
        }
      });
    });
    await page.waitForTimeout(500);
  }

  // Click on the Contact Email field to see the dropdown of available Reuzenpanda fields
  console.log('\n=== Available Reuzenpanda fields (from dropdown) ===');
  try {
    const emailField = await page.$('input[value*="line_k"], input[value*="Email"], [class*="field"][class*="email"]');
    if (emailField) {
      await emailField.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/zap01-field-dropdown.png' });
    }

    // Try clicking on any "Enter text or insert data" placeholder
    const insertDataFields = await page.$$('text=Enter text or insert data');
    if (insertDataFields.length > 0) {
      await insertDataFields[0].click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/zap01-insert-data.png' });

      // Get dropdown content
      const dropdownText = await page.evaluate(() => {
        const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="popup"], [role="listbox"], [role="menu"]');
        let text = '';
        dropdowns.forEach(d => { text += d.innerText + '\n'; });
        return text;
      });
      console.log(dropdownText.substring(0, 2000));
    }
  } catch(e) {
    console.log('Field inspection failed:', e.message);
  }

  await browser.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
