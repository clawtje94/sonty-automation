const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    // Login
    console.log('1. Login...');
    await page.goto('https://maasaccountants.nmbrs.nl/');
    await page.waitForLoadState('networkidle');
    try { await page.locator('button:has-text("Accept All")').click({ timeout: 3000 }); } catch (e) {}
    await page.fill('#Username', 'daimy@sonty.nl');
    await page.click('#LoginButton');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await pw.fill('k4Fb8cS4Rs^@!q');
      const sub = await page.$('input[type="submit"], button[type="submit"]');
      if (sub) await sub.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    try { await page.locator('text=Herinner me later').click({ timeout: 3000 }); } catch (e) {}
    await page.waitForTimeout(2000);

    // Go to Kalender
    console.log('2. Kalender...');
    await page.click('text=Kalender');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click Export iCal dropdown
    console.log('3. Export iCal...');
    await page.click('text=Export iCal');
    await page.waitForTimeout(1000);

    // Uncheck all except Leave
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const label = await cb.evaluate(el => {
        const parent = el.closest('label') || el.parentElement;
        return parent?.textContent?.trim() || '';
      });
      const isChecked = await cb.isChecked();

      if (label.includes('Leave')) {
        if (!isChecked) await cb.check();
        console.log(`   [x] ${label}`);
      } else if (label.includes('Actiepunten') || label.includes('Signalen') || label.includes('Verjaardag')) {
        if (isChecked) await cb.uncheck();
        console.log(`   [ ] ${label}`);
      }
    }

    await page.screenshot({ path: '/tmp/nmbrs-ical-leave-only.png' });

    // Click the Export iCal button (the actual export, not the dropdown toggle)
    // Look for a submit/export button inside the dropdown
    const exportButton = page.locator('button:has-text("Export iCal")').last();

    // Intercept the download or network request
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
      exportButton.click().catch(async () => {
        // Maybe it's a different button
        console.log('   Trying alternative export...');
        // Look for any export/download button in the dropdown
        const allBtns = await page.$$('button');
        for (const btn of allBtns) {
          const text = await btn.textContent();
          if (text.includes('Export') || text.includes('Download')) {
            console.log(`   Found button: ${text.trim()}`);
          }
        }
      })
    ]);

    if (download) {
      const filePath = path.join('/tmp', 'nmbrs-leave.ics');
      await download.saveAs(filePath);
      console.log(`   Downloaded to: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      console.log('   iCal content (first 2000 chars):');
      console.log(content.substring(0, 2000));
    } else {
      console.log('   No download triggered. Checking for URL...');

      // Maybe the export generates a URL or inline content
      // Let's check if there's a link with .ics
      const links = await page.$$eval('a[href]', els => els.map(e => ({ href: e.href, text: e.textContent.trim() })));
      const icsLinks = links.filter(l => l.href.includes('.ics') || l.href.includes('ical') || l.href.includes('calendar'));
      console.log('   iCal links:', icsLinks);

      // Also intercept network requests
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('ical') || url.includes('.ics') || url.includes('calendar')) {
          console.log('   Network: ', url);
          const body = await response.text();
          console.log('   Response:', body.substring(0, 500));
        }
      });

      // Try clicking again
      await page.click('text=Export iCal');
      await page.waitForTimeout(3000);
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/nmbrs-error.png' });
  }

  await browser.close();
})();
