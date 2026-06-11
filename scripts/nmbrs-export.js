const { chromium } = require('playwright');
const fs = require('fs');

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
    console.log('   Logged in:', page.url());

    // Go to Medewerkers and scrape employee details
    console.log('2. Getting all employees...');
    await page.click('text=Medewerkers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Scrape employee table
    const employees = await page.$$eval('table tbody tr', rows =>
      rows.map(row => {
        const cells = row.querySelectorAll('td');
        return {
          name: cells[0]?.textContent?.trim() || '',
          type: cells[1]?.textContent?.trim() || '',
          company: cells[2]?.textContent?.trim() || '',
          department: cells[3]?.textContent?.trim() || '',
          function: cells[4]?.textContent?.trim() || '',
        };
      }).filter(e => e.name.length > 0)
    );
    console.log(`   Found ${employees.length} employees:`);
    for (const emp of employees) {
      console.log(`   - ${emp.name} | ${emp.type} | ${emp.company} | ${emp.function}`);
    }

    // Go to Kalender
    console.log('3. Getting calendar...');
    await page.click('text=Kalender');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try Export iCal
    console.log('4. Exporting iCal...');
    // Click Export iCal dropdown
    try {
      const exportBtn = page.locator('text=Export iCal');
      if (await exportBtn.isVisible({ timeout: 3000 })) {
        await exportBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/nmbrs-ical-dropdown.png' });

        // Check for dropdown options
        const options = await page.$$('text=Rooster, text=Leave, text=Verzuim');
        console.log(`   iCal options found: ${options.length}`);

        // Get all visible menu items
        const menuItems = await page.$$eval('[class*="dropdown"] a, [class*="dropdown"] li, [class*="menu"] a, select option', items =>
          items.map(i => ({ text: i.textContent?.trim(), href: i.href || i.value || '' }))
        );
        console.log('   Menu items:');
        for (const item of menuItems) {
          console.log(`   - ${item.text}: ${item.href}`);
        }
      }
    } catch (e) {
      console.log('   iCal export error:', e.message.substring(0, 100));
    }

    // Also try Export PDF to see the data
    console.log('5. Checking Export PDF...');
    try {
      const pdfBtn = page.locator('text=Export PDF');
      if (await pdfBtn.isVisible({ timeout: 3000 })) {
        console.log('   Export PDF button found');
      }
    } catch (e) {}

    // Go to Verlofoverzicht
    console.log('6. Verlofoverzicht...');
    await page.click('text=Overzichten');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on Verlofoverzicht link
    try {
      await page.click('text=Verlofoverzicht');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/nmbrs-verlof.png' });
      console.log('   Verlofoverzicht URL:', page.url());

      // Get the table content
      const verlofTable = await page.textContent('table');
      if (verlofTable) {
        console.log('   Verlof data (first 500 chars):');
        console.log(verlofTable.substring(0, 500));
      }
    } catch (e) {
      console.log('   Error:', e.message.substring(0, 100));
    }

    // Go to Verlofregistratie
    console.log('7. Verlofregistratie...');
    await page.click('text=Overzichten');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    try {
      await page.click('text=Verlofregistratie');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/nmbrs-verlofregistratie.png' });

      const regTable = await page.textContent('body');
      const verlofLines = regTable.split('\n').filter(l =>
        l.includes('2026') || l.includes('vakantie') || l.includes('Verlof') || l.includes('verlof')
      );
      console.log('   Verlofregistratie entries:');
      for (const line of verlofLines.slice(0, 20)) {
        console.log('   >', line.trim().substring(0, 100));
      }
    } catch (e) {
      console.log('   Error:', e.message.substring(0, 100));
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/nmbrs-error.png' });
  }

  await browser.close();
})();
