const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  console.log('Step 1: Go to Nmbrs login...');
  await page.goto('https://Vcsw.nmbrs.nl');
  await page.waitForTimeout(3000);

  // Accept cookies
  try { await page.click('text="Accept All Cookies"', { timeout: 5000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Step 2: Fill email
  console.log('Step 2: Fill email...');
  await page.locator('input#Username').fill('daimy@sonty.nl');
  await page.locator('input#LoginButton').click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/nmbrs-pw-page.png' });

  // Step 3: Fill password - find the submit button by examining the page
  console.log('Step 3: Fill password...');
  await page.locator('input[type="password"]').fill('k4Fb8cS4Rs^@!q');

  // Find all clickable elements
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, input[type="submit"], a.btn')).map(b => ({
      tag: b.tagName, type: b.type, text: b.textContent?.trim(), id: b.id, className: b.className?.substring(0, 60)
    }));
  });
  console.log('Buttons:', JSON.stringify(buttons));

  // Click submit
  try {
    await page.locator('button[type="submit"]').click();
  } catch(e) {
    console.log('button[type=submit] failed, trying others...');
    try {
      await page.locator('input[type="submit"]').click();
    } catch(e2) {
      // Press Enter instead
      await page.locator('input[type="password"]').press('Enter');
    }
  }

  console.log('Waiting for redirect...');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: '/tmp/nmbrs-after-signin.png', fullPage: true });
  console.log('URL:', page.url());

  // Check if we're in Nmbrs
  if (page.url().includes('nmbrs.nl') && !page.url().includes('connect.visma')) {
    console.log('SUCCESS - Inside Nmbrs!');
    await page.screenshot({ path: '/tmp/nmbrs-dashboard.png', fullPage: true });

    // Look for iCal or leave related items
    const items = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => {
        const t = (el.textContent || '').trim();
        return t.length < 80 && /ical|calendar|verlof|leave|export|afwezig|absence|vrij|rooster/i.test(t);
      }).map(el => ({ tag: el.tagName, text: el.textContent.trim().substring(0, 80) })).slice(0, 20);
    });
    console.log('Found items:', JSON.stringify(items, null, 2));

    // Show menu structure
    const menu = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a, [class*="menu"], [class*="nav"]')).map(el => ({
        text: el.textContent?.trim().substring(0, 60),
        href: el.href || ''
      })).filter(l => l.text && l.text.length < 40).slice(0, 50);
    });
    console.log('\nMenu:');
    menu.forEach(m => console.log(`  "${m.text}" → ${m.href}`));
  } else {
    console.log('Not in Nmbrs yet, URL:', page.url());
  }

  await browser.close();
  console.log('Done');
})().catch(err => console.error('Error:', err.message));
